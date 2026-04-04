import app, { ensureSessionTable } from "./app";
import { logger } from "./lib/logger";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { count, eq, or, isNull, and } from "drizzle-orm";

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
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table");
    process.exit(1);
  });
