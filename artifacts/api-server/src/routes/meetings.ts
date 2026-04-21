import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { meetingsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { sendNotification } from "../lib/notifications";
import { executeRulesForEvent } from "../lib/notify";

const router: IRouter = Router();

function isAdminOrCoChair(req: Request) {
  const role = req.session?.role;
  return role === "admin" || role === "co-chair";
}

function getUsername(req: Request) {
  return req.session?.displayName ?? req.session?.username ?? "Unknown";
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(meetingsTable)
      .orderBy(desc(meetingsTable.scheduledDate));
    res.json(items);
  } catch (err) {
    req.log?.error({ err }, "Failed to list meetings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  if (!isAdminOrCoChair(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
    const existing = await db
      .select({ code: meetingsTable.meetingCode })
      .from(meetingsTable);
    const seq = existing.length + 1;
    const meetingCode = `MTG-${datePart}-${String(seq).padStart(3, "0")}`;

    const body = req.body;
    const [meeting] = await db
      .insert(meetingsTable)
      .values({
        meetingCode,
        title: body.title,
        meetingType: body.meetingType ?? "Regular",
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        location: body.location,
        status: body.status ?? "Scheduled",
        agenda: body.agenda ?? [],
        postMeetingNotes: body.postMeetingNotes ?? null,
        createdBy: getUsername(req),
      })
      .returning();

    sendNotification("meeting", {
      title: meeting.title,
      meetingType: meeting.meetingType,
      scheduledDate: meeting.scheduledDate,
      scheduledTime: meeting.scheduledTime,
      location: meeting.location,
    }).catch(() => {});

    void executeRulesForEvent("meeting_scheduled");
    return res.status(201).json(meeting);
  } catch (err) {
    req.log?.error({ err }, "Failed to create meeting");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  if (!isAdminOrCoChair(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const id = parseInt(req.params.id as string);
    const body = req.body;
    const [updated] = await db
      .update(meetingsTable)
      .set({
        title: body.title,
        meetingType: body.meetingType,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        location: body.location,
        status: body.status,
        agenda: body.agenda,
        postMeetingNotes: body.postMeetingNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(meetingsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log?.error({ err }, "Failed to update meeting");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!isAdminOrCoChair(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(meetingsTable).where(eq(meetingsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Failed to delete meeting");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
