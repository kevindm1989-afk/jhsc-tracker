import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { checklistTemplatesTable, completedChecklistsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_TEMPLATES = [
  {
    name: "Forklift / Raymond Equipment Safety",
    category: "Equipment",
    items: [
      { description: "Pre-operation inspection completed", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Horn, lights and warnings functional", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Brakes and steering operational", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Forks in good condition, no cracks", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Operator trained and licensed", ohsaRef: "O. Reg. 851 s.56", defaultRating: "N/A" },
      { description: "Aisle clearances maintained (min 3m)", ohsaRef: "O. Reg. 851 s.45", defaultRating: "N/A" },
    ],
  },
  {
    name: "Racking Integrity (CSA A344)",
    category: "Structure",
    items: [
      { description: "Uprights free of damage and bends", ohsaRef: "CSA A344", defaultRating: "N/A" },
      { description: "Beams properly seated and pinned", ohsaRef: "CSA A344", defaultRating: "N/A" },
      { description: "Load capacity labels visible", ohsaRef: "CSA A344", defaultRating: "N/A" },
      { description: "Floor anchoring intact", ohsaRef: "CSA A344", defaultRating: "N/A" },
      { description: "No overloading above rated capacity", ohsaRef: "CSA A344", defaultRating: "N/A" },
    ],
  },
  {
    name: "Cold Storage & Temperature Zones",
    category: "Environment",
    items: [
      { description: "Temperatures logged and within range", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "PPE (insulated gloves, jacket) available", ohsaRef: "OHSA s.25(1)(b)", defaultRating: "N/A" },
      { description: "Emergency exits accessible and unblocked", ohsaRef: "O. Reg. 851 s.22", defaultRating: "N/A" },
      { description: "Door seals in good condition", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Alarm and emergency lighting functional", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
    ],
  },
  {
    name: "Dock / Loading Area",
    category: "Dock",
    items: [
      { description: "Dock plates secured before loading", ohsaRef: "O. Reg. 851 s.45", defaultRating: "N/A" },
      { description: "Truck wheels chocked", ohsaRef: "O. Reg. 851 s.82", defaultRating: "N/A" },
      { description: "Dock leveller operational", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "No slip hazards on dock floor", ohsaRef: "O. Reg. 851 s.11", defaultRating: "N/A" },
      { description: "Pedestrian barriers in place", ohsaRef: "O. Reg. 851 s.43", defaultRating: "N/A" },
    ],
  },
  {
    name: "Ergonomics & MSD Prevention",
    category: "Ergonomics",
    items: [
      { description: "Workstations at appropriate height", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Lift assist equipment available and used", ohsaRef: "O. Reg. 297/13", defaultRating: "N/A" },
      { description: "Manual lift weight does not exceed 23kg", ohsaRef: "O. Reg. 297/13", defaultRating: "N/A" },
      { description: "Repetitive motion tasks rotated", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Anti-fatigue mats in place where required", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
    ],
  },
  {
    name: "Fire Safety & Emergency Exits",
    category: "Fire Safety",
    items: [
      { description: "Fire extinguishers inspected and charged", ohsaRef: "O. Reg. 851 s.22", defaultRating: "N/A" },
      { description: "Emergency exits clearly marked and lit", ohsaRef: "O. Reg. 851 s.22", defaultRating: "N/A" },
      { description: "Exit paths clear of obstructions", ohsaRef: "O. Reg. 851 s.22", defaultRating: "N/A" },
      { description: "Evacuation plan posted", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "Sprinkler heads unobstructed (18\" clearance)", ohsaRef: "OFC", defaultRating: "N/A" },
    ],
  },
  {
    name: "General Warehouse Walkthrough",
    category: "General",
    items: [
      { description: "Housekeeping — aisles clear and clean", ohsaRef: "O. Reg. 851 s.11", defaultRating: "N/A" },
      { description: "Spill kit available and stocked", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
      { description: "First aid kit stocked and accessible", ohsaRef: "O. Reg. 1101", defaultRating: "N/A" },
      { description: "WHMIS labels on all hazardous materials", ohsaRef: "OHSA s.37.1", defaultRating: "N/A" },
      { description: "Lighting adequate throughout facility", ohsaRef: "O. Reg. 851 s.21", defaultRating: "N/A" },
      { description: "Safety signage posted and visible", ohsaRef: "OHSA s.25(2)(h)", defaultRating: "N/A" },
    ],
  },
];

async function seedTemplatesIfNeeded() {
  const existing = await db.select().from(checklistTemplatesTable);
  if (existing.length === 0) {
    await db.insert(checklistTemplatesTable).values(DEFAULT_TEMPLATES);
  }
}

router.get("/templates", async (req, res) => {
  try {
    await seedTemplatesIfNeeded();
    const templates = await db.select().from(checklistTemplatesTable).orderBy(checklistTemplatesTable.name);
    res.json(templates);
  } catch (err) {
    req.log.error({ err }, "Failed to list checklist templates");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const [created] = await db.insert(checklistTemplatesTable).values(req.body).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create checklist template");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/templates/:id", async (req, res) => {
  try {
    const [updated] = await db
      .update(checklistTemplatesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(checklistTemplatesTable.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update template");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/completed", async (req, res) => {
  try {
    const items = await db.select().from(completedChecklistsTable).orderBy(desc(completedChecklistsTable.completedAt));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list completed checklists");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/completed", async (req, res) => {
  try {
    const completedBy = req.session?.displayName || "Unknown";
    const [created] = await db
      .insert(completedChecklistsTable)
      .values({ ...req.body, completedBy })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to save completed checklist");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
