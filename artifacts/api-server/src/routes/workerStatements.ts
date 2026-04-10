import { validate, workerStatementSchema } from "../lib/validation";
import { validate, workerStatementSchema } from "../lib/validation";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { workerStatementsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "W-" + String(id).padStart(3, "0");
}

function requireWorkerRepAccess(req: Request, res: Response, next: NextFunction) {
  const role = req.session?.role;
  if (role === "admin" || role === "worker-rep") return next();
  return res.status(403).json({ error: "Worker statements are confidential. Access restricted to Worker Co-Chair and Admin per OHSA s.8." });
}

router.get("/", requireWorkerRepAccess, async (req, res) => {
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

router.post("/", requireWorkerRepAccess, validate(workerStatementSchema), async (req, res) => {
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

router.get("/:id", requireWorkerRepAccess, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [item] = await db
      .select()
      .from(workerStatementsTable)
      .where(eq(workerStatementsTable.id, id));

    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get worker statement");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireWorkerRepAccess, validate(workerStatementSchema.partial()), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const body = req.body;

    const [updated] = await db
      .update(workerStatementsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(workerStatementsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update worker statement");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireWorkerRepAccess, async (req, res) => {
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
