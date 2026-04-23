/**
 * Database dump service — exports every table in the public schema to JSON.
 * Used by both the on-demand download endpoint and the nightly cron backup.
 */

import pg from "pg";

const { Client } = pg;

export interface DumpResult {
  generatedAt: string;
  databaseHost: string;
  tableCount: number;
  rowCount: number;
  data: Record<string, unknown[]>;
}

export async function dumpDatabase(): Promise<DumpResult> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new Client({
    connectionString: url,
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
      const safe = `"${table_name.replace(/"/g, '""')}"`;
      const res = await client.query(`SELECT * FROM ${safe}`);
      data[table_name] = res.rows;
      totalRows += res.rows.length;
    }

    let databaseHost = "unknown";
    try { databaseHost = new URL(url).host; } catch {}

    return {
      generatedAt: new Date().toISOString(),
      databaseHost,
      tableCount: tablesRes.rows.length,
      rowCount: totalRows,
      data,
    };
  } finally {
    await client.end().catch(() => {});
  }
}
