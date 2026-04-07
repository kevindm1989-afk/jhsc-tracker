import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { registrationsTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAuth";
import { createTransporter, getSenderAddress } from "../emailClient";
import "../sessionTypes";

const router: IRouter = Router();

const DEFAULT_MEMBER_PERMISSIONS = [
  "dashboard",
  "action-items",
  "member-actions",
  "health-safety-report",
  "hs-reports-log",
  "hazard-findings",
  "inspection-log",
  "conduct-inspection",
  "worker-statements",
  "import-data",
  "suggestions",
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
        email: reg.email ?? "",
        role: "member",
        permissions: grantedPermissions,
      });
    }

    await db
      .update(registrationsTable)
      .set({ status: action === "approve" ? "approved" : "declined", reviewNote: reviewNote ?? null })
      .where(eq(registrationsTable.id, id));

    if (action === "approve" && reg.email) {
      try {
        const transporter = createTransporter();
        const fromEmail = getSenderAddress();
        await transporter.sendMail({
          from: fromEmail,
          to: reg.email,
          subject: "Your JHSC Co-Chair Tracker access has been approved",
          html: `
            <p>Hi ${reg.name},</p>
            <p>Your request for access to the <strong>JHSC Co-Chair Tracker</strong> has been <strong>approved</strong>.</p>
            <p>You can now sign in using your username: <strong>${reg.username}</strong></p>
            <p>If you have any questions, please contact your JHSC Co-Chair.</p>
            <br/>
            <p style="font-size:12px;color:#888;">JHSC Co-Chair Tracker</p>
          `,
        });
      } catch (emailErr) {
        console.error("Approval email send error (non-fatal):", emailErr);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Review registration error:", err);
    res.status(500).json({ error: "Failed to update registration" });
  }
});

export default router;
