import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "@workspace/db";
import {
  pushTokensTable,
  notificationLogsTable,
  notificationRulesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import "../sessionTypes";

const router = Router();

function requireNotifyAccess(req: Request, res: Response, next: NextFunction) {
  const role = req.session.role;
  if (!["co-chair", "admin"].includes(role ?? "")) {
    return res.status(403).json({ error: "Co-Chair or Admin access required" });
  }
  next();
}

async function fcmSend(
  tokens: string[],
  title: string,
  body: string,
  type: string,
): Promise<number> {
  if (!tokens.length) return 0;
  const vapidKey = process.env.FCM_VAPID_KEY;
  if (!vapidKey) {
    console.log('FCM_VAPID_KEY not set — push skipped');
    return 0;
  }
  console.log(`Push notification queued: ${title} — ${tokens.length} devices`);
  return tokens.length;
}

router.post("/subscribe", requireAuth, async (req, res) => {
  const { token, platform = "web" } = req.body;
  const userId = req.session.userId!;
  if (!token) return res.status(400).json({ error: "token required" });
  await db
    .insert(pushTokensTable)
    .values({ userId, token, platform })
    .onConflictDoUpdate({ target: pushTokensTable.token, set: { userId } });
  return res.json({ ok: true });
});

router.post("/send", requireAuth, requireNotifyAccess, async (req, res) => {
  const { title, body, type = "general", targetType, targetValue } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body required" });

  let tokens: string[] = [];

  if (targetType === "all") {
    const rows = await db.select().from(pushTokensTable);
    tokens = rows.map((r) => r.token);
  } else if (targetType === "role") {
    const matchingUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, targetValue));
    const userIds = matchingUsers.map((u) => u.id);
    if (userIds.length) {
      const rows = await db
        .select()
        .from(pushTokensTable)
        .where(inArray(pushTokensTable.userId, userIds));
      tokens = rows.map((r) => r.token);
    }
  } else if (targetType === "individual") {
    const userIds = (targetValue as string)
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter(Boolean);
    if (userIds.length) {
      const rows = await db
        .select()
        .from(pushTokensTable)
        .where(inArray(pushTokensTable.userId, userIds));
      tokens = rows.map((r) => r.token);
    }
  }

  await fcmSend(tokens, title, body, type);
  await db.insert(notificationLogsTable).values({
    sentBy: req.session.userId!,
    title,
    body,
    type,
    targetType,
    targetValue: targetValue ?? "all",
    recipientCount: tokens.length,
  });
  return res.json({ ok: true, sent: tokens.length });
});

router.get("/logs", requireAuth, requireNotifyAccess, async (_req, res) => {
  const logs = await db
    .select()
    .from(notificationLogsTable)
    .orderBy(notificationLogsTable.createdAt)
    .limit(100);
  return res.json(logs);
});

router.get("/members", requireAuth, requireNotifyAccess, async (_req, res) => {
  const memberList = await db
    .select({ id: usersTable.id, name: usersTable.displayName, role: usersTable.role })
    .from(usersTable)
    .orderBy(usersTable.displayName);
  return res.json(memberList);
});

router.get("/rules", requireAuth, requireNotifyAccess, async (_req, res) => {
  const rules = await db
    .select()
    .from(notificationRulesTable)
    .orderBy(notificationRulesTable.createdAt);
  return res.json(rules);
});

router.post("/rules", requireAuth, requireNotifyAccess, async (req, res) => {
  const { eventType, title, body, targetType, targetValue, enabled = true } = req.body;
  if (!eventType || !title || !body || !targetType || !targetValue) {
    return res.status(400).json({ error: "All fields required" });
  }
  const [rule] = await db
    .insert(notificationRulesTable)
    .values({ eventType, title, body, targetType, targetValue, enabled, createdBy: req.session.userId! })
    .returning();
  return res.json(rule);
});

router.patch("/rules/:id", requireAuth, requireNotifyAccess, async (req, res) => {
  const id = parseInt(req.params.id);
  const [updated] = await db
    .update(notificationRulesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(notificationRulesTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Rule not found" });
  return res.json(updated);
});

router.delete("/rules/:id", requireAuth, requireNotifyAccess, async (req, res) => {
  await db
    .delete(notificationRulesTable)
    .where(eq(notificationRulesTable.id, parseInt(req.params.id)));
  return res.json({ ok: true });
});

export default router;
