import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { registrationsTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAuth";
import { getUncachableResendClient } from "../resendClient";
import "../sessionTypes";

const router: IRouter = Router();

const DEFAULT_MEMBER_PERMISSIONS = [
  "dashboard",
  "action-items",
  "hazard-findings",
  "inspection-log",
  "conduct-inspection",
  "worker-statements",
  "documents",
];

// GET /api/registrations — admin only, list all registrations
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(registrationsTable)
      .orderBy(desc(registrationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("Fetch registrations error:", err);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

// PATCH /api/registrations/:id — admin only, approve or decline
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt((req.params as Record<string, string>).id, 10);
    const { action, reviewNote, permissions } = req.body as {
      action: "approve" | "decline";
      reviewNote?: string;
      permissions?: string[];
    };

    if (action !== "approve" && action !== "decline") {
      return res.status(400).json({ error: "action must be 'approve' or 'decline'" });
    }

    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.id, id));

    if (!reg) return res.status(404).json({ error: "Registration not found" });
    if (reg.status !== "pending") {
      return res.status(409).json({ error: "Registration has already been reviewed" });
    }

    if (action === "approve") {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, reg.username));

      if (existing.length > 0) {
        return res.status(409).json({ error: "Username is already taken" });
      }

      const grantedPermissions = Array.isArray(permissions) && permissions.length >= 0
        ? permissions.filter((p) => DEFAULT_MEMBER_PERMISSIONS.includes(p))
        : DEFAULT_MEMBER_PERMISSIONS;

      await db.insert(usersTable).values({
        username: reg.username,
        displayName: reg.name,
        passwordHash: reg.passwordHash,
        role: "member",
        permissions: grantedPermissions,
      });
    }

    await db
      .update(registrationsTable)
      .set({ status: action === "approve" ? "approved" : "declined", reviewNote: reviewNote ?? null })
      .where(eq(registrationsTable.id, id));

    res.json({ success: true });
  } catch (err) {
    console.error("Review registration error:", err);
    res.status(500).json({ error: "Failed to update registration" });
  }
});

export default router;
