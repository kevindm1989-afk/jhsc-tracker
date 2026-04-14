import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { workerStatementsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "W-" + String(id).padStart(3, "0");
}

function isPrivileged(req: Request): boolean {
  const role = req.session?.role;
  return role === "admin" || role === "worker-rep" || role === "co-chair";
}

router.get("/", async (req, res) => {
  try {
    const { status, department } = req.query as Record<string, string>;
    const conditions = [];

    if (!isPrivileged(req)) {
      const username = req.session?.username;
      if (!username) return res.json([]);
      conditions.push(eq(workerStatementsTable.submittedBy, username));
    }

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
    const submittedBy = req.session?.username || "unknown";

    const insertData: any = {
      ...body,
      statementCode: "W-000",
      submittedBy,
    };

    // Non-privileged users cannot set status or notes — always default
    if (!isPrivileged(req)) {
      insertData.status = "Received";
      insertData.notes = null;
    }

    const [created] = await db
      .insert(workerStatementsTable)
      .values(insertData)
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

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [item] = await db
      .select()
      .from(workerStatementsTable)
      .where(eq(workerStatementsTable.id, id));

    if (!item) return res.status(404).json({ error: "Not found" });

    if (!isPrivileged(req) && item.submittedBy !== req.session?.username) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get worker statement");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const [existing] = await db
      .select()
      .from(workerStatementsTable)
      .where(eq(workerStatementsTable.id, id));

    if (!existing) return res.status(404).json({ error: "Not found" });

    if (!isPrivileged(req) && existing.submittedBy !== req.session?.username) {
      return res.status(403).json({ error: "Access denied" });
    }

    const body = { ...req.body };

    // Non-privileged users cannot update status or co-chair notes
    if (!isPrivileged(req)) {
      delete body.status;
      delete body.notes;
    }

    const [updated] = await db
      .update(workerStatementsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(workerStatementsTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update worker statement");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(workerStatementsTable)
      .where(eq(workerStatementsTable.id, id));

    if (!existing) return res.status(404).json({ error: "Not found" });

    if (!isPrivileged(req) && existing.submittedBy !== req.session?.username) {
      return res.status(403).json({ error: "Access denied" });
    }

    await db.delete(workerStatementsTable).where(eq(workerStatementsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete worker statement");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
