import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { publishToChannel } from "../lib/ably";
import Ably from "ably";
import "../sessionTypes";

const router = Router();

const JHSC_ROLES = ["co-chair", "admin", "worker-rep"];

router.get("/history/:channel", requireAuth, async (req, res) => {
  const { channel } = req.params;
  if (!["general", "jhsc"].includes(channel)) {
    return res.status(400).json({ error: "Invalid channel" });
  }
  if (channel === "jhsc" && !JHSC_ROLES.includes(req.session.role ?? "")) {
    return res.status(403).json({ error: "Access denied" });
  }
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.channel, channel))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(50);
  return res.json(messages.reverse());
});

router.post("/send", requireAuth, async (req, res) => {
  const { channel, message } = req.body;
  if (!["general", "jhsc"].includes(channel)) {
    return res.status(400).json({ error: "Invalid channel" });
  }
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });
  if (channel === "jhsc" && !JHSC_ROLES.includes(req.session.role ?? "")) {
    return res.status(403).json({ error: "Access denied" });
  }
  const [saved] = await db
    .insert(chatMessagesTable)
    .values({
      channel,
      userId: req.session.userId!,
      userName: req.session.displayName ?? req.session.username ?? "Member",
      message: message.trim(),
    })
    .returning();
  await publishToChannel(`chat:${channel}`, "message", saved);
  return res.json(saved);
});

router.get("/token", requireAuth, async (req, res) => {
  if (!process.env.ABLY_API_KEY) {
    return res.status(503).json({ error: "Chat service not configured" });
  }
  const client = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  const capabilities: Record<string, string[]> = {
    "chat:general": ["subscribe", "publish", "presence"],
  };
  if (JHSC_ROLES.includes(req.session.role ?? "")) {
    capabilities["chat:jhsc"] = ["subscribe", "publish", "presence"];
  }
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: String(req.session.userId),
    capability: capabilities,
  });
  return res.json(tokenRequest);
});

export default router;
