import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workerStatementsTable = pgTable("worker_statements", {
  id: serial("id").primaryKey(),
  statementCode: text("statement_code").notNull().unique(),
  dateReceived: date("date_received").notNull(),
  shift: text("shift").notNull(),
  department: text("department").notNull(),
  hazardType: text("hazard_type").notNull(),
  description: text("description").notNull(),
  linkedItemCode: text("linked_item_code"),
  status: text("status").notNull().default("Received"),
  notes: text("notes"),
  loggedBy: text("logged_by").notNull().default("Unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWorkerStatementSchema = createInsertSchema(workerStatementsTable).omit({
  id: true,
  statementCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkerStatement = z.infer<typeof insertWorkerStatementSchema>;
export type WorkerStatement = typeof workerStatementsTable.$inferSelect;
