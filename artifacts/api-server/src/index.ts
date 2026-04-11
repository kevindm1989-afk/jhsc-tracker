import app, { ensureSessionTable } from "./app";
import { logger } from "./lib/logger";
import bcrypt from "bcryptjs";
import { db, pool } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { count, eq, or, isNull, and } from "drizzle-orm";
import cron from "node-cron";
import { createTransporter, getSenderAddress } from "./emailClient";

const port = Number(process.env["PORT"] || 3000);

async function seedAdminIfNeeded() {
  try {
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    if (Number(value) === 0) {
      const passwordHash = await bcrypt.hash("Unifor1285!", 12);
      await db.insert(usersTable).values({
        username: "admin",
        displayName: "Worker Co-Chair",
        passwordHash,
        email: "jhsc1285app@gmail.com",
        role: "admin",
        permissions: [],
      });
      logger.info("Default admin account created — username: admin, password: Unifor1285!");
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

ensureSessionTable()
  .then(() => {
    app.listen(port, "0.0.0.0", async (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info(`Server running on port ${port}`);
      await seedAdminIfNeeded();
      await ensureAdminEmail();

      // Run inspection reminder check every day at 08:00
      cron.schedule("0 8 * * *", () => {
        scheduleInspectionReminders().catch(e => logger.error({ err: e }, "Inspection cron failed"));
      });
      logger.info("Inspection reminder cron scheduled (08:00 daily)");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table");
    process.exit(1);
  });
