import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { actionItemsTable, hazardFindingsTable, inspectionLogTable, closedItemsLogTable, storedFilesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { parseMinutesFile } from "../minutesParser";
import { parseInspectionFile } from "../inspectionParser";
import "../sessionTypes";

const UPLOAD_DIR = process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads");

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

    // Separate closed items (from the "Closed Items" sheet) from regular action items
    const closedItemsFromSheet = parsed.actionItems.filter((a) => a.source === "Closed Items");
    const regularActionItems = parsed.actionItems.filter((a) => a.source !== "Closed Items");

    const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    // Clear ALL existing action items, then insert fresh from the import
    await db.delete(actionItemsTable);

    for (const item of regularActionItems) {
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

    // Import closed items — upsert by description: insert new, update existing with any improved data
    let importedClosedItems = 0;
    let updatedClosedItems = 0;
    for (const item of closedItemsFromSheet) {

      const [existing] = await db
        .select()
        .from(closedItemsLogTable)
        .where(eq(closedItemsLogTable.description, item.description));

      if (existing) {
        // Build a partial update with only fields that have new/better values
        const updates: Record<string, unknown> = {};
        if (item.closedDate && !existing.closedDate) updates.closedDate = item.closedDate;
        if (item.notes && item.notes !== existing.notes) updates.notes = item.notes;
        if (item.assignedTo && item.assignedTo !== "Unassigned" && item.assignedTo !== existing.assignedTo) updates.assignedTo = item.assignedTo;
        if (item.department && item.department !== existing.department) updates.department = item.department;
        if (parsed.meetingDate && parsed.meetingDate !== existing.meetingDate) updates.meetingDate = parsed.meetingDate;

        if (Object.keys(updates).length > 0) {
          await db.update(closedItemsLogTable).set(updates).where(eq(closedItemsLogTable.id, existing.id));
          updatedClosedItems++;
        }
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

    // Clear ALL existing hazard findings, then insert fresh from the import
    await db.delete(hazardFindingsTable);

    for (const finding of parsed.hazardFindings) {
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

    // ── Save the uploaded file to the Files archive ───────────────────────────
    try {
      const meetingDateSlug = (parsed.meetingDate ?? "unknown").replace(/[^0-9\-]/g, "");
      const folderRelative = path.join("minutes", meetingDateSlug);
      const folderAbsolute = path.join(UPLOAD_DIR, folderRelative);
      if (!fs.existsSync(folderAbsolute)) fs.mkdirSync(folderAbsolute, { recursive: true });

      const originalName = req.file!.originalname;
      const safeFilename = originalName.replace(/[^a-zA-Z0-9._\-]/g, "_");
      // If a file with this name already exists, add a timestamp prefix to avoid collision
      const storedFilename = fs.existsSync(path.join(folderAbsolute, safeFilename))
        ? `${Date.now()}_${safeFilename}`
        : safeFilename;

      const destPath = path.join(folderAbsolute, storedFilename);
      fs.writeFileSync(destPath, req.file!.buffer);

      const storedRelative = path.join(folderRelative, storedFilename);
      await db.insert(storedFilesTable).values({
        originalName,
        storedPath: storedRelative,
        folder: folderRelative,
        mimeType: req.file!.mimetype,
        sizeBytes: req.file!.size,
        uploadedBy: req.session?.displayName || "Unknown",
      });
    } catch (fileErr) {
      console.error("Warning: could not save minutes file to archive:", fileErr);
      // Non-fatal: import succeeded, file archive is bonus
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
      updated: {
        closedItems: updatedClosedItems,
      },
      skipped: {
        actionItems: 0,
        hazardFindings: 0,
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

