import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "@workspace/db";
import { chatMessagesTable, usersTable } from "@workspace/db/schema";
import { eq, desc, ne, and, inArray } from "drizzle-orm";
import { publishToChannel } from "../lib/ably";
import Ably from "ably";
import nodemailer from "nodemailer";
import "../sessionTypes";

const router = Router();

const JHSC_ROLES = ["co-chair", "admin", "worker-rep"];

/**
 * Returns the set of roles a user is allowed to DM based on their own role.
 * Null means no restriction (can DM anyone).
 */
function getAllowedDMRoles(myRole: string): string[] | null {
  if (myRole === "member") return ["admin"];
  if (myRole === "worker-rep") return ["worker-rep", "admin"];
  return null; // admin, co-chair, management — unrestricted
}

/**
 * Check whether myRole is allowed to DM a user with targetRole.
 */
function canDM(myRole: string, targetRole: string): boolean {
  const allowed = getAllowedDMRoles(myRole);
  if (allowed === null) return true;
  return allowed.includes(targetRole);
}

function dmChannelName(idA: number, idB: number): string {
  return `dm:${Math.min(idA, idB)}-${Math.max(idA, idB)}`;
}

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
    "chat:dm:*": ["subscribe", "publish", "presence"],
    "global:presence": ["subscribe", "presence"],
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

router.get("/members", requireAuth, async (req, res) => {
  const selfId = req.session.userId!;
  const myRole = req.session.role ?? "member";
  const allowedRoles = getAllowedDMRoles(myRole);

  let users;
  if (allowedRoles === null) {
    users = await db
      .select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
      .from(usersTable)
      .where(ne(usersTable.id, selfId));
  } else {
    users = await db
      .select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
      .from(usersTable)
      .where(and(ne(usersTable.id, selfId), inArray(usersTable.role, allowedRoles)));
  }
  return res.json(users);
});

router.get("/dm/:otherUserId/history", requireAuth, async (req, res) => {
  const otherUserId = parseInt(req.params.otherUserId, 10);
  if (isNaN(otherUserId)) return res.status(400).json({ error: "Invalid user id" });

  const [other] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, otherUserId));
  if (!other || !canDM(req.session.role ?? "member", other.role)) {
    return res.status(403).json({ error: "You are not allowed to message this user." });
  }

  const channel = dmChannelName(req.session.userId!, otherUserId);
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.channel, channel))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(50);
  return res.json(messages.reverse());
});

router.post("/dm/:otherUserId/send", requireAuth, async (req, res) => {
  const otherUserId = parseInt(req.params.otherUserId, 10);
  if (isNaN(otherUserId)) return res.status(400).json({ error: "Invalid user id" });
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });

  const [other] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, otherUserId));
  if (!other || !canDM(req.session.role ?? "member", other.role)) {
    return res.status(403).json({ error: "You are not allowed to message this user." });
  }

  const channel = dmChannelName(req.session.userId!, otherUserId);
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

router.post("/dm/:otherUserId/start", requireAuth, async (req, res) => {
  const otherUserId = parseInt(req.params.otherUserId, 10);
  if (isNaN(otherUserId)) return res.status(400).json({ error: "Invalid user id" });

  const [otherCheck] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, otherUserId));
  if (!otherCheck || !canDM(req.session.role ?? "member", otherCheck.role)) {
    return res.status(403).json({ error: "You are not allowed to message this user." });
  }

  const apiKey = process.env.ABLY_API_KEY;
  let isOnline = false;

  if (apiKey) {
    try {
      const ablyRest = new Ably.Rest({ key: apiKey });
      const members = await ablyRest.channels.get("global:presence").presence.get();
      isOnline = members.some((m: any) => m.clientId === String(otherUserId));
    } catch (err) {
      console.error("Presence check failed:", err);
    }
  }

  if (!isOnline) {
    try {
      const [other] = await db
        .select({ email: usersTable.email, displayName: usersTable.displayName })
        .from(usersTable)
        .where(eq(usersTable.id, otherUserId));

      const senderName = req.session.displayName ?? req.session.username ?? "A team member";

      if (other?.email) {
        const gmailUser = process.env.GMAIL_USER?.trim();
        const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
        if (gmailUser && gmailPass) {
          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: { user: gmailUser, pass: gmailPass },
            tls: { rejectUnauthorized: false },
          });
          await transporter.sendMail({
            from: gmailUser,
            to: other.email,
            subject: `${senderName} sent you a direct message — JHSC Advisor`,
            html: `
              <p>Hi ${other.displayName},</p>
              <p><strong>${senderName}</strong> has sent you a direct message on <strong>JHSC Advisor</strong>.</p>
              <p>Log in to view and reply.</p>
              <br/>
              <p style="font-size:12px;color:#888;">JHSC Advisor</p>
            `,
          });
          console.log(`DM offline notification sent to ${other.email}`);
        } else {
          console.log(`DM started with user ${otherUserId} (offline, no email config)`);
        }
      }
    } catch (err) {
      console.error("DM offline notification error:", err);
    }
  }

  return res.json({ ok: true, online: isOnline });
});

export default router;
