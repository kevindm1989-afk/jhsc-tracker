import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { emergencyContactsTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";

const router: IRouter = Router();

function isAdminOrCoChair(req: Request) {
  const role = req.session?.role;
  return role === "admin" || role === "co-chair";
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(emergencyContactsTable)
      .orderBy(asc(emergencyContactsTable.sortOrder), asc(emergencyContactsTable.name));
    res.json(items);
  } catch (err) {
    req.log?.error({ err }, "Failed to list emergency contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  if (!isAdminOrCoChair(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const body = req.body;
    const [contact] = await db
      .insert(emergencyContactsTable)
      .values({
        name: body.name,
        role: body.role ?? "",
        organization: body.organization ?? "",
        phone: body.phone ?? "",
        email: body.email ?? "",
        notes: body.notes ?? "",
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    return res.status(201).json(contact);
  } catch (err) {
    req.log?.error({ err }, "Failed to create emergency contact");
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
      .update(emergencyContactsTable)
      .set({
        name: body.name,
        role: body.role,
        organization: body.organization,
        phone: body.phone,
        email: body.email,
        notes: body.notes,
        sortOrder: body.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(emergencyContactsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log?.error({ err }, "Failed to update emergency contact");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  if (!isAdminOrCoChair(req)) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(emergencyContactsTable).where(eq(emergencyContactsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "Failed to delete emergency contact");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
