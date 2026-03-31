import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const closedItemsLogTable = pgTable("closed_items_log", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  date: date("date").notNull(),
  department: text("department").notNull(),
  description: text("description").notNull(),
  assignedTo: text("assigned_to").notNull(),
  closedDate: date("closed_date"),
  meetingDate: text("meeting_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClosedItemSchema = createInsertSchema(closedItemsLogTable).omit({
  id: true,
  itemCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClosedItem = z.infer<typeof insertClosedItemSchema>;
export type ClosedItem = typeof closedItemsLogTable.$inferSelect;
