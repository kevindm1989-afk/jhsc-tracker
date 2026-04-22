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
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import "../sessionTypes";

const router: Router = Router();

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
