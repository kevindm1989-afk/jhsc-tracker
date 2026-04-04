import { Router, type IRouter } from "express";
import path from "path";
import { readFile } from "fs/promises";
import XlsxPopulate from "xlsx-populate";
import { db } from "@workspace/db";
import { inspectionLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CHECKLIST_SECTIONS, ZONE_NAMES, ADDITIONAL_COMMENTS_ROW } from "../checklistData";
import { createTransporter, getSenderAddress } from "../emailClient";
import "../sessionTypes";

const CO_CHAIR_EMAIL = "kevin_de_melo@hotmail.com";

const router: IRouter = Router();

const ASSETS_DIR = path.join(__dirname, "../assets");

function genInspectionCode(id: number) {
  return "IL-" + String(id).padStart(3, "0");
}

router.get("/checklist", (_req, res) => {
  res.json({ sections: CHECKLIST_SECTIONS, zones: ZONE_NAMES });
});

interface ItemResponse {
  rating: "A" | "B" | "C" | "X" | null;
  correctiveAction?: string;
  responsibleParty?: string;
}

interface ExportBody {
  zoneIndex: number;
  date: string;
  inspector: string;
  responses: Record<string, ItemResponse>;
  additionalComments?: string;
}

async function buildFilledBuffer(body: ExportBody): Promise<Buffer | null> {
  const { zoneIndex, date, inspector, responses, additionalComments } = body;
  if (zoneIndex == null || zoneIndex < 0 || zoneIndex > 10) return null;

  const zonePath = path.join(ASSETS_DIR, `inspection_zone_${zoneIndex + 1}.xlsx`);
  const templateBuffer = await readFile(zonePath);
  const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);

  // Each per-zone file has exactly one sheet
  const sheet = workbook.sheets()[0];
  if (!sheet) return null;

  // xlsx-populate uses 1-indexed rows AND cols
  if (date) sheet.cell(4, 2).value(date);
  if (inspector) sheet.cell(5, 3).value(inspector);

  for (const [rowStr, resp] of Object.entries(responses)) {
    const row = parseInt(rowStr, 10);
    if (!resp.rating) continue;
    sheet.cell(row, 3).value(resp.rating);
    if (resp.correctiveAction) sheet.cell(row, 5).value(resp.correctiveAction);
    if (resp.responsibleParty) sheet.cell(row, 6).value(resp.responsibleParty);
  }

  if (additionalComments) {
    sheet.cell(ADDITIONAL_COMMENTS_ROW + 1, 1).value(additionalComments);
  }

  return workbook.outputAsync();
}

router.post("/export", async (req, res) => {
  try {
    const body: ExportBody = req.body;
    const { zoneIndex, date } = body;

    const outBuffer = await buildFilledBuffer(body);
    if (!outBuffer) {
      return res.status(400).json({ error: "Invalid zone index or sheet not found in template" });
    }

    const zoneName = ZONE_NAMES[zoneIndex] ?? `Zone ${zoneIndex + 1}`;
    const safeZone = zoneName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const safeDate = date ? date.replace(/-/g, "") : "undated";
    const fileName = `JHSC_Inspection_${safeZone}_${safeDate}.xlsx`;

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
  additionalComments?: string;
}

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
      if (!resp.rating || resp.rating === "X") continue;

      const row = parseInt(rowStr, 10);
      const itemInfo = rowToItem.get(row);
      if (!itemInfo) continue;

      const priority = priorityMap[resp.rating] ?? "Low";
      const [created] = await db
        .insert(inspectionLogTable)
        .values({
          itemCode: "IL-000",
          date: entryDate,
          zone: zoneName,
          area: itemInfo.sectionName,
          finding: itemInfo.description,
          correctiveAction: resp.correctiveAction || null,
          inspector: body.inspector || null,
          priority,
          assignedTo: null,
          status: "Pending",
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

router.post("/email", async (req, res) => {
  try {
    const body: ExportBody = req.body;
    const { zoneIndex, date, inspector, responses } = body;

    if (zoneIndex == null || zoneIndex < 0 || zoneIndex > 10) {
      return res.status(400).json({ error: "Invalid zone index" });
    }

    const outBuffer = await buildFilledBuffer(body);
    if (!outBuffer) {
      return res.status(400).json({ error: "Sheet not found in template" });
    }

    const zoneName = ZONE_NAMES[zoneIndex] ?? `Zone ${zoneIndex + 1}`;
    const safeZone = zoneName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const safeDate = date ? date.replace(/-/g, "") : "undated";
    const fileName = `JHSC_Inspection_${safeZone}_${safeDate}.xlsx`;

    const ratedCount = Object.values(responses).filter((r) => r.rating !== null).length;
    const issueCount = Object.values(responses).filter((r) => r.rating && r.rating !== "X").length;
    const displayDate = date
      ? new Date(date + "T12:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
      : "Unknown date";

    // ── 1. Send email with file attached ─────────────────────────────────────
    const transporter = createTransporter();
    const fromEmail = getSenderAddress();

    await transporter.sendMail({
      from: fromEmail,
      to: CO_CHAIR_EMAIL,
      subject: `JHSC Inspection Complete — ${zoneName} (${displayDate})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a2744; padding: 20px; border-radius: 6px 6px 0 0;">
            <h2 style="color: #ffffff; margin: 0; font-size: 18px;">JHSC Inspection Report</h2>
            <p style="color: #aab4cc; margin: 4px 0 0; font-size: 13px;">Unifor Local 1285 — Saputo Georgetown</p>
          </div>
          <div style="background: #f8f9fa; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 6px 6px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0; font-weight: bold; width: 140px; color: #555;">Zone</td>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0;">${zoneName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0; font-weight: bold; color: #555;">Date</td>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0;">${displayDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0; font-weight: bold; color: #555;">Inspector</td>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0;">${inspector || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0; font-weight: bold; color: #555;">Items Rated</td>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0;">${ratedCount} of 50</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0; font-weight: bold; color: #555;">Issues Found</td>
                <td style="padding: 8px 12px; background: #fff; border: 1px solid #e0e0e0; color: ${issueCount > 0 ? "#c0392b" : "#27ae60"}; font-weight: bold;">${issueCount}</td>
              </tr>
            </table>
            <p style="color: #555; font-size: 14px; margin: 0;">The completed inspection form is attached. Please review and follow up on any findings as required.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: outBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    // ── 2. Save to Inspection Log ─────────────────────────────────────────────
    const entryDate = date || new Date().toISOString().split("T")[0];
    const rowToItem = new Map<number, { sectionName: string; description: string }>();
    for (const section of CHECKLIST_SECTIONS) {
      for (const item of section.items) {
        rowToItem.set(item.row, { sectionName: section.name, description: item.description });
      }
    }
    const priorityMap: Record<string, "High" | "Medium" | "Low"> = { A: "High", B: "Medium", C: "Low" };
    let imported = 0;
    for (const [rowStr, resp] of Object.entries(responses)) {
      if (!resp.rating || resp.rating === "X") continue;
      const row = parseInt(rowStr, 10);
      const itemInfo = rowToItem.get(row);
      if (!itemInfo) continue;
      const priority = priorityMap[resp.rating] ?? "Low";
      const [created] = await db
        .insert(inspectionLogTable)
        .values({
          itemCode: "IL-000",
          date: entryDate,
          zone: zoneName,
          area: itemInfo.sectionName,
          finding: itemInfo.description,
          correctiveAction: resp.correctiveAction || null,
          inspector: inspector || null,
          priority,
          assignedTo: null,
          status: "Pending",
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

    res.json({ success: true, sentTo: CO_CHAIR_EMAIL, fileName, imported });
  } catch (err) {
    console.error("Inspection email error:", err);
    res.status(500).json({ error: "Failed to send inspection email." });
  }
});

export default router;
