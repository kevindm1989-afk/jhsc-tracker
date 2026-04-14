import { Router } from "express";
import { db } from "@workspace/db";
import { healthSafetyReportsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import path from "path";
import { createTransporter, getSenderAddress } from "../emailClient";

const router = Router();

const CONCERN_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "unsafe_condition", label: "Unsafe condition" },
  { key: "near_miss", label: "Near miss" },
  { key: "injury_illness", label: "Injury / illness" },
  { key: "ergonomic", label: "Ergonomic" },
  { key: "equipment", label: "Equipment" },
  { key: "housekeeping", label: "Housekeeping" },
  { key: "slip_trip_fall", label: "Slip/Trip/Fall" },
  { key: "chemical", label: "Chemical" },
  { key: "unsafe_act", label: "Unsafe act" },
  { key: "other", label: "Other" },
];

async function generateExcel(report: typeof healthSafetyReportsTable.$inferSelect): Promise<Buffer> {
  const XlsxPopulate = require("xlsx-populate");
  const templatePath = path.join(__dirname, "../../assets/health_safety_form_template.xlsx");
  const wb = await XlsxPopulate.fromFileAsync(templatePath);
  const ws = wb.sheet(0);

  // Section 1 – Employee details
  // Name (C6:D6) | Date Reported (F6:G6)
  ws.cell("C6").value(report.employeeName);
  ws.cell("F6").value(report.dateReported);
  // Department (C7:D7) | Shift (F7:G7)
  ws.cell("C7").value(report.department);
  ws.cell("F7").value(report.shift);
  // Job Title (C8:G8)
  ws.cell("C8").value(report.jobTitle);
  // Supervisor / Manager (C9:G9)
  ws.cell("C9").value(report.supervisorManager);

  // Section 2 – Concern types (replace the checkbox rows with [X] for selected)
  const selected = new Set(report.concernTypes as string[]);
  const check = (key: string) => selected.has(key) ? "X" : " ";
  ws.cell("B11").value(
    `[${check("unsafe_condition")}] Unsafe condition   [${check("near_miss")}] Near miss   [${check("injury_illness")}] Injury / illness   [${check("ergonomic")}] Ergonomic`
  );
  ws.cell("B12").value(
    `[${check("equipment")}] Equipment   [${check("housekeeping")}] Housekeeping   [${check("slip_trip_fall")}] Slip/Trip/Fall   [${check("chemical")}] Chemical`
  );
  const otherText = report.otherConcernType ? report.otherConcernType : "__________";
  ws.cell("B13").value(`[${check("unsafe_act")}] Unsafe act   [${check("other")}] Other: ${otherText}`);

  // Section 3 – Location / Date / Time
  // Area / Location (C15:G15)
  ws.cell("C15").value(report.areaLocation);
  // Date (C16:D16) | Time (F16:G16)
  ws.cell("C16").value(report.incidentDate);
  ws.cell("F16").value(report.incidentTime);
  // Equipment / Task (C17:G17)
  ws.cell("C17").value(report.equipmentTask ?? "");

  // Section 4 – What happened (B19:G23 merged rows)
  ws.cell("B19").value(report.whatHappened);

  // Section 5 – Immediate action
  // Reported to supervisor (B25:G25)
  const supText = report.reportedToSupervisor
    ? "Reported to supervisor? [X] Yes   [ ] No"
    : "Reported to supervisor? [ ] Yes   [X] No";
  ws.cell("B25").value(supText);
  // Who was notified (C26:G26)
  ws.cell("C26").value(report.whoNotified ?? "");
  // Immediate action taken (C27:G27)
  ws.cell("C27").value(report.immediateActionTaken ?? "");

  // Section 6 – Witnesses / Corrective action
  // Witnesses (C29:G29)
  ws.cell("C29").value(report.witnesses ?? "");
  // Suggested correction (B31:G31 — B30 is the label row)
  ws.cell("B31").value(report.suggestedCorrection ?? "");

  // Section 7 – Employee signature
  // Signature (C34:D34) | Date (F34:G34)
  ws.cell("C34").value(report.employeeSignature);
  ws.cell("F34").value(report.signatureDate);

  return wb.outputAsync() as Promise<Buffer>;
}

// GET /health-safety-reports — all authenticated users see all reports
router.get("/", async (req, res) => {
  try {
    const reports = await db
      .select()
      .from(healthSafetyReportsTable)
      .orderBy(desc(healthSafetyReportsTable.createdAt));
    res.json(reports);
  } catch (err) {
    console.error("GET health-safety-reports error", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// POST /health-safety-reports — submit a new report
router.post("/", async (req, res) => {
  try {
    const session = req.session as any;
    const submittedByUserId: number = session?.userId ?? null;
    const submittedByName: string =
      session?.displayName ?? session?.username ?? "Unknown";

    // Generate report code: HS-YYYYMMDD-XXX
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
    const existing = await db
      .select({ code: healthSafetyReportsTable.reportCode })
      .from(healthSafetyReportsTable);
    const seq = existing.length + 1;
    const reportCode = `HS-${datePart}-${String(seq).padStart(3, "0")}`;

    const body = req.body;
    const [report] = await db
      .insert(healthSafetyReportsTable)
      .values({
        reportCode,
        employeeName: body.employeeName,
        department: body.department,
        jobTitle: body.jobTitle,
        shift: body.shift,
        dateReported: body.dateReported,
        supervisorManager: body.supervisorManager,
        concernTypes: body.concernTypes ?? [],
        otherConcernType: body.otherConcernType ?? null,
        areaLocation: body.areaLocation,
        incidentDate: body.incidentDate,
        incidentTime: body.incidentTime,
        equipmentTask: body.equipmentTask ?? null,
        whatHappened: body.whatHappened,
        reportedToSupervisor: body.reportedToSupervisor === true,
        whoNotified: body.whoNotified ?? null,
        immediateActionTaken: body.immediateActionTaken ?? null,
        witnesses: body.witnesses ?? null,
        suggestedCorrection: body.suggestedCorrection ?? null,
        employeeSignature: body.employeeSignature,
        signatureDate: body.signatureDate,
        submittedByUserId,
        submittedByName,
      })
      .returning();

    // Send email with Excel attachment (non-blocking)
    setImmediate(async () => {
      try {
        const excelBuf = await generateExcel(report);
        const transporter = createTransporter();
        const sender = getSenderAddress();
        const selectedLabels = (report.concernTypes as string[])
          .map((k) => CONCERN_OPTIONS.find((o) => o.key === k)?.label ?? k)
          .join(", ");

        await transporter.sendMail({
          from: `"JHSC Tracker" <${sender}>`,
          to: sender,
          subject: `H&S Concern Report – ${reportCode} – ${report.employeeName}`,
          html: `
            <h2>JHSC Health &amp; Safety Concern Report</h2>
            <p><strong>Report #:</strong> ${reportCode}</p>
            <p><strong>Submitted by:</strong> ${submittedByName}</p>
            <p><strong>Employee:</strong> ${report.employeeName}</p>
            <p><strong>Department:</strong> ${report.department} | <strong>Shift:</strong> ${report.shift}</p>
            <p><strong>Date Reported:</strong> ${report.dateReported}</p>
            <p><strong>Concern Types:</strong> ${selectedLabels || "None selected"}${report.otherConcernType ? ` / Other: ${report.otherConcernType}` : ""}</p>
            <p><strong>Location:</strong> ${report.areaLocation} | <strong>Incident Date:</strong> ${report.incidentDate} ${report.incidentTime}</p>
            <p><strong>What Happened:</strong><br>${report.whatHappened.replace(/\n/g, "<br>")}</p>
            <p><strong>Reported to Supervisor:</strong> ${report.reportedToSupervisor ? "Yes" : "No"}${report.whoNotified ? ` — Notified: ${report.whoNotified}` : ""}</p>
            ${report.immediateActionTaken ? `<p><strong>Immediate Action:</strong> ${report.immediateActionTaken}</p>` : ""}
            ${report.witnesses ? `<p><strong>Witnesses:</strong> ${report.witnesses}</p>` : ""}
            ${report.suggestedCorrection ? `<p><strong>Suggested Correction:</strong> ${report.suggestedCorrection}</p>` : ""}
            <hr>
            <p style="font-size:12px;color:#888">The completed Excel form is attached. Submitted via JHSC Tracker.</p>
          `,
          attachments: [
            {
              filename: `${reportCode}_Health_Safety_Report.xlsx`,
              content: excelBuf,
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });
      } catch (mailErr) {
        console.error("Failed to send H&S report email:", mailErr);
      }
    });

    res.status(201).json({ report });
  } catch (err) {
    console.error("POST health-safety-reports error", err);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

// DELETE /health-safety-reports/:id — admin only
router.delete("/:id", async (req, res) => {
  try {
    const session = req.session as any;
    if (session?.role !== "admin" && session?.role !== "co-chair") return res.status(403).json({ error: "Access denied" });
    const id = parseInt(req.params.id as string);
    await db.delete(healthSafetyReportsTable).where(eq(healthSafetyReportsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE health-safety-reports error", err);
    return res.status(500).json({ error: "Failed to delete report" });
  }
});

export default router;
