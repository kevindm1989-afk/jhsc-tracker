import { pgTable, serial, text, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rightToRefuseTable = pgTable("right_to_refuse", {
  id: serial("id").primaryKey(),
  refuseCode: text("refuse_code").notNull().unique(),
  workerName: text("worker_name").notNull(),
  refusalDate: date("refusal_date").notNull(),
  refusalTime: text("refusal_time").notNull(),
  zone: text("zone").notNull(),
  hazardDescription: text("hazard_description").notNull(),
  supervisorNotified: boolean("supervisor_notified").notNull().default(false),
  supervisorName: text("supervisor_name"),
  jhscRepNotified: boolean("jhsc_rep_notified").notNull().default(false),
  inspectorCalled: boolean("inspector_called").notNull().default(false),
  molFileNumber: text("mol_file_number"),
  outcome: text("outcome").notNull().default("Ongoing"),
  notes: text("notes"),
  loggedBy: text("logged_by").notNull().default("Unknown"),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRightToRefuseSchema = createInsertSchema(rightToRefuseTable).omit({
  id: true,
  refuseCode: true,
  createdAt: true,
  updatedAt: true,
  lockedAt: true,
});

export type InsertRightToRefuse = z.infer<typeof insertRightToRefuseSchema>;
export type RightToRefuse = typeof rightToRefuseTable.$inferSelect;
