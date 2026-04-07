import { pgTable, serial, text, integer, json, timestamp } from "drizzle-orm/pg-core";

export const checklistTemplatesTable = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  items: json("items").$type<Array<{ description: string; ohsaRef: string; defaultRating: string }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const completedChecklistsTable = pgTable("completed_checklists", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id"),
  templateId: integer("template_id"),
  templateName: text("template_name").notNull(),
  completedItems: json("completed_items").$type<Array<{ description: string; ohsaRef: string; rating: string; notes: string }>>().notNull().default([]),
  completedBy: text("completed_by").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export type ChecklistTemplate = typeof checklistTemplatesTable.$inferSelect;
export type CompletedChecklist = typeof completedChecklistsTable.$inferSelect;
