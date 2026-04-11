import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  actionItemsTable,
  hazardFindingsTable,
  inspectionLogTable,
  workerStatementsTable,
  healthSafetyReportsTable,
  closedItemsLogTable,
} from "@workspace/db/schema";
import { ne, and, lt, or, isNotNull, desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

router.get("/summary", async (req, res) => {
  try {
    const today = todayStr();
    const thisMonth = thisMonthStr();

    const [aiItems, hfItems, ilItems, wsItems, hsItems] = await Promise.all([
      db.select().from(actionItemsTable),
      db.select().from(hazardFindingsTable),
      db.select().from(inspectionLogTable),
      db.select().from(workerStatementsTable),
      db.select({ id: healthSafetyReportsTable.id }).from(healthSafetyReportsTable),
    ]);

    const isOverdue = (dueDate: string | null, status: string) =>
      status !== "Closed" && dueDate != null && dueDate < today;

    const overdueAI = aiItems.filter((i) => isOverdue(i.dueDate, i.status)).length;
    const overdueHF = hfItems.filter((i) => isOverdue(i.responseDeadline, i.status)).length;
    const overdueIL = ilItems.filter((i) => isOverdue(i.followUpDate, i.status)).length;

    const openAI = aiItems.filter((i) => i.status !== "Closed").length;
    const openHF = hfItems.filter((i) => i.status !== "Closed").length;

    const closedAI = aiItems.filter((i) => i.status === "Closed" && (i.closedDate || "").startsWith(thisMonth)).length;
    const closedHF = hfItems.filter((i) => i.status === "Closed" && (i.closedDate || "").startsWith(thisMonth)).length;
    const closedIL = ilItems.filter((i) => i.status === "Closed" && (i.closedDate || "").startsWith(thisMonth)).length;

    res.json({
      overdueCount: overdueAI + overdueHF + overdueIL,
      openActionItems: openAI,
      openHazardFindings: openHF,
      totalWorkerStatements: wsItems.length,
      totalHSReports: hsItems.length,
      closedThisMonth: closedAI + closedHF + closedIL,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/overdue", async (req, res) => {
  try {
    const today = todayStr();

    const [aiItems, hfItems, ilItems] = await Promise.all([
      db.select().from(actionItemsTable),
      db.select().from(hazardFindingsTable),
      db.select().from(inspectionLogTable),
    ]);

    const overdueItems: Array<{
      itemCode: string;
      description: string;
      dueDate: string;
      priority: string | null;
      module: string;
    }> = [];

    for (const i of aiItems) {
      if (i.status !== "Closed" && i.dueDate && i.dueDate < today) {
        overdueItems.push({
          itemCode: i.itemCode,
          description: i.description,
          dueDate: i.dueDate,
          priority: i.priority,
          module: "action-items",
        });
      }
    }
    for (const i of hfItems) {
      if (i.status !== "Closed" && i.responseDeadline && i.responseDeadline < today) {
        overdueItems.push({
          itemCode: i.itemCode,
          description: i.hazardDescription,
          dueDate: i.responseDeadline,
          priority: i.severity,
          module: "hazard-findings",
        });
      }
    }
    for (const i of ilItems) {
      if (i.status !== "Closed" && i.followUpDate && i.followUpDate < today) {
        overdueItems.push({
          itemCode: i.itemCode,
          description: i.finding,
          dueDate: i.followUpDate,
          priority: i.priority,
          module: "inspection-log",
        });
      }
    }

    overdueItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    res.json(overdueItems.slice(0, 10));
  } catch (err) {
    req.log.error({ err }, "Failed to get overdue items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recent", async (req, res) => {
  try {
    const [aiItems, hfItems, ilItems, wsItems] = await Promise.all([
      db.select().from(actionItemsTable).orderBy(desc(actionItemsTable.createdAt)).limit(10),
      db.select().from(hazardFindingsTable).orderBy(desc(hazardFindingsTable.createdAt)).limit(10),
      db.select().from(inspectionLogTable).orderBy(desc(inspectionLogTable.createdAt)).limit(10),
      db.select().from(workerStatementsTable).orderBy(desc(workerStatementsTable.createdAt)).limit(10),
    ]);

    type RecentItem = {
      itemCode: string;
      description: string;
      date: string;
      module: string;
      status: string;
      createdAt: Date;
    };

    const recentItems: RecentItem[] = [
      ...aiItems.map((i) => ({
        itemCode: i.itemCode,
        description: i.description,
        date: i.date,
        module: "action-items",
        status: i.status,
        createdAt: i.createdAt,
      })),
      ...hfItems.map((i) => ({
        itemCode: i.itemCode,
        description: i.hazardDescription,
        date: i.date,
        module: "hazard-findings",
        status: i.status,
        createdAt: i.createdAt,
      })),
      ...ilItems.map((i) => ({
        itemCode: i.itemCode,
        description: i.finding,
        date: i.date,
        module: "inspection-log",
        status: i.status,
        createdAt: i.createdAt,
      })),
      ...wsItems.map((i) => ({
        itemCode: i.statementCode,
        description: i.hazardType,
        date: i.dateReceived,
        module: "worker-statements",
        status: i.status,
        createdAt: i.createdAt,
      })),
    ];

    recentItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(
      recentItems.slice(0, 8).map(({ createdAt: _ct, ...rest }) => rest)
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get recent items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/closed-this-period", async (req, res) => {
  try {
    const latestRow = await db
      .select({ meetingDate: closedItemsLogTable.meetingDate })
      .from(closedItemsLogTable)
      .where(isNotNull(closedItemsLogTable.meetingDate))
      .orderBy(desc(closedItemsLogTable.meetingDate))
      .limit(1);

    if (latestRow.length === 0) {
      return res.json({ meetingDate: null, items: [] });
    }

    const latestMeetingDate = latestRow[0].meetingDate!;

    const items = await db
      .select()
      .from(closedItemsLogTable)
      .where(eq(closedItemsLogTable.meetingDate, latestMeetingDate))
      .orderBy(closedItemsLogTable.itemCode);

    res.json({
      meetingDate: latestMeetingDate,
      items: items.map((i) => ({
        itemCode: i.itemCode,
        description: i.description,
        assignedTo: i.assignedTo,
        department: i.department,
        closedDate: i.closedDate,
        notes: i.notes,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get closed-this-period items");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
