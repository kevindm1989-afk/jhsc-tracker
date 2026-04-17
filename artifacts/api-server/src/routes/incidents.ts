import { Router, type IRouter, type Request, type Response } from "express";
import { db, pool } from "@workspace/db";
import { incidentsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { sendNotification } from "../lib/notifications";

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
    const items = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.incidentDate));
    res.json(items);
  } catch (err) {
    req.log?.error({ err }, "Failed to list incidents");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
    const existing = await db.select({ code: incidentsTable.incidentCode }).from(incidentsTable);
    const seq = existing.length + 1;
    const incidentCode = `INC-${datePart}-${String(seq).padStart(3, "0")}`;

    const body = req.body;
    const [incident] = await db
      .insert(incidentsTable)
      .values({
        incidentCode,
        incidentType: body.incidentType ?? "Incident",
        incidentDate: body.incidentDate,
        incidentTime: body.incidentTime ?? "",
        location: body.location ?? "",
        description: body.description ?? "",
        injuredPerson: body.injuredPerson ?? "",
        bodyPartAffected: body.bodyPartAffected ?? "",
        witnesses: body.witnesses ?? "",
        immediateAction: body.immediateAction ?? "",
        reportedTo: body.reportedTo ?? "",
        status: body.status ?? "Open",
        createdBy: getUsername(req),
      })
      .returning();

    sendNotification("incident", {
      incidentCode: incident.incidentCode,
      incidentType: incident.incidentType,
      incidentDate: incident.incidentDate,
      location: incident.location,
      description: incident.description,
      createdBy: incident.createdBy,
    }).catch(() => {});

    return res.status(201).json(incident);
  } catch (err) {
    req.log?.error({ err }, "Failed to create incident");
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
      .update(incidentsTable)
      .set({
        incidentType: body.incidentType,
        incidentDate: body.incidentDate,
        incidentTime: body.incidentTime,
        location: body.location,
        description: body.description,
        injuredPerson: body.injuredPerson,
        bodyPartAffected: body.bodyPartAffected,
        witnesses: body.witnesses,
        immediateAction: body.immediateAction,
        reportedTo: body.reportedTo,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(incidentsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log?.error({ err }, "Failed to update incident");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!isAdminOrCoChair(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(incidentsTable).where(eq(incidentsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Failed to delete incident");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
