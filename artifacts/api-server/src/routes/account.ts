import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  suggestionsTable,
  healthSafetyReportsTable,
  chatMessagesTable,
  pushTokensTable,
  memberActionsTable,
} from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { PRIVACY_POLICY_VERSION } from "../lib/privacy";
import "../sessionTypes";

const router: Router = Router();

// POST /api/account/consent — record acceptance of the current privacy policy.
// Used both for new logins and when the policy version changes (re-consent).
router.post("/consent", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const { accept } = req.body as { accept?: boolean };
  if (accept !== true) {
    return res.status(400).json({ error: "Consent must be explicitly accepted." });
  }

  try {
    const now = new Date();
    await db
      .update(usersTable)
      .set({
        consentAcceptedAt: now,
        consentVersion: PRIVACY_POLICY_VERSION,
        updatedAt: now,
      })
      .where(eq(usersTable.id, userId));

    return res.json({
      success: true,
      consentAcceptedAt: now,
      consentVersion: PRIVACY_POLICY_VERSION,
    });
  } catch (err) {
    console.error("Consent recording error:", err);
    return res.status(500).json({ error: "Failed to record consent" });
  }
});

// GET /api/account/export — PIPEDA right of access. Returns a JSON file
// containing every record the system holds linked to the authenticated user.
router.get("/export", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        email: usersTable.email,
        role: usersTable.role,
        permissions: usersTable.permissions,
        consentAcceptedAt: usersTable.consentAcceptedAt,
        consentVersion: usersTable.consentVersion,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return res.status(404).json({ error: "User not found" });

    const [suggestions, reports, chatMessages, pushTokens, memberActions] =
      await Promise.all([
        db
          .select()
          .from(suggestionsTable)
          .where(eq(suggestionsTable.submittedByUserId, userId)),
        db
          .select()
          .from(healthSafetyReportsTable)
          .where(eq(healthSafetyReportsTable.submittedByUserId, userId)),
        db
          .select()
          .from(chatMessagesTable)
          .where(eq(chatMessagesTable.userId, userId)),
        db
          .select()
          .from(pushTokensTable)
          .where(eq(pushTokensTable.userId, userId)),
        db
          .select()
          .from(memberActionsTable)
          .where(
            or(
              eq(memberActionsTable.createdByUserId, userId),
              eq(memberActionsTable.assignedToUserId, userId),
            ),
          ),
      ]);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      account: user,
      suggestions,
      healthAndSafetyReports: reports,
      chatMessages,
      pushNotificationTokens: pushTokens.map((t) => ({
        id: t.id,
        createdAt: (t as any).createdAt ?? null,
        endpointPreview: typeof (t as any).endpoint === "string"
          ? (t as any).endpoint.slice(0, 80) + "…"
          : null,
      })),
      memberActions,
      note:
        "This export contains every record this app has linked to your user account. " +
        "Anonymous submissions cannot be included because they are not linked to any user. " +
        "Records authored by you but stored only with a display-name (worker statements, " +
        "meeting minutes, inspections) are not included automatically — contact the Worker " +
        "Co-Chair to request copies of those.",
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="jhsc-advisor-data-${user.username}-${Date.now()}.json"`,
    );
    return res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    console.error("Account export error:", err);
    return res.status(500).json({ error: "Failed to export account data" });
  }
});

// DELETE /api/account — self-service account deletion
// Removes the authenticated user's account and all personally identifying
// records linked to them. OHSA-relevant records (suggestions, reports,
// member actions) are anonymised rather than deleted so committee records
// are preserved. Anonymous submissions are never touched.
router.delete("/", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "admin") {
      return res.status(403).json({
        error: "Admin accounts cannot be self-deleted. Ask another administrator to remove your account.",
      });
    }

    // Anonymise suggestions — preserve content for JHSC records
    await db
      .update(suggestionsTable)
      .set({ submittedByUserId: null, submittedByName: "Deleted Member" })
      .where(eq(suggestionsTable.submittedByUserId, userId));

    // Anonymise health & safety report submissions
    await db
      .update(healthSafetyReportsTable)
      .set({ submittedByUserId: null, submittedByName: "Deleted Member" })
      .where(eq(healthSafetyReportsTable.submittedByUserId, userId));

    // Anonymise member actions created by this user (preserve operational record)
    await db
      .update(memberActionsTable)
      .set({ createdByName: "Deleted Member" })
      .where(eq(memberActionsTable.createdByUserId, userId));

    // Delete chat messages — personal communications, not OHSA records
    await db
      .delete(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, userId));

    // Delete push notification tokens
    await db
      .delete(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));

    // Delete the user record (password_reset_tokens cascade automatically)
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    // Destroy the session
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");

    return res.json({
      success: true,
      message: "Your account and personal records have been deleted.",
    });
  } catch (err) {
    console.error("Account deletion error:", err);
    return res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
