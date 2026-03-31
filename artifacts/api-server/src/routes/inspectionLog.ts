import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { inspectionLogTable } from "@workspace/db/schema";
import { eq, desc, and, like } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "IL-" + String(id).padStart(3, "0");
}

router.get("/", async (req, res) => {
  try {
    const { zone, status } = req.query as Record<string, string>;
    const conditions = [];
    if (zone) conditions.push(like(inspectionLogTable.zone, `${zone}%`));
    if (status) conditions.push(eq(inspectionLogTable.status, status));

    const items = await db
      .select()
      .from(inspectionLogTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(inspectionLogTable.createdAt));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list inspection entries");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db
      .insert(inspectionLogTable)
      .values({ ...body, itemCode: "IL-000" })
      .returning();

    const [updated] = await db
      .update(inspectionLogTable)
      .set({ itemCode: genCode(created.id) })
      .where(eq(inspectionLogTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create inspection entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(inspectionLogTable)
      .where(eq(inspectionLogTable.id, id));

    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get inspection entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(inspectionLogTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(inspectionLogTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update inspection entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(inspectionLogTable).where(eq(inspectionLogTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete inspection entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
