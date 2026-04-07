import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { recommendationsLogTable, attachmentsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const UPLOAD_DIR = process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads");
const REC_DIR = path.join(UPLOAD_DIR, "recommendations");
if (!fs.existsSync(REC_DIR)) fs.mkdirSync(REC_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REC_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const blocked = ["application/x-msdownload", "application/x-executable"];
    if (blocked.includes(file.mimetype)) cb(new Error("File type not allowed"));
    else cb(null, true);
  },
});

function genCode(id: number) {
  return "RL-" + String(id).padStart(4, "0");
}

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(recommendationsLogTable)
      .orderBy(desc(recommendationsLogTable.createdAt));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list recommendations log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", upload.array("files", 5), async (req, res) => {
  try {
    const { title, description, recommendationDate, dueDate, status, assignedTo, outcome } = req.body;
    if (!title || !recommendationDate) {
      return res.status(400).json({ error: "title and recommendationDate are required" });
    }
    const createdBy = req.session?.displayName || "Unknown";
    const [created] = await db
      .insert(recommendationsLogTable)
      .values({ title, description, recommendationDate, dueDate: dueDate || null, status: status || "Open", assignedTo: assignedTo || null, outcome: outcome || null, createdBy, recCode: "RL-0000" })
      .returning();

    await db
      .update(recommendationsLogTable)
      .set({ recCode: genCode(created.id) })
      .where(eq(recommendationsLogTable.id, created.id));

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      await db.insert(attachmentsTable).values(
        files.map((f) => ({
          parentType: "recommendation-log",
          parentId: created.id,
          fileName: f.originalname,
          filePath: path.join("recommendations", f.filename),
          mimeType: f.mimetype,
          fileSizeBytes: f.size,
          uploadedBy: createdBy,
        }))
      );
    }

    const [updated] = await db.select().from(recommendationsLogTable).where(eq(recommendationsLogTable.id, created.id));
    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create recommendation log entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, recommendationDate, dueDate, status, assignedTo, outcome } = req.body;
    await db
      .update(recommendationsLogTable)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(recommendationDate !== undefined && { recommendationDate }),
        ...(dueDate !== undefined && { dueDate: dueDate || null }),
        ...(status !== undefined && { status }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
        ...(outcome !== undefined && { outcome: outcome || null }),
        updatedAt: new Date(),
      })
      .where(eq(recommendationsLogTable.id, id));
    const [updated] = await db.select().from(recommendationsLogTable).where(eq(recommendationsLogTable.id, id));
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update recommendation log");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/attachments", upload.array("files", 5), async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const files = (req.files as Express.Multer.File[]) || [];
    const uploadedBy = req.session?.displayName || "Unknown";

    const existing = await db
      .select()
      .from(attachmentsTable)
      .where(and(eq(attachmentsTable.parentType, "recommendation-log"), eq(attachmentsTable.parentId, parentId)));

    if (existing.length + files.length > 10) {
      files.forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({ error: "Maximum 10 attachments per recommendation" });
    }

    const inserted = await db.insert(attachmentsTable).values(
      files.map((f) => ({
        parentType: "recommendation-log",
        parentId,
        fileName: f.originalname,
        filePath: path.join("recommendations", f.filename),
        mimeType: f.mimetype,
        fileSizeBytes: f.size,
        uploadedBy,
      }))
    ).returning();
    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to upload attachments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/attachments", async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const items = await db
      .select()
      .from(attachmentsTable)
      .where(and(eq(attachmentsTable.parentType, "recommendation-log"), eq(attachmentsTable.parentId, parentId)));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list attachments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const files = await db
      .select()
      .from(attachmentsTable)
      .where(and(eq(attachmentsTable.parentType, "recommendation-log"), eq(attachmentsTable.parentId, id)));
    files.forEach((f) => {
      const fp = path.join(UPLOAD_DIR, f.filePath);
      if (fs.existsSync(fp)) fs.unlink(fp, () => {});
    });
    await db.delete(attachmentsTable).where(and(eq(attachmentsTable.parentType, "recommendation-log"), eq(attachmentsTable.parentId, id)));
    await db.delete(recommendationsLogTable).where(eq(recommendationsLogTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete recommendation log entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
