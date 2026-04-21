import { db } from "@workspace/db";
import { pushTokensTable, notificationRulesTable, usersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

async function fcmSend(tokens: string[], title: string, body: string, type: string) {
  if (!tokens.length) return;
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) return;
  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title, body, icon: "/icons/icon-192x192.png" },
      data: { type, click_action: "https://jhscadvisor.com" },
    }),
  });
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
        const matchingUsers = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.role, rule.targetValue));
        const userIds = matchingUsers.map((u) => u.id);
        if (userIds.length) {
          const rows = await db
            .select()
            .from(pushTokensTable)
            .where(inArray(pushTokensTable.userId, userIds));
          tokens = rows.map((r) => r.token);
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
