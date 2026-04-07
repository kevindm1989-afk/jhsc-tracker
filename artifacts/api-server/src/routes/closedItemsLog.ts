import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { closedItemsLogTable } from "@workspace/db/schema";
import { eq, desc, and, ilike } from "drizzle-orm";
import "../sessionTypes";

const router: IRouter = Router();

function genCode(id: number) {
  return "CI-" + String(id).padStart(3, "0");
}

router.get("/", async (req, res) => {
  try {
    const { department, search } = req.query as Record<string, string>;
    const conditions = [];
    if (department) conditions.push(eq(closedItemsLogTable.department, department));
    if (search) conditions.push(ilike(closedItemsLogTable.description, `%${search}%`));

    const items = await db
      .select()
      .from(closedItemsLogTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(closedItemsLogTable.closedDate), desc(closedItemsLogTable.createdAt));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list closed items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db
      .insert(closedItemsLogTable)
      .values({ ...body, itemCode: "CI-000" })
      .returning();

    const [updated] = await db
      .update(closedItemsLogTable)
      .set({ itemCode: genCode(created.id) })
      .where(eq(closedItemsLogTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create closed item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(closedItemsLogTable)
      .where(eq(closedItemsLogTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get closed item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db
      .update(closedItemsLogTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(closedItemsLogTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update closed item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(closedItemsLogTable).where(eq(closedItemsLogTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete closed item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/assign", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { assignedVerifierId, assignedVerifierName } = req.body as {
      assignedVerifierId: number | null;
      assignedVerifierName: string | null;
    };
    const [updated] = await db
      .update(closedItemsLogTable)
      .set({ assignedVerifierId: assignedVerifierId ?? null, assignedVerifierName: assignedVerifierName ?? null, updatedAt: new Date() })
      .where(eq(closedItemsLogTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to assign verifier");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/verify", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(closedItemsLogTable).where(eq(closedItemsLogTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });

    const verifiedBy = req.session?.displayName ?? req.session?.username ?? "Unknown";

    const [updated] = await db
      .update(closedItemsLogTable)
      .set({ verifiedAt: new Date(), verifiedBy, updatedAt: new Date() })
      .where(eq(closedItemsLogTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to verify closed item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
