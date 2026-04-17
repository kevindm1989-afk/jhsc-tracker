import { pgTable, serial, text, date, json, timestamp } from "drizzle-orm/pg-core";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  meetingCode: text("meeting_code").notNull().unique(),
  title: text("title").notNull(),
  meetingType: text("meeting_type").notNull().default("Regular"),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("Scheduled"),
  agenda: json("agenda").$type<{ item: string; notes: string }[]>().notNull().default([]),
  postMeetingNotes: text("post_meeting_notes"),
  createdBy: text("created_by").notNull().default("Unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Meeting = typeof meetingsTable.$inferSelect;
export type InsertMeeting = typeof meetingsTable.$inferInsert;
