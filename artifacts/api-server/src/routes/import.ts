import { Router, type IRouter } from "express";
import multer from "multer";
import { db, pool } from "@workspace/db";
import { actionItemsTable, hazardFindingsTable, inspectionLogTable, closedItemsLogTable } from "@workspace/db/schema";
import { eq, and, like, or, isNull, isNotNull } from "drizzle-orm";
import { parseMinutesFile } from "../minutesParser";
import { parseInspectionFile } from "../inspectionParser";
import "../sessionTypes";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

    // "Closed Items" = current-period items from Meeting Minutes COMPLETED section (get meetingDate → show on dashboard)
    // "Closed Items Sheet" = historical items from the dedicated Closed Items tab (no meetingDate → Closed Items Log only)
    const closedThisPeriod = parsed.actionItems.filter((a) => a.source === "Closed Items");
    const closedHistorical = parsed.actionItems.filter((a) => a.source === "Closed Items Sheet");
    const regularActionItems = parsed.actionItems.filter((a) => a.source !== "Closed Items" && a.source !== "Closed Items Sheet");

    const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    // Clear ALL existing action items, then insert fresh from the import
    await db.delete(actionItemsTable);

    let aiNum = 1;
    for (const item of regularActionItems) {
      await db
        .insert(actionItemsTable)
        .values({
          itemCode: "AI-" + String(aiNum++).padStart(3, "0"),
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
        });

      importedActionItems++;
    }

    // Import closed items from the Meeting Minutes COMPLETED section only.
    let importedClosedItems = 0;
    const currentMeetingDate = parsed.meetingDate || null;

    // Purge any corrupted records (e.g. "[object Object]" from previous buggy imports)
    await db.delete(closedItemsLogTable).where(like(closedItemsLogTable.description, "%object Object%"));

    // Delete only UNVERIFIED current-period records so we can re-insert fresh from this import.
    // Verified records are preserved — they will be skipped during insertion below.
    await db
      .delete(closedItemsLogTable)
      .where(and(isNotNull(closedItemsLogTable.meetingDate), isNull(closedItemsLogTable.verifiedAt)));

    // Determine next sequential CI number from whatever is already in the DB.
    const existingCodes = await db.select({ itemCode: closedItemsLogTable.itemCode }).from(closedItemsLogTable);
    let nextCiNum = existingCodes.reduce((max, row) => {
      const m = row.itemCode.match(/^CI-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) + 1;

    const genCiCode = () => "CI-" + String(nextCiNum++).padStart(3, "0");

    // Insert current-period items (from Meeting Minutes COMPLETED section) with sequential codes.
    // Skip any that already exist (e.g. previously verified items kept from a prior import).
    for (const item of closedThisPeriod) {
      const [existing] = await db
        .select({ id: closedItemsLogTable.id })
        .from(closedItemsLogTable)
        .where(eq(closedItemsLogTable.description, item.description));

      if (existing) continue;   // verified copy still in DB — leave it alone

      await db
        .insert(closedItemsLogTable)
        .values({
          itemCode: genCiCode(),
          date: item.date,
          department: item.department,
          description: item.description,
          assignedTo: item.assignedTo,
          closedDate: item.closedDate ?? null,
          meetingDate: currentMeetingDate,
          notes: item.notes ?? null,
        });

      importedClosedItems++;
    }

    // Import new items from the Closed Items sheet only.
    // Never touch records that already exist in the DB — this protects verified items.
    for (const item of closedHistorical) {
      const [existing] = await db
        .select({ id: closedItemsLogTable.id })
        .from(closedItemsLogTable)
        .where(eq(closedItemsLogTable.description, item.description));

      if (existing) continue;   // already in DB — skip regardless of verified status

      await db
        .insert(closedItemsLogTable)
        .values({
          itemCode: genCiCode(),
          date: item.date,
          department: item.department,
          description: item.description,
          assignedTo: item.assignedTo,
          closedDate: item.closedDate ?? null,
          meetingDate: null,   // no meetingDate — never shown on dashboard
          notes: item.notes ?? null,
        });
    }

    // Clear ALL existing hazard findings, then insert fresh from the import
    await db.delete(hazardFindingsTable);

    let hfNum = 1;
    for (const finding of parsed.hazardFindings) {
      await db
        .insert(hazardFindingsTable)
        .values({
          itemCode: "HF-" + String(hfNum++).padStart(3, "0"),
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
        });

      importedHazardFindings++;
    }

    // ── Save uploaded file to Files → Minutes → [meeting date] subfolder ───────
    let fileSaved = false;
    let savedToFolder = "";
    try {
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

      // Insert file record — store bytes directly in DB so they survive deploys
      const uploadedBy = (req as any).session?.displayName || "System";
      const storedName = req.file!.originalname;
      await pool.query(
        `INSERT INTO folder_files (folder_id, original_name, stored_name, mime_type, size_bytes, uploaded_by, file_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [subFolderId, req.file!.originalname, storedName, mimeType, req.file!.size, uploadedBy, req.file!.buffer]
      );

      fileSaved = true;
      savedToFolder = `Minutes › ${subfolderName}`;
    } catch (saveErr: any) {
      req.log.error({ err: saveErr }, "Minutes file save error");
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
