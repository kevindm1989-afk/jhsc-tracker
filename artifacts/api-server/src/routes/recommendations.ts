import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { recommendationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "RC-" + String(id).padStart(3, "0");
}

function computeStatus(row: { responseReceived: string; escalationStatus: string; responseDeadline: string }): string {
  const today = new Date().toISOString().slice(0, 10);
  if (row.escalationStatus === "Escalated to MOL") return "Escalated";
  if (row.responseReceived === "Yes") {
    return row.responseOutcome === "Accepted" ? "Accepted" : row.responseOutcome === "Rejected" ? "Rejected" : "Responded";
  }
  if (row.responseDeadline < today) return "Overdue";
  return "Pending";
}

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(recommendationsTable).orderBy(desc(recommendationsTable.createdAt));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list recommendations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const dateIssued = body.dateIssued || new Date().toISOString().slice(0, 10);
    const ddl = new Date(dateIssued);
    ddl.setDate(ddl.getDate() + 21);
    const responseDeadline = body.responseDeadline || ddl.toISOString().slice(0, 10);

    const [created] = await db
      .insert(recommendationsTable)
      .values({ ...body, dateIssued, responseDeadline, recCode: "RC-000" })
      .returning();

    const [updated] = await db
      .update(recommendationsTable)
      .set({ recCode: genCode(created.id) })
      .where(eq(recommendationsTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create recommendation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(recommendationsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(recommendationsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update recommendation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(recommendationsTable).where(eq(recommendationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete recommendation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
