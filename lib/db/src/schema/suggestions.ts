import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";

export const suggestionsTable = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  suggestionCode: text("suggestion_code").notNull().unique(),
  employeeName: text("employee_name").notNull(),
  department: text("department").notNull(),
  shift: text("shift").notNull(),
  dateSubmitted: date("date_submitted").notNull(),
  dateObserved: date("date_observed").notNull(),
  priorityLevel: text("priority_level").notNull(),
  locationOfConcern: text("location_of_concern").notNull(),
  description: text("description").notNull(),
  proposedSolution: text("proposed_solution").notNull(),
  submittedByUserId: integer("submitted_by_user_id"),
  submittedByName: text("submitted_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Suggestion = typeof suggestionsTable.$inferSelect;
