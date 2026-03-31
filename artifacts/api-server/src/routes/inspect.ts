import { Router, type IRouter } from "express";
import path from "path";
import { readFile } from "fs/promises";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { inspectionLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CHECKLIST_SECTIONS, ZONE_NAMES, ADDITIONAL_COMMENTS_ROW } from "../checklistData";

const router: IRouter = Router();

// Path to the bundled template xlsx (artifacts/api-server/assets/)
const TEMPLATE_PATH = path.join(__dirname, "../assets/inspection_template.xlsx");

function genInspectionCode(id: number) {
  return "IL-" + String(id).padStart(3, "0");
}

function setCell(ws: XLSX.WorkSheet, row: number, col: number, value: string) {
  const ref = XLSX.utils.encode_cell({ r: row - 1, c: col });
  ws[ref] = { v: value, t: "s" };
}

// GET /api/inspect/checklist — return the checklist structure + zone list
router.get("/checklist", (_req, res) => {
  res.json({ sections: CHECKLIST_SECTIONS, zones: ZONE_NAMES });
});

interface ItemResponse {
  rating: "A" | "B" | "C" | "X" | null;
  correctiveAction?: string;
  responsibleParty?: string;
}

interface ExportBody {
  zoneIndex: number; // 0-10
  date: string;
  inspector: string;
  responses: Record<string, ItemResponse>; // keyed by row number string
  additionalComments?: string;
}

// POST /api/inspect/export — fill template and return xlsx download
router.post("/export", async (req, res) => {
  try {
    const body: ExportBody = req.body;
    const { zoneIndex, date, inspector, responses, additionalComments } = body;

    if (zoneIndex == null || zoneIndex < 0 || zoneIndex > 10) {
      return res.status(400).json({ error: "Invalid zone index" });
    }

    const templateBuffer = await readFile(TEMPLATE_PATH);
    const workbook = XLSX.read(templateBuffer, { type: "buffer" });

    const sheetName = `Inspection ${zoneIndex + 1}`;
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
      return res.status(400).json({ error: `Sheet "${sheetName}" not found in template` });
    }

    // Fill date (row 4, col B)
    if (date) setCell(ws, 4, 1, date);

    // Fill inspector name (row 5, col C — Inspectors' Signatures area)
    if (inspector) setCell(ws, 5, 2, inspector);

    // Fill checklist responses
    for (const [rowStr, resp] of Object.entries(responses)) {
      const row = parseInt(rowStr, 10);
      if (!resp.rating) continue;

      // Col C = hazard rating
      setCell(ws, row, 2, resp.rating);

      // Col E = corrective action
      if (resp.correctiveAction) {
        setCell(ws, row, 4, resp.correctiveAction);
      }

      // Col F = responsible party
      if (resp.responsibleParty) {
        setCell(ws, row, 5, resp.responsibleParty);
      }
    }

    // Fill additional comments (row 111, col A)
    if (additionalComments) {
      setCell(ws, ADDITIONAL_COMMENTS_ROW + 1, 0, additionalComments);
    }

    const zoneName = ZONE_NAMES[zoneIndex] ?? `Zone ${zoneIndex + 1}`;
    const safeZone = zoneName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const safeDate = date ? date.replace(/-/g, "") : "undated";
    const fileName = `JHSC_Inspection_${safeZone}_${safeDate}.xlsx`;

    // Export only the selected zone's sheet as a standalone file
    const singleSheetWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(singleSheetWorkbook, ws, sheetName);
    const outBuffer = XLSX.write(singleSheetWorkbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(outBuffer);
  } catch (err) {
    console.error("Inspection export error:", err);
    res.status(500).json({ error: "Failed to generate inspection form export." });
  }
});

interface SaveBody {
  zoneIndex: number;
  date: string;
  inspector: string;
  responses: Record<string, ItemResponse>;
}

// POST /api/inspect/save — save findings to inspection_log
router.post("/save", async (req, res) => {
  try {
    const body: SaveBody = req.body;
    const { zoneIndex, date, responses } = body;

    if (zoneIndex == null || zoneIndex < 0 || zoneIndex > 10) {
      return res.status(400).json({ error: "Invalid zone index" });
    }

    const zoneName = ZONE_NAMES[zoneIndex] ?? `Zone ${zoneIndex + 1}`;
    const today = new Date().toISOString().split("T")[0];
    const entryDate = date || today;

    // Build a map of row → { sectionName, item }
    const rowToItem = new Map<number, { sectionName: string; description: string }>();
    for (const section of CHECKLIST_SECTIONS) {
      for (const item of section.items) {
        rowToItem.set(item.row, { sectionName: section.name, description: item.description });
      }
    }

    const priorityMap: Record<string, "High" | "Medium" | "Low"> = {
      A: "High",
      B: "Medium",
      C: "Low",
    };

    let imported = 0;

    for (const [rowStr, resp] of Object.entries(responses)) {
      if (!resp.rating || resp.rating === "X") continue; // Only import issues

      const row = parseInt(rowStr, 10);
      const itemInfo = rowToItem.get(row);
      if (!itemInfo) continue;

      const priority = priorityMap[resp.rating] ?? "Low";
      const findingText = resp.correctiveAction
        ? `${itemInfo.description} — ${resp.correctiveAction}`
        : itemInfo.description;

      const [created] = await db
        .insert(inspectionLogTable)
        .values({
          itemCode: "IL-000",
          date: entryDate,
          zone: zoneName,
          area: itemInfo.sectionName,
          finding: findingText,
          priority,
          assignedTo: resp.responsibleParty || null,
          status: "Open",
          notes: null,
        })
        .returning()
        .catch(() => [null]);

      if (!created) continue;

      await db
        .update(inspectionLogTable)
        .set({ itemCode: genInspectionCode(created.id) })
        .where(eq(inspectionLogTable.id, created.id));

      imported++;
    }

    res.json({ success: true, imported });
  } catch (err) {
    console.error("Inspection save error:", err);
    res.status(500).json({ error: "Failed to save inspection findings." });
  }
});

export default router;
