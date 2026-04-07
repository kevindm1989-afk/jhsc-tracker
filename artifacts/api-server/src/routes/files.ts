import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { storedFilesTable } from "@workspace/db/schema";
import { eq, desc, like } from "drizzle-orm";

const UPLOAD_DIR = process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads");

const router: IRouter = Router();

// List all files, optionally filtered by folder prefix
router.get("/", async (req, res) => {
  try {
    const { folder } = req.query;
    const items = folder
      ? await db.select().from(storedFilesTable).where(like(storedFilesTable.folder, `${folder}%`)).orderBy(desc(storedFilesTable.uploadedAt))
      : await db.select().from(storedFilesTable).orderBy(desc(storedFilesTable.uploadedAt));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list files");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve a stored file by ID
router.get("/serve/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [file] = await db.select().from(storedFilesTable).where(eq(storedFilesTable.id, id));
    if (!file) return res.status(404).json({ error: "File not found" });
    const filePath = path.join(UPLOAD_DIR, file.storedPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing from disk" });
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.sendFile(filePath);
  } catch (err) {
    req.log.error({ err }, "Failed to serve file");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a stored file
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [file] = await db.select().from(storedFilesTable).where(eq(storedFilesTable.id, id));
    if (file) {
      const filePath = path.join(UPLOAD_DIR, file.storedPath);
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      await db.delete(storedFilesTable).where(eq(storedFilesTable.id, id));
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete file");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
