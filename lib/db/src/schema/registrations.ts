import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  department: text("department").notNull(),
  shift: text("shift").notNull(),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Registration = typeof registrationsTable.$inferSelect;
export type InsertRegistration = typeof registrationsTable.$inferInsert;
