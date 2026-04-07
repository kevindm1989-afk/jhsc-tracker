import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const foldersTable = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  createdBy: text("created_by").notNull().default("Unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const folderFilesTable = pgTable("folder_files", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => foldersTable.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull().default("Unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Folder = typeof foldersTable.$inferSelect & { fileCount?: number; subfolderCount?: number };
export type FolderFile = typeof folderFilesTable.$inferSelect;
