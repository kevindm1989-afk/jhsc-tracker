import { pgTable, serial, text, date, json, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const meetingMinutesTable = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  minutesCode: text("minutes_code").notNull().unique(),
  meetingDate: date("meeting_date").notNull(),
  meetingType: text("meeting_type").notNull().default("Regular Monthly"),
  managementAttendees: json("management_attendees").$type<Array<{ name: string; title: string }>>().notNull().default([]),
  workerAttendees: json("worker_attendees").$type<Array<{ name: string; title: string }>>().notNull().default([]),
  agendaItems: json("agenda_items").$type<Array<{ topic: string; notes: string }>>().notNull().default([]),
  motions: json("motions").$type<string[]>().notNull().default([]),
  decisions: text("decisions"),
  actionItems: json("action_items").$type<Array<{ title: string; assignedTo: string; dueDate: string }>>().notNull().default([]),
  nextMeetingDate: date("next_meeting_date"),
  workerCoChairSigned: boolean("worker_co_chair_signed").notNull().default(false),
  managementCoChairSigned: boolean("management_co_chair_signed").notNull().default(false),
  emailedAt: timestamp("emailed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMeetingMinutesSchema = createInsertSchema(meetingMinutesTable).omit({
  id: true,
  minutesCode: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMeetingMinutes = z.infer<typeof insertMeetingMinutesSchema>;
export type MeetingMinutes = typeof meetingMinutesTable.$inferSelect;
