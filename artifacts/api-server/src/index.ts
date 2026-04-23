import app, { ensureSessionTable } from "./app";
import { logger } from "./lib/logger";
import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { count, eq, or, isNull, and } from "drizzle-orm";
import cron from "node-cron";
import { createTransporter, getSenderAddress } from "./emailClient";
import { dumpDatabase } from "./services/dbDump";
import { writeFile } from "fs/promises";


const port = Number(process.env["PORT"] || 3000);

async function seedAdminIfNeeded() {
  try {
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    if (Number(value) === 0) {
      const passwordHash = await bcrypt.hash("JHSCAdmin1!", 12);
      await db.insert(usersTable).values({
        username: "admin",
        displayName: "Worker Co-Chair",
        passwordHash,
        email: "jhsc1285app@gmail.com",
        role: "admin",
        permissions: [],
      });
      logger.info("Default admin account created — username: admin");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin account");
  }
}

async function ensureAdminEmail() {
  try {
    await db
      .update(usersTable)
      .set({ email: "jhsc1285app@gmail.com" })
      .where(
        and(
          eq(usersTable.username, "admin"),
          or(
            isNull(usersTable.email),
            eq(usersTable.email, ""),
            eq(usersTable.email, "kevindm1989@gmail.com")
          )
        )
      );
  } catch (err) {
    logger.error({ err }, "Failed to ensure admin email");
  }
}

async function ensureFileDataColumns() {
  try {
    await pool.query(`
      ALTER TABLE folder_files ADD COLUMN IF NOT EXISTS file_data bytea;
      ALTER TABLE inspection_log ADD COLUMN IF NOT EXISTS file_data bytea;
      ALTER TABLE worker_statements ADD COLUMN IF NOT EXISTS logged_by text NOT NULL DEFAULT 'Unknown';
      ALTER TABLE right_to_refuse ADD COLUMN IF NOT EXISTS logged_by text NOT NULL DEFAULT 'Unknown';
    `);
    logger.info("File data columns verified");
  } catch (err) {
    logger.error({ err }, "Failed to ensure file_data columns");
  }
}

async function ensureIncidentsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id serial PRIMARY KEY,
        incident_code text NOT NULL UNIQUE,
        incident_type text NOT NULL DEFAULT 'Incident',
        incident_date date NOT NULL,
        incident_time text NOT NULL DEFAULT '',
        location text NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT '',
        injured_person text NOT NULL DEFAULT '',
        body_part_affected text NOT NULL DEFAULT '',
        witnesses text NOT NULL DEFAULT '',
        immediate_action text NOT NULL DEFAULT '',
        reported_to text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'Open',
        created_by text NOT NULL DEFAULT 'Unknown',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    logger.info("Incidents table verified");
  } catch (err) {
    logger.error({ err }, "Failed to ensure incidents table");
  }
}

async function ensureEmergencyContactsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id serial PRIMARY KEY,
        name text NOT NULL,
        role text NOT NULL DEFAULT '',
        organization text NOT NULL DEFAULT '',
        phone text NOT NULL DEFAULT '',
        email text NOT NULL DEFAULT '',
        notes text NOT NULL DEFAULT '',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    logger.info("Emergency contacts table verified");
  } catch (err) {
    logger.error({ err }, "Failed to ensure emergency_contacts table");
  }
}

async function ensureMeetingsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id serial PRIMARY KEY,
        meeting_code text NOT NULL UNIQUE,
        title text NOT NULL,
        meeting_type text NOT NULL DEFAULT 'Regular',
        scheduled_date date NOT NULL,
        scheduled_time text NOT NULL,
        location text NOT NULL,
        status text NOT NULL DEFAULT 'Scheduled',
        agenda json NOT NULL DEFAULT '[]',
        post_meeting_notes text,
        created_by text NOT NULL DEFAULT 'Unknown',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    logger.info("Meetings table verified");
  } catch (err) {
    logger.error({ err }, "Failed to ensure meetings table");
  }
}

async function scheduleInspectionReminders() {
  try {
    const client = await pool.connect();
    try {
      const settings = await client.query(
        `SELECT key, value FROM inspection_schedule WHERE key = ANY($1)`,
        [["inspectionDay", "reminderLeadDays", "coChairEmail1", "coChairEmail2", "enabled"]]
      );
      const cfg: Record<string, string> = {};
      for (const row of settings.rows) cfg[row.key] = row.value;

      if (cfg["enabled"] !== "true") return;

      const inspectionDay = parseInt(cfg["inspectionDay"] || "15");
      const leadDays = parseInt(cfg["reminderLeadDays"] || "5");
      const emails = [cfg["coChairEmail1"], cfg["coChairEmail2"]].filter(Boolean);

      if (emails.length === 0) return;

      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), inspectionDay);
      const reminderDate = new Date(thisMonth.getTime() - leadDays * 86400000);
      const inspDateStr = thisMonth.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

      if (
        today.getDate() === reminderDate.getDate() &&
        today.getMonth() === reminderDate.getMonth()
      ) {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: getSenderAddress(),
          to: emails.join(", "),
          subject: `Reminder: Monthly JHSC Inspection scheduled for ${inspDateStr}`,
          html: `
            <p>This is an automated reminder from the JHSC Advisor.</p>
            <p>Your monthly joint health and safety inspection is scheduled for <strong>${inspDateStr}</strong> (${leadDays} days from today).</p>
            <p>Please ensure all inspection checklists and PPE are prepared in advance.</p>
            <p><em>OHSA s.9(26) requires a minimum one inspection per month of each part of the workplace.</em></p>
            <br><p><em>JHSC Advisor</em></p>
          `,
        });
        logger.info({ emails, inspectionDate: thisMonth }, "Inspection reminder sent");
      }
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err }, "Inspection reminder job skipped (config not yet set or email not configured)");
  }
}

app.listen(port, "0.0.0.0", () => {
  logger.info(`Server running on port ${port}`);
});

(async () => {
  try {
    await ensureSessionTable();
    await seedAdminIfNeeded();
    await ensureAdminEmail();
    await ensureFileDataColumns();
    await ensureMeetingsTable();
    await ensureIncidentsTable();
    await ensureEmergencyContactsTable();

    cron.schedule("0 8 * * *", () => {
      scheduleInspectionReminders().catch(e => logger.error({ err: e }, "Inspection cron failed"));
    });
    logger.info("Inspection reminder cron scheduled (08:00 daily)");

    // Automatic local backup — runs daily at 03:00 (server local time).
    // Writes the latest dump to /tmp/jhsc_latest_backup.json on the Fly.io VM.
    // Admins can download a backup on-demand via Manage Users → Database Backup.
    cron.schedule("0 3 * * *", async () => {
      try {
        const dump = await dumpDatabase();
        const json = JSON.stringify(dump);
        await writeFile("/tmp/jhsc_latest_backup.json", json, "utf8");
        logger.info(
          { tableCount: dump.tableCount, rowCount: dump.rowCount, bytes: Buffer.byteLength(json) },
          "Scheduled backup written to /tmp/jhsc_latest_backup.json",
        );
      } catch (e) {
        logger.error({ err: e }, "Scheduled backup failed");
      }
    });
    logger.info("DB backup scheduled (cron: 03:00 daily — writes to /tmp, no startup run)");
  } catch (err) {
    logger.error({ err }, "Startup setup failed");
    process.exit(1);
  }
})();
