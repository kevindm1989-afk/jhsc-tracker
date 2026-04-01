import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { memberActionsTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAuth";
import "../sessionTypes";

const router: IRouter = Router();

function genCode(id: number) {
  return "MA-" + String(id).padStart(3, "0");
}

// GET /api/member-actions — admins see all; members see their own
router.get("/", async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const rows = await db
      .select()
      .from(memberActionsTable)
      .where(user.role === "admin" ? undefined : eq(memberActionsTable.assignedToUserId, user.id))
      .orderBy(desc(memberActionsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list member actions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/member-actions — admin only
router.post("/", requireAdmin, async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body;

    // Look up the assigned user's display name
    const [assignee] = await db
      .select({ id: usersTable.id, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, body.assignedToUserId));

    if (!assignee) return res.status(400).json({ error: "Assigned user not found" });

    const [created] = await db
      .insert(memberActionsTable)
      .values({
        actionCode: "MA-000",
        title: body.title,
        type: body.type,
        assignedToUserId: assignee.id,
        assignedToName: assignee.displayName,
        zone: body.zone ?? null,
        dueDate: body.dueDate ?? null,
        status: "pending",
        notes: body.notes ?? null,
        relatedItemCode: body.relatedItemCode ?? null,
        createdByUserId: user.id,
        createdByName: user.displayName,
      })
      .returning();

    const [updated] = await db
      .update(memberActionsTable)
      .set({ actionCode: genCode(created.id) })
      .where(eq(memberActionsTable.id, created.id))
      .returning();

    res.status(201).json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to create member action");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/member-actions/:id — admin OR the assigned user
router.put("/:id", async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(memberActionsTable)
      .where(eq(memberActionsTable.id, id));

    if (!existing) return res.status(404).json({ error: "Not found" });

    // Only admin or the assigned user can update
    if (user.role !== "admin" && existing.assignedToUserId !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = req.body;
    const updates: Partial<typeof memberActionsTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Members can only update status and notes
    if (user.role === "admin") {
      if (body.title !== undefined) updates.title = body.title;
      if (body.type !== undefined) updates.type = body.type;
      if (body.zone !== undefined) updates.zone = body.zone ?? null;
      if (body.dueDate !== undefined) updates.dueDate = body.dueDate || null;
      if (body.relatedItemCode !== undefined) updates.relatedItemCode = body.relatedItemCode || null;
      if (body.assignedToUserId !== undefined) {
        const [assignee] = await db
          .select({ id: usersTable.id, displayName: usersTable.displayName })
          .from(usersTable)
          .where(eq(usersTable.id, body.assignedToUserId));
        if (assignee) {
          updates.assignedToUserId = assignee.id;
          updates.assignedToName = assignee.displayName;
        }
      }
    }

    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed" && !existing.completedAt) {
        updates.completedAt = new Date();
      } else if (body.status !== "completed") {
        updates.completedAt = null;
      }
    }
    if (body.notes !== undefined) updates.notes = body.notes || null;

    const [updated] = await db
      .update(memberActionsTable)
      .set(updates)
      .where(eq(memberActionsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update member action");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/member-actions/:id — admin only
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(memberActionsTable).where(eq(memberActionsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete member action");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
