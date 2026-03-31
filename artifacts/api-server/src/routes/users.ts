import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAuth";
import "../sessionTypes";

const router: IRouter = Router();

const ALL_PERMISSIONS = [
  "dashboard",
  "action-items",
  "hazard-findings",
  "inspection-log",
  "conduct-inspection",
  "worker-statements",
  "import-data",
];

// GET /api/users — list all users (admin only)
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
        permissions: usersTable.permissions,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable);
    res.json(users);
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// GET /api/users/permissions — return the list of valid permissions
router.get("/permissions", requireAdmin, (_req, res) => {
  res.json(ALL_PERMISSIONS);
});

// POST /api/users — create a new member user (admin only)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { username, displayName, password, role, permissions } = req.body as {
      username: string;
      displayName: string;
      password: string;
      role: "admin" | "member";
      permissions: string[];
    };

    if (!username || !displayName || !password) {
      return res.status(400).json({ error: "Username, display name, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [created] = await db
      .insert(usersTable)
      .values({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        passwordHash,
        role: role || "member",
        permissions: (permissions || []).filter((p) => ALL_PERMISSIONS.includes(p)),
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
        permissions: usersTable.permissions,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /api/users/:id — update a user (admin only)
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { displayName, role, permissions, password } = req.body as {
      displayName?: string;
      role?: "admin" | "member";
      permissions?: string[];
      password?: string;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (displayName) updates.displayName = displayName.trim();
    if (role) updates.role = role;
    if (permissions) {
      updates.permissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      updates.passwordHash = await bcrypt.hash(password, 12);
    }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
        permissions: usersTable.permissions,
        createdAt: usersTable.createdAt,
      });

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id — delete a user (admin only, cannot delete last admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (target.role === "admin") {
      const otherAdmins = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(ne(usersTable.id, id));
      const hasOtherAdmin = otherAdmins.some((u) => u.id !== id);
      // re-check properly
      const allAdmins = await db
        .select({ id: usersTable.id, role: usersTable.role })
        .from(usersTable);
      const adminCount = allAdmins.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin account" });
      }
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
