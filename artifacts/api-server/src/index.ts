import app, { ensureSessionTable } from "./app";
import { logger } from "./lib/logger";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { count, eq, or, isNull, and } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminIfNeeded() {
  try {
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    if (Number(value) === 0) {
      const passwordHash = await bcrypt.hash("Unifor1285!", 12);
      await db.insert(usersTable).values({
        username: "admin",
        displayName: "Worker Co-Chair",
        passwordHash,
        email: "kevindm1989@gmail.com",
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
      .set({ email: "kevindm1989@gmail.com" })
      .where(
        and(
          eq(usersTable.username, "admin"),
          or(isNull(usersTable.email), eq(usersTable.email, ""))
        )
      );
  } catch (err) {
    logger.error({ err }, "Failed to ensure admin email");
  }
}

ensureSessionTable()
  .then(() => {
    app.listen(port, async (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      await seedAdminIfNeeded();
      await ensureAdminEmail();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table");
    process.exit(1);
  });
