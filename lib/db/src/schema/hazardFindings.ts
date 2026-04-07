import { pgTable, serial, text, date, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hazardFindingsTable = pgTable("hazard_findings", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  date: date("date").notNull(),
  department: text("department").notNull(),
  hazardDescription: text("hazard_description").notNull(),
  ohsaReference: text("ohsa_reference"),
  severity: text("severity").notNull(),
  recommendationDate: date("recommendation_date").notNull(),
  responseDeadline: date("response_deadline"),
  status: text("status").notNull().default("Open"),
  closedDate: date("closed_date"),
  notes: text("notes"),
  zone: text("zone"),
  riskLikelihood: integer("risk_likelihood"),
  riskSeverity: integer("risk_severity"),
  riskScore: integer("risk_score"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  submitterName: text("submitter_name"),
  responseToken: text("response_token"),
  responseTokenExpiresAt: timestamp("response_token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertHazardFindingSchema = createInsertSchema(hazardFindingsTable).omit({
  id: true,
  itemCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHazardFinding = z.infer<typeof insertHazardFindingSchema>;
export type HazardFinding = typeof hazardFindingsTable.$inferSelect;
