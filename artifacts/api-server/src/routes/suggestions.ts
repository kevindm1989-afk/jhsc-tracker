import { Router } from "express";
import { db } from "@workspace/db";
import { suggestionsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import path from "path";
import { createTransporter, getSenderAddress } from "../emailClient";

const router = Router();

async function generateExcel(s: typeof suggestionsTable.$inferSelect): Promise<Buffer> {
  const XlsxPopulate = require("xlsx-populate");
  const templatePath = path.join(__dirname, "../../assets/suggestions_form_template.xlsx");
  const wb = await XlsxPopulate.fromFileAsync(templatePath);
  const ws = wb.sheet(0);

  ws.cell("C6").value(s.employeeName);
  ws.cell("F6").value(s.dateSubmitted);
  ws.cell("C7").value(s.department);
  ws.cell("C8").value(s.shift);

  ws.cell("B11").value(s.dateObserved);
  const pl = s.priorityLevel.toLowerCase();
  ws.cell("F11").value(
    `[${pl === "high" ? "X" : " "}] High   [${pl === "medium" ? "X" : " "}] Medium   [${pl === "low" ? "X" : " "}] Low`
  );
  ws.cell("C12").value(s.locationOfConcern);

  ws.cell("A15").value(s.description);
  ws.cell("A20").value(s.proposedSolution);

  return wb.outputAsync() as Promise<Buffer>;
}

// GET /suggestions — admin sees all, member sees own
router.get("/", async (req, res) => {
  try {
    const session = req.session as any;
    const role = session?.role;
    const userId = session?.userId;
    const rows = await db
      .select()
      .from(suggestionsTable)
      .orderBy(desc(suggestionsTable.createdAt));
    const filtered = role === "admin" ? rows : rows.filter((r) => r.submittedByUserId === userId);
    res.json(filtered);
  } catch (err) {
    console.error("GET suggestions error", err);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

// POST /suggestions — submit a new suggestion
router.post("/", async (req, res) => {
  try {
    const session = req.session as any;
    const body = req.body;
    const isAnonymous = body.isAnonymous === true;

    const submittedByUserId: number | null = isAnonymous ? null : (session?.userId ?? null);
    const submittedByName: string = isAnonymous ? "Anonymous" : (session?.displayName ?? session?.username ?? "Unknown");
    const employeeName: string = isAnonymous ? "Anonymous" : (body.employeeName ?? "Unknown");

    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
    const existing = await db.select({ code: suggestionsTable.suggestionCode }).from(suggestionsTable);
    const seq = existing.length + 1;
    const suggestionCode = `SUG-${datePart}-${String(seq).padStart(3, "0")}`;

    const [suggestion] = await db
      .insert(suggestionsTable)
      .values({
        suggestionCode,
        employeeName,
        department: body.department,
        shift: body.shift,
        dateSubmitted: body.dateSubmitted,
        dateObserved: body.dateObserved,
        priorityLevel: body.priorityLevel,
        locationOfConcern: body.locationOfConcern,
        description: body.description,
        proposedSolution: body.proposedSolution,
        submittedByUserId,
        submittedByName,
      })
      .returning();

    setImmediate(async () => {
      try {
        const excelBuf = await generateExcel(suggestion);
        const transporter = createTransporter();
        const sender = getSenderAddress();
        await transporter.sendMail({
          from: `"JHSC Tracker" <${sender}>`,
          to: sender,
          subject: `Employee Suggestion – ${suggestionCode} – ${isAnonymous ? "Anonymous" : suggestion.employeeName}`,
          html: `
            <h2>JHSC Employee Suggestion</h2>
            <p><strong>Reference #:</strong> ${suggestionCode}</p>
            ${isAnonymous ? "<p><strong>Submitted by:</strong> Anonymous (identity not stored)</p>" : `<p><strong>Submitted by:</strong> ${submittedByName}</p><p><strong>Employee:</strong> ${suggestion.employeeName}</p>`}
            <p><strong>Department:</strong> ${suggestion.department} | <strong>Shift:</strong> ${suggestion.shift}</p>
            <p><strong>Date Submitted:</strong> ${suggestion.dateSubmitted} | <strong>Date Observed:</strong> ${suggestion.dateObserved}</p>
            <p><strong>Priority:</strong> ${suggestion.priorityLevel.charAt(0).toUpperCase() + suggestion.priorityLevel.slice(1)}</p>
            <p><strong>Location:</strong> ${suggestion.locationOfConcern}</p>
            <p><strong>Description:</strong><br>${suggestion.description.replace(/\n/g, "<br>")}</p>
            <p><strong>Proposed Solution:</strong><br>${suggestion.proposedSolution.replace(/\n/g, "<br>")}</p>
            <hr>
            <p style="font-size:12px;color:#888">The completed form is attached. Submitted via JHSC Tracker.</p>
          `,
          attachments: [
            {
              filename: `${suggestionCode}_Employee_Suggestion.xlsx`,
              content: excelBuf,
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });
      } catch (mailErr) {
        console.error("Failed to send suggestion email:", mailErr);
      }
    });

    res.status(201).json({ suggestion });
  } catch (err) {
    console.error("POST suggestions error", err);
    res.status(500).json({ error: "Failed to submit suggestion" });
  }
});

// DELETE /suggestions/:id — admin only
router.delete("/:id", async (req, res) => {
  try {
    const session = req.session as any;
    if (session?.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const id = parseInt(req.params.id);
    await db.delete(suggestionsTable).where(eq(suggestionsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE suggestions error", err);
    return res.status(500).json({ error: "Failed to delete suggestion" });
  }
});

export default router;
