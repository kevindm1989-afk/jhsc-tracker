import { pgTable, serial, text, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recommendationsTable = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  recCode: text("rec_code").notNull().unique(),
  dateIssued: date("date_issued").notNull(),
  ohsaAuthority: text("ohsa_authority").notNull(),
  description: text("description").notNull(),
  linkedHazardCode: text("linked_hazard_code"),
  responseDeadline: date("response_deadline").notNull(),
  responseReceived: text("response_received").notNull().default("No"),
  responseOutcome: text("response_outcome").notNull().default("Pending"),
  escalationStatus: text("escalation_status").notNull().default("None"),
  notes: text("notes"),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRecommendationSchema = createInsertSchema(recommendationsTable).omit({
  id: true,
  recCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendationsTable.$inferSelect;
