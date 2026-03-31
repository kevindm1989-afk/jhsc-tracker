import { Router, type IRouter } from "express";
import path from "path";
import { readFile } from "fs/promises";
import ExcelJS from "exceljs";
import { db } from "@workspace/db";
import { inspectionLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CHECKLIST_SECTIONS, ZONE_NAMES, ADDITIONAL_COMMENTS_ROW } from "../checklistData";
import { getUncachableResendClient } from "../resendClient";

const CO_CHAIR_EMAIL = "kevin_de_melo@hotmail.com";

const router: IRouter = Router();

const TEMPLATE_PATH = path.join(__dirname, "../assets/inspection_template.xlsx");

function genInspectionCode(id: number) {
  return "IL-" + String(id).padStart(3, "0");
}

function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string) {
  ws.getRow(row).getCell(col + 1).value = value;
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

async function buildFilledWorkbook(
  body: ExportBody
): Promise<{ workbook: ExcelJS.Workbook; sheetName: string } | null> {
  const { zoneIndex, date, inspector, responses, additionalComments } = body;
  if (zoneIndex == null || zoneIndex < 0 || zoneIndex > 10) return null;

  const templateBuffer = await readFile(TEMPLATE_PATH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as any);

  const sheetName = `Inspection ${zoneIndex + 1}`;
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) return null;

  if (date) setCell(ws, 4, 1, date);
  if (inspector) setCell(ws, 5, 2, inspector);

  for (const [rowStr, resp] of Object.entries(responses)) {
    const row = parseInt(rowStr, 10);
    if (!resp.rating) continue;
    setCell(ws, row, 2, resp.rating);
    if (resp.correctiveAction) setCell(ws, row, 4, resp.correctiveAction);
    if (resp.responsibleParty) setCell(ws, row, 5, resp.responsibleParty);
  }

  if (additionalComments) {
    setCell(ws, ADDITIONAL_COMMENTS_ROW + 1, 0, additionalComments);
  }

  const sheetsToRemove = workbook.worksheets.filter((s) => s.name !== sheetName);
  for (const s of sheetsToRemove) {
    workbook.removeWorksheet(s.id);
  }

  return { workbook, sheetName };
}

router.post("/export", async (req, res) => {
  try {
    const body: ExportBody = req.body;
    const { zoneIndex, date } = body;

    const result = await buildFilledWorkbook(body);
    if (!result) {
      return res.status(400).json({ error: "Invalid zone index or sheet not found in template" });
    }

    const zoneName = ZONE_NAMES[zoneIndex] ?? `Zone ${zoneIndex + 1}`;
    const safeZone = zoneName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const safeDate = date ? date.replace(/-/g, "") : "undated";
    const fileName = `JHSC_Inspection_${safeZone}_${safeDate}.xlsx`;

    const outBuffer = Buffer.from(await result.workbook.xlsx.writeBuffer());

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

router.post("/email", async (req, res) => {
  try {
    const body: ExportBody = req.body;
    const { zoneIndex, date, inspector, responses } = body;

    if (zoneIndex == null || zoneIndex < 0 || zoneIndex > 10) {
      return res.status(400).json({ error: "Invalid zone index" });
    }

    const result = await buildFilledWorkbook(body);
    if (!result) {
      return res.status(400).json({ error: "Sheet not found in template" });
    }

    const zoneName = ZONE_NAMES[zoneIndex] ?? `Zone ${zoneIndex + 1}`;
    const safeZone = zoneName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const safeDate = date ? date.replace(/-/g, "") : "undated";
    const fileName = `JHSC_Inspection_${safeZone}_${safeDate}.xlsx`;

    const outBuffer = Buffer.from(await result.workbook.xlsx.writeBuffer());
    const base64Attachment = outBuffer.toString("base64");

    const ratedCount = Object.values(responses).filter((r) => r.rating !== null).length;
    const issueCount = Object.values(responses).filter((r) => r.rating && r.rating !== "X").length;
    const displayDate = date
      ? new Date(date + "T12:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
      : "Unknown date";

    const { client, fromEmail } = await getUncachableResendClient();

    const { error } = await client.emails.send({
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
          content: base64Attachment,
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ error: "Failed to send email: " + (error as any).message });
    }

    res.json({ success: true, sentTo: CO_CHAIR_EMAIL, fileName });
  } catch (err) {
    console.error("Inspection email error:", err);
    res.status(500).json({ error: "Failed to send inspection email." });
  }
});

export default router;
