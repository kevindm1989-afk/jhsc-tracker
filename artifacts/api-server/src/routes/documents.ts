import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import "../sessionTypes";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.use(requireAuth);

const CreateDocumentBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  objectPath: z.string().min(1),
});

// GET /api/documents
router.get("/", async (req, res) => {
  try {
    const { category } = req.query as Record<string, string>;
    let docs = await db
      .select()
      .from(documentsTable)
      .orderBy(desc(documentsTable.createdAt));

    if (category && category !== "All") {
      docs = docs.filter((d) => d.category === category);
    }

    res.json(docs);
  } catch (err) {
    console.error("List documents error:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

// POST /api/documents — save metadata after successful upload
router.post("/", async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid document data", details: parsed.error.issues });
  }

  try {
    const [doc] = await db
      .insert(documentsTable)
      .values({
        ...parsed.data,
        description: parsed.data.description ?? null,
        uploadedBy: req.session.displayName ?? req.session.username ?? "Unknown",
      })
      .returning();

    res.status(201).json(doc);
  } catch (err) {
    console.error("Create document error:", err);
    res.status(500).json({ error: "Failed to save document record" });
  }
});

// DELETE /api/documents/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // Only admin or the uploader can delete
    if (req.session.role !== "admin" && doc.uploadedBy !== (req.session.displayName ?? req.session.username)) {
      return res.status(403).json({ error: "You can only delete your own documents" });
    }

    // Delete from GCS
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(doc.objectPath);
      await objectFile.delete();
    } catch (e) {
      if (!(e instanceof ObjectNotFoundError)) {
        console.warn("Could not delete object from storage:", e);
      }
    }

    await db.delete(documentsTable).where(eq(documentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Delete document error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
