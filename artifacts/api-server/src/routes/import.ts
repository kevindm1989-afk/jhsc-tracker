import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { actionItemsTable, hazardFindingsTable, inspectionLogTable, closedItemsLogTable, documentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { parseMinutesFile } from "../minutesParser";
import { parseInspectionFile } from "../inspectionParser";
import { ObjectStorageService } from "../lib/objectStorage";
import "../sessionTypes";

const objectStorage = new ObjectStorageService();

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function genActionCode(id: number) {
  return "AI-" + String(id).padStart(3, "0");
}

function genHazardCode(id: number) {
  return "HF-" + String(id).padStart(3, "0");
}

router.post("/minutes", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const parsed = await parseMinutesFile(req.file.buffer);
    const preview = req.query.preview === "true";

    if (preview) {
      return res.json(parsed);
    }

    // --- Import to DB ---
    let importedActionItems = 0;
    let importedHazardFindings = 0;
    let skippedActionItems = 0;
    let skippedHazardFindings = 0;

    // Separate closed items (from the "Closed Items" sheet) from regular action items
    const closedItemsFromSheet = parsed.actionItems.filter((a) => a.source === "Closed Items");
    const regularActionItems = parsed.actionItems.filter((a) => a.source !== "Closed Items");

    const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    // Import regular action items (dedup by description + date)
    for (const item of regularActionItems) {
      const existing = await db
        .select({ id: actionItemsTable.id })
        .from(actionItemsTable)
        .where(
          isIsoDate(item.date)
            ? and(eq(actionItemsTable.description, item.description), eq(actionItemsTable.date, item.date))
            : eq(actionItemsTable.description, item.description)
        );

      if (existing.length > 0) {
        skippedActionItems++;
        continue;
      }

      const [created] = await db
        .insert(actionItemsTable)
        .values({
          itemCode: "AI-000",
          date: item.date,
          department: item.department,
          description: item.description,
          raisedBy: item.raisedBy,
          assignedTo: item.assignedTo,
          priority: item.priority,
          status: item.status,
          notes: item.notes ?? null,
          closedDate: item.closedDate ?? null,
          dueDate: null,
        })
        .returning();

      await db
        .update(actionItemsTable)
        .set({ itemCode: genActionCode(created.id) })
        .where(eq(actionItemsTable.id, created.id));

      importedActionItems++;
    }

    // Import closed items into the dedicated closed_items_log table (dedup by description only)
    let importedClosedItems = 0;
    let skippedClosedItems = 0;
    for (const item of closedItemsFromSheet) {
      const existing = await db
        .select({ id: closedItemsLogTable.id })
        .from(closedItemsLogTable)
        .where(eq(closedItemsLogTable.description, item.description));

      if (existing.length > 0) {
        skippedClosedItems++;
        continue;
      }

      const [created] = await db
        .insert(closedItemsLogTable)
        .values({
          itemCode: "CI-000",
          date: item.date,
          department: item.department,
          description: item.description,
          assignedTo: item.assignedTo,
          closedDate: item.closedDate ?? null,
          meetingDate: parsed.meetingDate ?? null,
          notes: item.notes ?? null,
        })
        .returning();

      await db
        .update(closedItemsLogTable)
        .set({ itemCode: "CI-" + String(created.id).padStart(3, "0") })
        .where(eq(closedItemsLogTable.id, created.id));

      importedClosedItems++;
    }

    // Import hazard findings (dedup by description + date)
    for (const finding of parsed.hazardFindings) {
      const existing = await db
        .select({ id: hazardFindingsTable.id })
        .from(hazardFindingsTable)
        .where(
          isIsoDate(finding.date)
            ? and(eq(hazardFindingsTable.hazardDescription, finding.hazardDescription), eq(hazardFindingsTable.date, finding.date))
            : eq(hazardFindingsTable.hazardDescription, finding.hazardDescription)
        );

      if (existing.length > 0) {
        skippedHazardFindings++;
        continue;
      }

      const [created] = await db
        .insert(hazardFindingsTable)
        .values({
          itemCode: "HF-000",
          date: finding.date,
          department: finding.department,
          hazardDescription: finding.hazardDescription,
          ohsaReference: finding.ohsaReference ?? null,
          severity: finding.severity,
          recommendationDate: finding.recommendationDate,
          responseDeadline: finding.responseDeadline ?? null,
          status: finding.status,
          notes: finding.notes ?? null,
          closedDate: null,
        })
        .returning();

      await db
        .update(hazardFindingsTable)
        .set({ itemCode: genHazardCode(created.id) })
        .where(eq(hazardFindingsTable.id, created.id));

      importedHazardFindings++;
    }

    // ── Save uploaded file to Documents ──────────────────────────────────────
    try {
      const uploaderName =
        (req.session as any)?.displayName ?? (req.session as any)?.username ?? "Unknown";
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const displayDate = parsed.meetingDate
        ? new Date(parsed.meetingDate + "T12:00:00").toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;

      const title = displayDate
        ? `JHSC Minutes — ${displayDate}`
        : `JHSC Minutes — ${originalName}`;

      const totalImported =
        importedActionItems + importedHazardFindings + importedClosedItems;

      const { objectPath } = await objectStorage.uploadBufferAsDocument(
        req.file.buffer,
        originalName,
        mimeType
      );

      await db.insert(documentsTable).values({
        title,
        description: `${totalImported} item${totalImported !== 1 ? "s" : ""} imported`,
        category: "Meeting Minutes",
        fileName: originalName,
        fileSize: req.file.size,
        mimeType,
        objectPath,
        uploadedBy: uploaderName,
      });
    } catch (docErr) {
      console.error("Minutes document save error (non-fatal):", docErr);
    }

    res.json({
      success: true,
      meetingDate: parsed.meetingDate,
      facility: parsed.facility,
      imported: {
        actionItems: importedActionItems,
        hazardFindings: importedHazardFindings,
        closedItems: importedClosedItems,
      },
      skipped: {
        actionItems: skippedActionItems,
        hazardFindings: skippedHazardFindings,
        closedItems: skippedClosedItems,
      },
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: "Failed to parse or import the file. Make sure it is a valid JHSC minutes workbook." });
  }
});

function genInspectionCode(id: number) {
  return "IL-" + String(id).padStart(3, "0");
}

router.post("/inspection", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const parsed = await parseInspectionFile(req.file.buffer);
    const preview = req.query.preview === "true";

    if (preview) {
      return res.json(parsed);
    }

    if (parsed.isBlank) {
      return res.json({
        success: true,
        imported: { inspectionEntries: 0 },
        skipped: { inspectionEntries: 0 },
        message: "The file appears to be a blank template — no findings were recorded.",
      });
    }

    let imported = 0;
    let skipped = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const sheet of parsed.sheets) {
      for (const finding of sheet.findings) {
        const entryDate = finding.date || today;

        const [created] = await db
          .insert(inspectionLogTable)
          .values({
            itemCode: "IL-000",
            date: entryDate,
            zone: finding.zone,
            area: finding.area || null,
            finding: finding.finding,
            priority: finding.priority,
            assignedTo: finding.assignedTo || null,
            status: "Open",
            notes: finding.notes || null,
          })
          .returning()
          .catch(() => [null]);

        if (!created) {
          skipped++;
          continue;
        }

        await db
          .update(inspectionLogTable)
          .set({ itemCode: genInspectionCode(created.id) })
          .where(eq(inspectionLogTable.id, created.id));

        imported++;
      }
    }

    res.json({
      success: true,
      imported: { inspectionEntries: imported },
      skipped: { inspectionEntries: skipped },
      totalSheets: parsed.sheets.length,
    });
  } catch (err) {
    console.error("Inspection import error:", err);
    res.status(500).json({
      error: "Failed to parse or import the file. Make sure it is a valid JHSC Inspection Form workbook.",
    });
  }
});

export default router;

