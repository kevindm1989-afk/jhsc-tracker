import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { workerStatementsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "W-" + String(id).padStart(3, "0");
}

router.get("/", async (req, res) => {
  try {
    const { status, department } = req.query as Record<string, string>;
    const conditions = [];
    if (status) conditions.push(eq(workerStatementsTable.status, status));
    if (department) conditions.push(eq(workerStatementsTable.department, department));

    const items = await db
      .select()
      .from(workerStatementsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(workerStatementsTable.createdAt));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list worker statements");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db
      .insert(workerStatementsTable)
      .values({ ...body, statementCode: "W-000" })
      .returning();

    const [updated] = await db
      .update(workerStatementsTable)
      .set({ statementCode: genCode(created.id) })
      .where(eq(workerStatementsTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create worker statement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(workerStatementsTable)
      .where(eq(workerStatementsTable.id, id));

    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get worker statement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(workerStatementsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(workerStatementsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update worker statement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(workerStatementsTable).where(eq(workerStatementsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete worker statement");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
