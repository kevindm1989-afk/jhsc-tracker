import { pgTable, serial, text, date, timestamp, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer }>({
  dataType() { return "bytea"; },
});

export const inspectionLogTable = pgTable("inspection_log", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  date: date("date").notNull(),
  zone: text("zone").notNull(),
  area: text("area"),
  finding: text("finding").notNull(),
  correctiveAction: text("corrective_action"),
  inspector: text("inspector"),
  priority: text("priority").notNull(),
  assignedTo: text("assigned_to"),
  followUpDate: date("follow_up_date"),
  status: text("status").notNull().default("Open"),
  closedDate: date("closed_date"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  fileData: bytea("file_data"),
});

export const insertInspectionEntrySchema = createInsertSchema(inspectionLogTable).omit({
  id: true,
  itemCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInspectionEntry = z.infer<typeof insertInspectionEntrySchema>;
export type InspectionEntry = typeof inspectionLogTable.$inferSelect;
