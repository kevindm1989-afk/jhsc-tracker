import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationLogsTable = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  sentBy: integer("sent_by").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),
  targetType: text("target_type").notNull(),
  targetValue: text("target_value"),
  recipientCount: integer("recipient_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationRulesTable = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  targetType: text("target_type").notNull(),
  targetValue: text("target_value").notNull(),
  enabled: boolean("enabled").default(true),
  createdBy: integer("created_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
