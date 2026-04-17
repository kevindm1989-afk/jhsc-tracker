import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  incidentCode: text("incident_code").notNull().unique(),
  incidentType: text("incident_type").notNull().default("Incident"),
  incidentDate: date("incident_date").notNull(),
  incidentTime: text("incident_time").notNull().default(""),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  injuredPerson: text("injured_person").notNull().default(""),
  bodyPartAffected: text("body_part_affected").notNull().default(""),
  witnesses: text("witnesses").notNull().default(""),
  immediateAction: text("immediate_action").notNull().default(""),
  reportedTo: text("reported_to").notNull().default(""),
  status: text("status").notNull().default("Open"),
  createdBy: text("created_by").notNull().default("Unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = typeof incidentsTable.$inferInsert;
