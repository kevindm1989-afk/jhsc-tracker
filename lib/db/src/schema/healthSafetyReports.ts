import { pgTable, serial, integer, text, date, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const healthSafetyReportsTable = pgTable("health_safety_reports", {
  id: serial("id").primaryKey(),
  reportCode: text("report_code").notNull().unique(),
  employeeName: text("employee_name").notNull(),
  department: text("department").notNull(),
  jobTitle: text("job_title").notNull(),
  shift: text("shift").notNull(),
  dateReported: date("date_reported").notNull(),
  supervisorManager: text("supervisor_manager").notNull(),
  concernTypes: json("concern_types").$type<string[]>().notNull().default([]),
  otherConcernType: text("other_concern_type"),
  areaLocation: text("area_location").notNull(),
  incidentDate: date("incident_date").notNull(),
  incidentTime: text("incident_time").notNull(),
  equipmentTask: text("equipment_task"),
  whatHappened: text("what_happened").notNull(),
  reportedToSupervisor: boolean("reported_to_supervisor").notNull().default(false),
  whoNotified: text("who_notified"),
  immediateActionTaken: text("immediate_action_taken"),
  witnesses: text("witnesses"),
  suggestedCorrection: text("suggested_correction"),
  employeeSignature: text("employee_signature").notNull(),
  signatureDate: date("signature_date").notNull(),
  submittedByUserId: integer("submitted_by_user_id"),
  submittedByName: text("submitted_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHealthSafetyReportSchema = createInsertSchema(healthSafetyReportsTable).omit({
  id: true,
  reportCode: true,
  createdAt: true,
});

export type HealthSafetyReport = typeof healthSafetyReportsTable.$inferSelect;
export type InsertHealthSafetyReport = z.infer<typeof insertHealthSafetyReportSchema>;
