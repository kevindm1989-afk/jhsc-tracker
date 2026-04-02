import ExcelJS from "exceljs";

function excelDateToISO(value: unknown): string | null {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value !== "number" || value < 1) return null;
  const ms = (value - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function normalizeCellValue(val: ExcelJS.CellValue | undefined): unknown {
  if (val == null) return "";
  if (val instanceof Date) return val;
  if (typeof val === "object") {
    if ("richText" in val) {
      return (val as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join("");
    }
    if ("formula" in val) {
      const result = (val as ExcelJS.CellFormulaValue).result;
      if (result == null) return "";
      if (result instanceof Date) return result;
      if (typeof result === "object" && "error" in result) return "";
      return result;
    }
    if ("error" in val) return "";
    if ("text" in val) return (val as ExcelJS.CellHyperlinkValue).text;
  }
  return val;
}

function sheetToRows(worksheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as (ExcelJS.CellValue | undefined)[];
    const arr: unknown[] = [];
    for (let i = 1; i < values.length; i++) {
      arr.push(normalizeCellValue(values[i]));
    }
    rows.push(arr);
  });
  return rows;
}

function mapDept(raw: string): "Warehouse" | "Production" | "Both" {
  const d = (raw || "").toUpperCase().trim();
  if (d === "WH") return "Warehouse";
  if (d === "OPS" || d === "CIP") return "Production";
  if (d.includes("WH") && (d.includes("OPS") || d.includes("PROD"))) return "Both";
  return "Both";
}

function mapPriority(raw: string): "High" | "Medium" | "Low" {
  const r = (raw || "").toLowerCase().trim();
  if (r === "high") return "High";
  if (r === "med" || r === "medium") return "Medium";
  if (r === "low") return "Low";
  return "Medium";
}

function mapStatus(raw: string): string {
  const s = (raw || "").trim();
  if (s === "In Progress") return "In Progress";
  if (s === "Closed") return "Closed";
  if (s === "Open") return "Open";
  return "Open";
}

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

export interface ParsedActionItem {
  date: string;
  department: "Warehouse" | "Production" | "Both";
  description: string;
  raisedBy: string;
  assignedTo: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  notes?: string;
  closedDate?: string | null;
  source: "New Business" | "Old Business" | "Closed Items";
}

export interface ParsedHazardFinding {
  date: string;
  recommendationDate: string;
  responseDeadline?: string | null;
  department: "Warehouse" | "Production" | "Both";
  hazardDescription: string;
  severity: "High" | "Medium" | "Low";
  status: string;
  notes?: string;
  ohsaReference?: string;
}

export interface ParsedAttendee {
  name: string;
  representation: string;
  role: string;
  present: boolean;
}

export interface ParsedInspectionZone {
  zone: string;
  inspector: string;
  status: string;
}

export interface ParsedMinutes {
  meetingDate: string;
  facility: string;
  quorumMet: string;
  attendees: ParsedAttendee[];
  zones: ParsedInspectionZone[];
  actionItems: ParsedActionItem[];
  hazardFindings: ParsedHazardFinding[];
}

const SECTION_KEYWORDS: Record<string, string> = {
  "NEW BUSINESS": "new",
  "OLD BUSINESS": "old",
  "NOTICE OF RECOMMENDATION": "rec",
  COMPLETED: "closed",
};

const ALL_SECTION_KEYWORDS = [
  "NEW BUSINESS", "OLD BUSINESS", "NOTICE OF RECOMMENDATION", "COMPLETED",
  "ATTENDANCE", "WORKPLACE INSPECTION", "WSIB", "EXECUTIVE SUMMARY", "KEY METRICS",
];

function parseClosedItemsSheet(
  worksheet: ExcelJS.Worksheet,
  meetingDate: string
): ParsedActionItem[] {
  const rows = sheetToRows(worksheet);
  const items: ParsedActionItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const cell0 = row[0];
    const description = str(row[1]);

    // Skip header rows and blank rows
    if (!description || description.toLowerCase().includes("description") || description.toLowerCase().includes("item")) {
      continue;
    }

    // Accept rows that start with a sequential number OR any row that has a description
    // (some sheets don't number rows)
    const hasNumber = typeof cell0 === "number" && cell0 >= 1;
    const hasDesc = description.length > 2;

    if (!hasDesc) continue;
    if (hasNumber || i > 0) {
      // Try typical column layout: col1=desc, col5=assignedTo, col7=dept, col13=closedDate
      // Also try alternate: col0=item#, col1=desc, col4=assignedTo, col6=dept, col12=closedDate
      const closedDate =
        excelDateToISO(row[13]) ||
        excelDateToISO(row[12]) ||
        excelDateToISO(row[11]) ||
        null;

      const assignedTo = str(row[5]) || str(row[4]) || str(row[3]) || "Unassigned";
      const dept = str(row[7]) || str(row[6]) || "";

      items.push({
        date: closedDate || meetingDate || new Date().toISOString().split("T")[0],
        department: mapDept(dept),
        description,
        raisedBy: "JHSC",
        assignedTo,
        priority: "Low",
        status: "Closed",
        closedDate,
        source: "Closed Items",
      });
    }
  }

  return items;
}

export async function parseMinutesFile(buffer: Buffer): Promise<ParsedMinutes> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const sheetName = sheetNames.includes("Meeting Minutes")
    ? "Meeting Minutes"
    : sheetNames[0];

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    return {
      meetingDate: "",
      facility: "",
      quorumMet: "",
      attendees: [],
      zones: [],
      actionItems: [],
      hazardFindings: [],
    };
  }

  const rows: unknown[][] = sheetToRows(worksheet);

  const result: ParsedMinutes = {
    meetingDate: "",
    facility: "",
    quorumMet: "",
    attendees: [],
    zones: [],
    actionItems: [],
    hazardFindings: [],
  };

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const cell0 = str(row[0]);
    if (cell0 === "Meeting Date:") {
      // Prefer ISO conversion (handles Date objects and numeric serials); fall back to raw string
      result.meetingDate = excelDateToISO(row[3]) || str(row[3]);
    }
    if (cell0 === "Facility / Plant:") result.facility = str(row[3]);
    if (cell0 === "Quorum Met:") result.quorumMet = str(row[3]);
  }

  let section: string | null = null;
  let skipNextRow = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === "")) continue;

    const cell0 = row[0];
    const cell1 = str(row[1]);
    const cell1Upper = cell1.toUpperCase();

    if (
      typeof cell0 === "number" &&
      cell0 >= 1 &&
      cell0 <= 9 &&
      cell1 &&
      ALL_SECTION_KEYWORDS.some((k) => cell1Upper.includes(k))
    ) {
      let matched = false;
      for (const [keyword, sectionKey] of Object.entries(SECTION_KEYWORDS)) {
        if (cell1Upper.includes(keyword)) {
          section = sectionKey;
          skipNextRow = true;
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (cell1Upper.includes("ATTENDANCE")) {
          section = "attendance";
          skipNextRow = true;
        } else if (cell1Upper.includes("WORKPLACE INSPECTION")) {
          section = "inspection";
          skipNextRow = true;
        } else {
          section = null;
        }
      }
      continue;
    }

    if (skipNextRow) {
      skipNextRow = false;
      continue;
    }

    if (section === "new" || section === "old") {
      if (typeof cell0 === "number" && cell0 >= 1 && str(row[2])) {
        const date =
          excelDateToISO(row[8]) ||
          result.meetingDate ||
          new Date().toISOString().split("T")[0];
        result.actionItems.push({
          date,
          department: mapDept(str(row[11])),
          description: str(row[2]),
          raisedBy: str(row[9]) || "JHSC",
          assignedTo: str(row[10]) || "Unassigned",
          priority: mapPriority(str(row[13])),
          status: mapStatus(str(row[12])),
          notes: str(row[5]) || undefined,
          source: section === "new" ? "New Business" : "Old Business",
        });
      }
    } else if (section === "rec") {
      if (typeof cell0 === "number" && cell0 >= 1 && cell1) {
        const startDate =
          excelDateToISO(row[8]) ||
          result.meetingDate ||
          new Date().toISOString().split("T")[0];
        result.hazardFindings.push({
          date: startDate,
          recommendationDate: startDate,
          responseDeadline: excelDateToISO(row[9]),
          department: mapDept(str(row[11])),
          hazardDescription: cell1,
          severity: mapPriority(str(row[14])),
          status: mapStatus(str(row[12])),
          notes: str(row[5]) || undefined,
          ohsaReference: "OHSA s.9(20)",
        });
      }
    } else if (section === "closed") {
      if (typeof cell0 === "number" && cell0 >= 1 && str(row[1])) {
        const closedDate = excelDateToISO(row[13]);
        result.actionItems.push({
          date:
            closedDate ||
            result.meetingDate ||
            new Date().toISOString().split("T")[0],
          department: mapDept(str(row[7])),
          description: str(row[1]),
          raisedBy: "JHSC",
          assignedTo: str(row[5]) || "Unassigned",
          priority: "Low",
          status: "Closed",
          closedDate,
          source: "Closed Items",
        });
      }
    } else if (section === "attendance") {
      if (str(row[1]) && str(row[1]) !== "Name") {
        result.attendees.push({
          name: str(row[1]),
          representation: str(row[4]),
          role: str(row[6]),
          present:
            row[9] === true ||
            str(row[9]).toLowerCase() === "true" ||
            str(row[9]).toLowerCase() === "yes",
        });
      }
    } else if (section === "inspection") {
      if (str(row[0]).toLowerCase().startsWith("zone")) {
        result.zones.push({
          zone: str(row[0]),
          inspector: str(row[2]),
          status: str(row[5]),
        });
        if (str(row[8]).toLowerCase().startsWith("zone")) {
          result.zones.push({
            zone: str(row[8]),
            inspector: str(row[10]),
            status: str(row[12]),
          });
        }
      }
    }
  }

  // Also check for a dedicated "Closed Items" sheet (any sheet whose name
  // contains "closed" or "completed", excluding the main minutes sheet).
  const closedItemsSheetNames = ["Closed Items", "Closed", "Completed Items", "Completed"];
  const closedSheet = workbook.worksheets.find((ws) => {
    if (ws.name === sheetName) return false; // skip the main sheet already parsed
    const n = ws.name.trim().toLowerCase();
    return (
      closedItemsSheetNames.some((c) => n === c.toLowerCase()) ||
      n.includes("closed") ||
      n.includes("completed")
    );
  });

  if (closedSheet) {
    const extra = parseClosedItemsSheet(closedSheet, result.meetingDate);
    // Merge: avoid duplicates already parsed from the COMPLETED section inside Meeting Minutes
    const existingDescs = new Set(
      result.actionItems
        .filter((a) => a.source === "Closed Items")
        .map((a) => a.description.toLowerCase())
    );
    for (const item of extra) {
      if (!existingDescs.has(item.description.toLowerCase())) {
        result.actionItems.push(item);
        existingDescs.add(item.description.toLowerCase());
      }
    }
  }

  return result;
}
