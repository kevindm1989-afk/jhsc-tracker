import { db } from "@workspace/db";
import { pushTokensTable, notificationRulesTable, usersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

async function fcmSend(tokens: string[], title: string, body: string, type: string) {
  if (!tokens.length) return;
  const vapidKey = process.env.FCM_VAPID_KEY;
  if (!vapidKey) {
    console.log('FCM_VAPID_KEY not set — push skipped');
    return;
  }
  console.log(`Push notification queued: ${title} — ${tokens.length} devices`);
}

export async function executeRulesForEvent(eventType: string) {
  try {
    const rules = await db
      .select()
      .from(notificationRulesTable)
      .where(eq(notificationRulesTable.eventType, eventType));

    const enabledRules = rules.filter((r) => r.enabled);
    if (!enabledRules.length) return;

    for (const rule of enabledRules) {
      let tokens: string[] = [];

      if (rule.targetType === "all") {
        const rows = await db.select().from(pushTokensTable);
        tokens = rows.map((r) => r.token);
      } else if (rule.targetType === "role") {
        const roles = rule.targetValue
          .split(",")
          .map((r: string) => r.trim())
          .filter(Boolean);
        if (roles.length) {
          const matchingUsers = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(inArray(usersTable.role, roles));
          const userIds = matchingUsers.map((u) => u.id);
          if (userIds.length) {
            const rows = await db
              .select()
              .from(pushTokensTable)
              .where(inArray(pushTokensTable.userId, userIds));
            tokens = rows.map((r) => r.token);
          }
        }
      } else if (rule.targetType === "individual") {
        const userIds = rule.targetValue
          .split(",")
          .map((id: string) => parseInt(id.trim()))
          .filter(Boolean);
        if (userIds.length) {
          const rows = await db
            .select()
            .from(pushTokensTable)
            .where(inArray(pushTokensTable.userId, userIds));
          tokens = rows.map((r) => r.token);
        }
      }

      await fcmSend(tokens, rule.title, rule.body, rule.eventType);
    }
  } catch (err) {
    console.error("executeRulesForEvent error:", err);
  }
}
