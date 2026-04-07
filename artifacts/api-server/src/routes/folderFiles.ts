import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, pool } from "@workspace/db";
import { foldersTable, folderFilesTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

const UPLOAD_DIR = process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain", "text/csv",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed"));
  },
});

const router: IRouter = Router();

// ── Folders ───────────────────────────────────────────────────────────────────

router.get("/folders", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        f.id,
        f.name,
        f.parent_id AS "parentId",
        f.created_by AS "createdBy",
        f.created_at AS "createdAt",
        (SELECT COUNT(*) FROM folder_files ff WHERE ff.folder_id = f.id)::int AS "fileCount",
        (SELECT COUNT(*) FROM folders sf WHERE sf.parent_id = f.id)::int AS "subfolderCount"
      FROM folders f
      ORDER BY f.created_at
    `);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list folders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/folders", async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Folder name is required" });
    const createdBy = req.session?.displayName || "Unknown";
    const [folder] = await db
      .insert(foldersTable)
      .values({ name: name.trim(), createdBy, parentId: parentId ? parseInt(parentId) : null })
      .returning();
    return res.status(201).json(folder);
  } catch (err) {
    req.log.error({ err }, "Failed to create folder");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/folders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Folder name is required" });
    const [folder] = await db.update(foldersTable).set({ name: name.trim() }).where(eq(foldersTable.id, id)).returning();
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    return res.json(folder);
  } catch (err) {
    req.log.error({ err }, "Failed to rename folder");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/folders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const files = await db.select().from(folderFilesTable).where(eq(folderFilesTable.folderId, id));
    files.forEach((f) => {
      const fp = path.join(UPLOAD_DIR, f.storedName);
      if (fs.existsSync(fp)) fs.unlink(fp, () => {});
    });
    await db.delete(foldersTable).where(eq(foldersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete folder");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Files ─────────────────────────────────────────────────────────────────────

router.get("/folders/:id/files", async (req, res) => {
  try {
    const folderId = parseInt(req.params.id);
    const files = await db
      .select()
      .from(folderFilesTable)
      .where(eq(folderFilesTable.folderId, folderId))
      .orderBy(desc(folderFilesTable.createdAt));
    res.json(files);
  } catch (err) {
    req.log.error({ err }, "Failed to list files");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/folders/:id/files", upload.array("files", 20), async (req, res) => {
  try {
    const folderId = parseInt(req.params.id as string);
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: "No files uploaded" });
    const uploadedBy = req.session?.displayName || "Unknown";
    const inserted = await db
      .insert(folderFilesTable)
      .values(files.map((f) => ({
        folderId,
        originalName: f.originalname,
        storedName: f.filename,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        uploadedBy,
      })))
      .returning();
    return res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to upload files");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/files/:storedName", (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.storedName as string);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  const downloadName = req.query.name as string | undefined;
  return downloadName ? res.download(filePath, downloadName) : res.download(filePath);
});

router.delete("/files/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [file] = await db.select().from(folderFilesTable).where(eq(folderFilesTable.id, id));
    if (file) {
      const fp = path.join(UPLOAD_DIR, file.storedName);
      if (fs.existsSync(fp)) fs.unlink(fp, () => {});
      await db.delete(folderFilesTable).where(eq(folderFilesTable.id, id));
    }
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete file");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
