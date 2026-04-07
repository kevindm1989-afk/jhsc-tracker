import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { attachmentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, and PDF files are allowed"));
  },
});

const router: IRouter = Router();

router.get("/:parentType/:parentId", async (req, res) => {
  try {
    const { parentType, parentId } = req.params;
    const items = await db
      .select()
      .from(attachmentsTable)
      .where(and(eq(attachmentsTable.parentType, parentType), eq(attachmentsTable.parentId, parseInt(parentId))));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list attachments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:parentType/:parentId", upload.array("files", 3), async (req, res) => {
  try {
    const { parentType, parentId } = req.params as Record<string, string>;
    const files = req.files as Express.Multer.File[];
    const uploadedBy = req.session?.displayName || "Unknown";

    const existing = await db
      .select()
      .from(attachmentsTable)
      .where(and(eq(attachmentsTable.parentType, parentType), eq(attachmentsTable.parentId, parseInt(parentId))));

    if (existing.length + files.length > 3) {
      files.forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({ error: "Maximum 3 attachments per record" });
    }

    const inserted = await db
      .insert(attachmentsTable)
      .values(
        files.map((f) => ({
          parentType,
          parentId: parseInt(parentId),
          fileName: f.originalname,
          filePath: f.filename,
          mimeType: f.mimetype,
          fileSizeBytes: f.size,
          uploadedBy,
        }))
      )
      .returning();

    return res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to upload attachments");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/file/:filename", (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename as string);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  return res.sendFile(filePath);
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [att] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, id));
    if (att) {
      const filePath = path.join(UPLOAD_DIR, att.filePath);
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      await db.delete(attachmentsTable).where(eq(attachmentsTable.id, id));
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete attachment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
