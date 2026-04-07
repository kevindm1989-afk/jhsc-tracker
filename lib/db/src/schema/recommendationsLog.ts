import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const recommendationsLogTable = pgTable("recommendations_log", {
  id: serial("id").primaryKey(),
  recCode: text("rec_code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  recommendationDate: text("recommendation_date").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("Open"),
  assignedTo: text("assigned_to"),
  outcome: text("outcome"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RecommendationLog = typeof recommendationsLogTable.$inferSelect;
export type NewRecommendationLog = typeof recommendationsLogTable.$inferInsert;
