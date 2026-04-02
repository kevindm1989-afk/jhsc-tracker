import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { actionItemsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "AI-" + String(id).padStart(3, "0");
}

router.get("/", async (req, res) => {
  try {
    const { status, department } = req.query as Record<string, string>;
    const conditions = [];
    if (status) conditions.push(eq(actionItemsTable.status, status));
    if (department) conditions.push(eq(actionItemsTable.department, department));

    const items = await db
      .select()
      .from(actionItemsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(actionItemsTable.createdAt));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list action items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db
      .insert(actionItemsTable)
      .values({ ...body, itemCode: "AI-000" })
      .returning();

    const [updated] = await db
      .update(actionItemsTable)
      .set({ itemCode: genCode(created.id) })
      .where(eq(actionItemsTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create action item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(actionItemsTable)
      .where(eq(actionItemsTable.id, id));

    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get action item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(actionItemsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(actionItemsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update action item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(actionItemsTable).where(eq(actionItemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete action item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/verify", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(actionItemsTable).where(eq(actionItemsTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.status !== "Closed") {
      return res.status(400).json({ error: "Only closed items can be verified" });
    }

    const user = (req as any).user;
    const verifiedBy = user?.name || user?.email || "Unknown";

    const [updated] = await db
      .update(actionItemsTable)
      .set({ verifiedAt: new Date(), verifiedBy, updatedAt: new Date() })
      .where(eq(actionItemsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to verify action item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
