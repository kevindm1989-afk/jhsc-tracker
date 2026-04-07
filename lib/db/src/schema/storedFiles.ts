import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const storedFilesTable = pgTable("stored_files", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedPath: text("stored_path").notNull(),
  folder: text("folder").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export type StoredFile = typeof storedFilesTable.$inferSelect;
