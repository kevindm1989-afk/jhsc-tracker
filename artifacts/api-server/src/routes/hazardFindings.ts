import { validate, hazardFindingSchema } from "../lib/validation";
import { validate, hazardFindingSchema } from "../lib/validation";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hazardFindingsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "HF-" + String(id).padStart(3, "0");
}

router.get("/", async (req, res) => {
  try {
    const { status, department } = req.query as Record<string, string>;
    const conditions = [];
    if (status) conditions.push(eq(hazardFindingsTable.status, status));
    if (department) conditions.push(eq(hazardFindingsTable.department, department));

    const items = await db
      .select()
      .from(hazardFindingsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(hazardFindingsTable.createdAt));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list hazard findings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", validate(hazardFindingSchema), async (req, res) => {
  try {
    const body = req.body;
    const [created] = await db
      .insert(hazardFindingsTable)
      .values({ ...body, itemCode: "HF-000" })
      .returning();

    const [updated] = await db
      .update(hazardFindingsTable)
      .set({ itemCode: genCode(created.id) })
      .where(eq(hazardFindingsTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create hazard finding");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(hazardFindingsTable)
      .where(eq(hazardFindingsTable.id, id));

    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get hazard finding");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", validate(hazardFindingSchema.partial()), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(hazardFindingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(hazardFindingsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update hazard finding");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(hazardFindingsTable).where(eq(hazardFindingsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete hazard finding");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
