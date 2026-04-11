import { Router, type IRouter } from "express";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import multer from "multer";
import { db, pool } from "@workspace/db";
import { actionItemsTable, hazardFindingsTable, inspectionLogTable, closedItemsLogTable } from "@workspace/db/schema";
import { eq, and, like, or, isNull, isNotNull } from "drizzle-orm";
import { parseMinutesFile } from "../minutesParser";
import { parseInspectionFile } from "../inspectionParser";
import "../sessionTypes";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const UPLOAD_DIR = process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads");

function meetingDateToFolderName(meetingDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
    const [year, month, day] = meetingDate.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
      year: "numeric", month: "long", day: "numeric",
    });
  }
  return meetingDate || new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

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

    // Separate items: "Closed Items" = current-period COMPLETED section in Meeting Minutes
    //                 "Closed Items Sheet" = historical items from dedicated Closed Items tab
    const closedThisPeriod = parsed.actionItems.filter((a) => a.source === "Closed Items");
    const closedHistorical = parsed.actionItems.filter((a) => a.source === "Closed Items Sheet");
    const closedItemsFromSheet = [...closedThisPeriod, ...closedHistorical];
    const regularActionItems = parsed.actionItems.filter((a) => a.source !== "Closed Items" && a.source !== "Closed Items Sheet");

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

    // Import closed items.
    // Current-period items (from Meeting Minutes COMPLETED section) get meetingDate stamped.
    // Historical items (from dedicated Closed Items sheet) get meetingDate: null.
    let importedClosedItems = 0;
    let updatedClosedItems = 0;
    const currentMeetingDate = parsed.meetingDate || null;

    // Purge any corrupted records (e.g. "[object Object]" from previous buggy imports)
    await db.delete(closedItemsLogTable).where(like(closedItemsLogTable.description, "%object Object%"));

    // Clear ALL "this period" records (any row with a meetingDate stamped) before inserting
    // fresh ones from this import. This ensures the dashboard always reflects the latest import.
    await db.delete(closedItemsLogTable).where(isNotNull(closedItemsLogTable.meetingDate));

    for (const item of closedItemsFromSheet) {
      const isCurrentPeriod = item.source === "Closed Items";
      const itemMeetingDate = isCurrentPeriod ? currentMeetingDate : null;

      if (!isCurrentPeriod) {
        // Historical items: upsert by description, never overwrite meetingDate
        const [existing] = await db
          .select()
          .from(closedItemsLogTable)
          .where(eq(closedItemsLogTable.description, item.description));

        if (existing) {
          const updates: Record<string, unknown> = {};
          if (item.closedDate && !existing.closedDate) updates.closedDate = item.closedDate;
          if (item.notes && item.notes !== existing.notes) updates.notes = item.notes;
          if (item.assignedTo && item.assignedTo !== "Unassigned" && item.assignedTo !== existing.assignedTo) updates.assignedTo = item.assignedTo;
          if (item.department && item.department !== existing.department) updates.department = item.department;
          if (Object.keys(updates).length > 0) {
            await db.update(closedItemsLogTable).set(updates).where(eq(closedItemsLogTable.id, existing.id));
            updatedClosedItems++;
          }
          continue;
        }
      }

      // Current-period items: always insert fresh (old records deleted above)
      const [created] = await db
        .insert(closedItemsLogTable)
        .values({
          itemCode: "CI-000",
          date: item.date,
          department: item.department,
          description: item.description,
          assignedTo: item.assignedTo,
          closedDate: item.closedDate ?? null,
          meetingDate: itemMeetingDate,
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

    // ── Save uploaded file to Files → Minutes → [meeting date] subfolder ───────
    let fileSaved = false;
    let savedToFolder = "";
    try {
      if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });

      const ext = path.extname(req.file!.originalname) || ".xlsx";
      const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      await writeFile(path.join(UPLOAD_DIR, storedName), req.file!.buffer);

      const mimeType = req.file!.mimetype ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      // Find or create top-level "Minutes" folder
      let minsRes = await pool.query(
        `SELECT id FROM folders WHERE name = 'Minutes' AND parent_id IS NULL LIMIT 1`
      );
      let minsFolderId: number;
      if (minsRes.rows.length > 0) {
        minsFolderId = minsRes.rows[0].id;
      } else {
        const r = await pool.query(
          `INSERT INTO folders (name, created_by) VALUES ('Minutes', 'system') RETURNING id`
        );
        minsFolderId = r.rows[0].id;
      }

      // Format meeting date into a folder name (e.g. "April 7, 2026")
      const subfolderName = meetingDateToFolderName(parsed.meetingDate || "");

      // Find or create date subfolder
      let subRes = await pool.query(
        `SELECT id FROM folders WHERE name = $1 AND parent_id = $2 LIMIT 1`,
        [subfolderName, minsFolderId]
      );
      let subFolderId: number;
      if (subRes.rows.length > 0) {
        subFolderId = subRes.rows[0].id;
      } else {
        const r = await pool.query(
          `INSERT INTO folders (name, parent_id, created_by) VALUES ($1, $2, 'system') RETURNING id`,
          [subfolderName, minsFolderId]
        );
        subFolderId = r.rows[0].id;
      }

      // Insert file record
      const uploadedBy = (req as any).session?.displayName || "System";
      await pool.query(
        `INSERT INTO folder_files (folder_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [subFolderId, req.file!.originalname, storedName, mimeType, req.file!.size, uploadedBy]
      );

      fileSaved = true;
      savedToFolder = `Minutes › ${subfolderName}`;
    } catch (saveErr) {
      console.error("Minutes file save error:", saveErr);
    }

    return res.json({
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
      fileSaved,
      savedToFolder,
    });
  } catch (err) {
    console.error("Import error:", err);
    return res.status(500).json({ error: "Failed to parse or import the file. Make sure it is a valid JHSC minutes workbook." });
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

    return res.json({
      success: true,
      imported: { inspectionEntries: imported },
      skipped: { inspectionEntries: skipped },
      totalSheets: parsed.sheets.length,
    });
  } catch (err) {
    console.error("Inspection import error:", err);
    return res.status(500).json({
      error: "Failed to parse or import the file. Make sure it is a valid JHSC Inspection Form workbook.",
    });
  }
});

export default router;

