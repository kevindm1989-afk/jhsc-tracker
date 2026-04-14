import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { rightToRefuseTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function genCode(id: number) {
  return "RTR-" + String(id).padStart(3, "0");
}

function isAdminOrCoChair(req: Request) {
  const role = req.session?.role;
  return role === "admin" || role === "co-chair";
}

router.get("/", async (req, res) => {
  try {
    const query = db.select().from(rightToRefuseTable);

    let items;
    if (isAdminOrCoChair(req)) {
      items = await query.orderBy(desc(rightToRefuseTable.createdAt));
    } else {
      const username = req.session?.username || req.session?.displayName || "";
      items = await query
        .where(eq(rightToRefuseTable.loggedBy, username))
        .orderBy(desc(rightToRefuseTable.createdAt));
    }

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list right-to-refuse records");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const loggedBy = req.session?.username || req.session?.displayName || "Unknown";
    const lockedAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [created] = await db
      .insert(rightToRefuseTable)
      .values({ ...body, refuseCode: "RTR-000", loggedBy, lockedAt })
      .returning();

    const [updated] = await db
      .update(rightToRefuseTable)
      .set({ refuseCode: genCode(created.id) })
      .where(eq(rightToRefuseTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create right-to-refuse record");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(rightToRefuseTable).where(eq(rightToRefuseTable.id, id));

    if (!existing) return res.status(404).json({ error: "Not found" });

    if (!isAdminOrCoChair(req)) {
      const username = req.session?.username || req.session?.displayName || "";
      if (existing.loggedBy !== username) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    if (existing.lockedAt && new Date() > new Date(existing.lockedAt)) {
      return res.status(403).json({ error: "Record is locked — cannot be edited after 24 hours" });
    }

    const [updated] = await db
      .update(rightToRefuseTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(rightToRefuseTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update right-to-refuse record");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
