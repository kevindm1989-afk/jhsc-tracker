import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  parentType: text("parent_type").notNull(),
  parentId: integer("parent_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Attachment = typeof attachmentsTable.$inferSelect;
