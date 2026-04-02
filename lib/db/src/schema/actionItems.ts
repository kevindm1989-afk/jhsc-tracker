import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actionItemsTable = pgTable("action_items", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  date: date("date").notNull(),
  department: text("department").notNull(),
  description: text("description").notNull(),
  raisedBy: text("raised_by").notNull(),
  assignedTo: text("assigned_to").notNull(),
  dueDate: date("due_date"),
  priority: text("priority").notNull(),
  status: text("status").notNull().default("Open"),
  closedDate: date("closed_date"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertActionItemSchema = createInsertSchema(actionItemsTable).omit({
  id: true,
  itemCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItemsTable.$inferSelect;
