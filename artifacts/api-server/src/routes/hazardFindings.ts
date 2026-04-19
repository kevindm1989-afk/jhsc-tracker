import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hazardFindingsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

const CLOSED_STATUSES = ["Resolved", "Closed", "Accepted", "Rejected"];

function genCode(id: number) {
  return "HF-" + String(id).padStart(3, "0");
}

/** Add 21 days to a YYYY-MM-DD string and return YYYY-MM-DD */
function add21Days(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
}

/** Attach isOverdue and dueSoon to each row without altering the DB */
function annotate(items: (typeof hazardFindingsTable.$inferSelect)[]) {
  const todayStr = new Date().toISOString().slice(0, 10);

  return items.map((item) => {
    const isClosed = CLOSED_STATUSES.includes(item.status);
    const deadline = item.responseDeadline ?? null;

    const isOverdue =
      !isClosed && !!deadline && deadline < todayStr;

    const dueSoonDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    })();
    const isDueSoon =
      !isClosed && !isOverdue && !!deadline &&
      deadline >= todayStr && deadline <= dueSoonDate;

    return { ...item, isOverdue, isDueSoon };
  });
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

    res.json(annotate(items));
  } catch (err) {
    req.log.error({ err }, "Failed to list hazard findings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // Auto-set responseDeadline to 21 days from recommendationDate (OHSA s.9(21))
    const baseDate = body.recommendationDate || new Date().toISOString().slice(0, 10);
    const responseDeadline =
      body.responseDeadline && body.responseDeadline.trim()
        ? body.responseDeadline
        : add21Days(baseDate);

    const [created] = await db
      .insert(hazardFindingsTable)
      .values({ ...body, responseDeadline, itemCode: "HF-000" })
      .returning();

    const [updated] = await db
      .update(hazardFindingsTable)
      .set({ itemCode: genCode(created.id) })
      .where(eq(hazardFindingsTable.id, created.id))
      .returning();

    res.status(201).json(annotate([updated])[0]);
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
    return res.json(annotate([item])[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get hazard finding");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const [updated] = await db
      .update(hazardFindingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(hazardFindingsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(annotate([updated])[0]);
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
