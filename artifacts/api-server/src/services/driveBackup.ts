/**
 * Google Drive backup service for JHSC Advisor.
 *
 * Connects to Neon Postgres via DATABASE_URL, dumps every table in the
 * `public` schema to a JSON file (we cannot use `pg_dump` because it is
 * not available on Fly.io), then uploads the file to a "JHSC Advisor
 * Backups" folder in Google Drive using a service-account credential.
 *
 * Retention: keeps only the most recent 30 backup files in the folder.
 *
 * --------------------------------------------------------------------
 * REQUIRED FLY.IO SECRET — set this once before this code can run:
 *
 *   flyctl secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste json here>' \
 *     --app jhsctracker-api
 *
 * The value must be the full JSON key for a Google Cloud service
 * account that has the Google Drive API enabled. Share the destination
 * Drive folder with the service-account's email if you want a human to
 * view the backups in their own Drive.
 * --------------------------------------------------------------------
 */

import pg from "pg";
import { PassThrough } from "stream";
import { google } from "googleapis";

const { Client } = pg;

const FOLDER_NAME = "JHSC Advisor Backups";
const RETENTION_LIMIT = 30;
const SCOPES = ["https://www.googleapis.com/auth/drive"];

function ts(): string {
  return new Date().toISOString();
}

function logInfo(msg: string) {
  console.info(`[${ts()}] [BACKUP] ${msg}`);
}

function logError(msg: string, err?: unknown) {
  if (err) {
    console.error(`[${ts()}] [BACKUP] ${msg}`, err);
  } else {
    console.error(`[${ts()}] [BACKUP] ${msg}`);
  }
}

export interface BackupResult {
  success: boolean;
  filename: string;
  fileId?: string;
  folderId?: string;
  tableCount?: number;
  rowCount?: number;
  byteSize?: number;
  error?: string;
}

/**
 * Pull every row from every table in the `public` schema and return
 * a single JS object keyed by table name.
 */
async function dumpDatabaseToObject(): Promise<{
  data: Record<string, unknown[]>;
  tableCount: number;
  rowCount: number;
}> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new Client({
    connectionString: url,
    // Neon requires SSL; rejectUnauthorized:false is the standard
    // posture for managed Postgres providers behind a TLS terminator.
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const data: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const { table_name } of tablesRes.rows) {
      // table_name is identifier-quoted to defend against unusual names.
      const safeName = `"${table_name.replace(/"/g, '""')}"`;
      const rowsRes = await client.query(`SELECT * FROM ${safeName}`);
      data[table_name] = rowsRes.rows;
      totalRows += rowsRes.rows.length;
    }

    return {
      data,
      tableCount: tablesRes.rows.length,
      rowCount: totalRows,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

function getServiceAccountCredentials() {
  const raw = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set. Run: " +
        "flyctl secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste json here>' --app jhsctracker-api",
    );
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
}

function getDriveClient() {
  const creds = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: SCOPES,
  });
  return google.drive({ version: "v3", auth });
}

async function ensureBackupFolder(
  drive: ReturnType<typeof getDriveClient>,
): Promise<string> {
  return "19bNrxC5ZNhKrDOa7xk8m4e79HozjtqIN";
}

async function uploadBackup(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
  filename: string,
  jsonString: string,
): Promise<string> {
  // PassThrough is a proper byte-mode Node.js duplex stream.
  // Readable.from() produces an object-mode stream that googleapis/gaxios
  // cannot reliably pipe, causing EPIPE errors mid-upload.
  const body = new PassThrough();
  body.end(Buffer.from(jsonString, "utf8"));

  const created = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: "application/json",
    },
    media: {
      mimeType: "application/json",
      body,
    },
    fields: "id, name, size",
  });

  if (!created.data.id) throw new Error("Drive upload returned no file id");
  return created.data.id;
}

async function pruneOldBackups(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
): Promise<number> {
  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType='application/json'`,
    orderBy: "createdTime desc",
    fields: "files(id, name, createdTime)",
    pageSize: 200,
  });

  const files = list.data.files || [];
  if (files.length <= RETENTION_LIMIT) return 0;

  const toDelete = files.slice(RETENTION_LIMIT);
  let deleted = 0;
  for (const f of toDelete) {
    if (!f.id) continue;
    try {
      await drive.files.delete({ fileId: f.id });
      deleted++;
      logInfo(`Pruned old backup: ${f.name} (${f.id})`);
    } catch (err) {
      logError(`Failed to delete old backup ${f.name} (${f.id})`, err);
    }
  }
  return deleted;
}

/**
 * Run a complete backup: dump → upload → prune. Always resolves.
 */
export async function runDriveBackup(): Promise<BackupResult> {
  const dateStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `jhsc_backup_${dateStamp}.json`;

  try {
    logInfo(`Starting backup → ${filename}`);

    const { data, tableCount, rowCount } = await dumpDatabaseToObject();
    const payload = {
      generatedAt: new Date().toISOString(),
      databaseUrlHost: (() => {
        try {
          return new URL(process.env["DATABASE_URL"] || "").host;
        } catch {
          return "unknown";
        }
      })(),
      tableCount,
      rowCount,
      data,
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const byteSize = Buffer.byteLength(jsonString, "utf8");

    logInfo(
      `Dump complete: ${tableCount} tables, ${rowCount} rows, ${byteSize} bytes`,
    );

    const drive = getDriveClient();
    const folderId = await ensureBackupFolder(drive);
    const fileId = await uploadBackup(drive, folderId, filename, jsonString);

    logInfo(`Uploaded ${filename} → Drive folder ${folderId} (file ${fileId})`);

    const pruned = await pruneOldBackups(drive, folderId);
    if (pruned > 0) logInfo(`Retention sweep removed ${pruned} old file(s)`);

    logInfo(`SUCCESS: ${filename}`);
    return {
      success: true,
      filename,
      fileId,
      folderId,
      tableCount,
      rowCount,
      byteSize,
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    logError(`FAILURE: ${filename} — ${message}`, err);
    return {
      success: false,
      filename,
      error: message,
    };
  }
}
