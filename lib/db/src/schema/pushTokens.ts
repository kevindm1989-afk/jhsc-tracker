import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  platform: text("platform").default("web"),
  createdAt: timestamp("created_at").defaultNow(),
});
