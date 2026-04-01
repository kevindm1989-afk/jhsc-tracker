import { pgTable, serial, text, date, integer, timestamp } from "drizzle-orm/pg-core";

export const memberActionsTable = pgTable("member_actions", {
  id: serial("id").primaryKey(),
  actionCode: text("action_code").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull().$type<"zone-inspection" | "inspect-spill-kits" | "inspect-first-aid-kits" | "inspect-eye-saline" | "verify-closed-items" | "other">(),
  assignedToUserId: integer("assigned_to_user_id").notNull(),
  assignedToName: text("assigned_to_name").notNull(),
  zone: integer("zone"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("pending").$type<"pending" | "in-progress" | "completed">(),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  relatedItemCode: text("related_item_code"),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MemberAction = typeof memberActionsTable.$inferSelect;
export type InsertMemberAction = typeof memberActionsTable.$inferInsert;
