import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  organization: text("organization").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;
export type InsertEmergencyContact = typeof emergencyContactsTable.$inferInsert;
