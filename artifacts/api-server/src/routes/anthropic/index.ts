import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import "../../sessionTypes";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a helpful AI assistant for Unifor Local 1285's Joint Health & Safety Committee (JHSC) Tracker app. You help committee members, co-chairs, workers, and management with health and safety topics, Ontario Occupational Health and Safety Act (OHSA) questions, workplace safety best practices, writing inspection reports, drafting recommendations, understanding right-to-refuse procedures, and any general questions. Be concise, accurate, and supportive.`;

// GET /api/anthropic/conversations
router.get("/conversations", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(asc(conversations.createdAt));
    return res.json(rows.map(r => ({ id: r.id, title: r.title, createdAt: r.createdAt })));
  } catch (err) {
    console.error("List conversations error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/anthropic/conversations
router.post("/conversations", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { title } = req.body as { title: string };
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    const [conv] = await db
      .insert(conversations)
      .values({ userId, title: title.trim() })
      .returning();
    return res.status(201).json({ id: conv.id, title: conv.title, createdAt: conv.createdAt });
  } catch (err) {
    console.error("Create conversation error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/anthropic/conversations/:id
router.get("/conversations/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    if (!conv) return res.status(404).json({ error: "Not found" });
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    return res.json({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      messages: msgs,
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/anthropic/conversations/:id
router.delete("/conversations/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    if (!conv) return res.status(404).json({ error: "Not found" });
    await db.delete(conversations).where(eq(conversations.id, id));
    return res.status(204).send();
  } catch (err) {
    console.error("Delete conversation error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/anthropic/conversations/:id/messages
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    if (!conv) return res.status(404).json({ error: "Not found" });
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    return res.json(msgs);
  } catch (err) {
    console.error("List messages error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/anthropic/conversations/:id/messages  (SSE stream)
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const { content } = req.body as { content: string };
    if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    if (!conv) return res.status(404).json({ error: "Not found" });

    // Save user message
    await db.insert(messages).values({ conversationId: id, role: "user", content: content.trim() });

    // Load full message history for context
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    const chatMessages = history.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Save assistant response
    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  } catch (err) {
    console.error("Send message error:", err);
    res.write(`data: ${JSON.stringify({ error: "Failed to get AI response" })}\n\n`);
    res.end();
    return;
  }
});

export default router;
