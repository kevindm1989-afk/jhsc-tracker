import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, passwordResetTokensTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAuth";
import { createTransporter, getSenderAddress } from "../emailClient";
import "../sessionTypes";

const router: IRouter = Router();

const ALL_PERMISSIONS = [
  "dashboard",
  "action-items",
  "member-actions",
  "health-safety-report",
  "hs-reports-log",
  "hazard-findings",
  "inspection-log",
  "conduct-inspection",
  "worker-statements",
  "suggestions",
  "files",
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
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, displayName, password, role, permissions } = req.body as {
      username: string;
      displayName: string;
      password: string;
      role: "admin" | "co-chair" | "member" | "worker-rep";
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

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error("Create user error:", err);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /api/users/:id — update a user (admin only)
router.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { displayName, email, role, permissions, password } = req.body as {
      displayName?: string;
      email?: string;
      role?: "admin" | "co-chair" | "member" | "worker-rep";
      permissions?: string[];
      password?: string;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (displayName) updates.displayName = displayName.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
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

    return res.json(updated);
  } catch (err) {
    console.error("Update user error:", err);
    return res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id — delete a user (admin only, cannot delete last admin)
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (target.role === "admin") {
      const allAdmins = await db
        .select({ id: usersTable.id, role: usersTable.role })
        .from(usersTable);
      const adminCount = allAdmins.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin account" });
      }
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

// POST /api/users/:id/send-reset-email — admin sends a password reset link to a user
router.post("/:id/send-reset-email", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.email) return res.status(400).json({ error: "This user has no email address on file" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    const basePath = (process.env.BASE_PATH || "").replace(/\/$/, "");
    const resetUrl = `${proto}://${host}${basePath}/reset-password?token=${token}`;

    const transporter = createTransporter();
    const from = getSenderAddress();
    await transporter.sendMail({
      from,
      to: user.email,
      subject: "Reset your JHSC Tracker password",
      html: `
        <p>Hi ${user.displayName},</p>
        <p>An administrator has sent you a password reset link for the <strong>JHSC Tracker</strong>.</p>
        <p><a href="${resetUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:12px 0;">Reset Password</a></p>
        <p>Or copy this link into your browser:</p>
        <p style="word-break:break-all;font-size:13px;color:#555;">${resetUrl}</p>
        <p>This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
        <br/>
        <p style="font-size:12px;color:#888;">JHSC Tracker</p>
      `,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Send reset email error:", err);
    return res.status(500).json({ error: "Failed to send reset email" });
  }
});

export default router;
