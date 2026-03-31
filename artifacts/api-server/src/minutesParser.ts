import * as XLSX from "xlsx";

function excelDateToISO(value: unknown): string | null {
  if (typeof value !== "number" || value < 1) return null;
  try {
    const d = (XLSX.SSF as any).parse_date_code(Math.floor(value));
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  } catch {
    return null;
  }
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

// All recognised section title fragments — used to avoid treating data rows as section headers
const ALL_SECTION_KEYWORDS = [
  "NEW BUSINESS", "OLD BUSINESS", "NOTICE OF RECOMMENDATION", "COMPLETED",
  "ATTENDANCE", "WORKPLACE INSPECTION", "WSIB", "EXECUTIVE SUMMARY", "KEY METRICS",
];

export function parseMinutesFile(buffer: Buffer): ParsedMinutes {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheetName = workbook.SheetNames.includes("Meeting Minutes")
    ? "Meeting Minutes"
    : workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  const result: ParsedMinutes = {
    meetingDate: "",
    facility: "",
    quorumMet: "",
    attendees: [],
    zones: [],
    actionItems: [],
    hazardFindings: [],
  };

  // Extract header info from first 10 rows
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const cell0 = str(row[0]);
    if (cell0 === "Meeting Date:") result.meetingDate = str(row[3]);
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

    // Detect section header: small integer in col 0, known section title in col 1
    // Only enters this block when the row actually contains a recognised section keyword
    // to avoid treating data rows (e.g. [1, "INSIGHT", ...]) as section markers.
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
          excelDateToISO(row[8] as number) ||
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
          excelDateToISO(row[8] as number) ||
          result.meetingDate ||
          new Date().toISOString().split("T")[0];
        result.hazardFindings.push({
          date: startDate,
          recommendationDate: startDate,
          responseDeadline: excelDateToISO(row[9] as number),
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
        const closedDate = excelDateToISO(row[13] as number);
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

  return result;
}
