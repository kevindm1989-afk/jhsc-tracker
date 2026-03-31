import * as XLSX from "xlsx";

// Excel serial → ISO date string
function excelDateToISO(value: unknown): string | null {
  if (typeof value !== "number" || value < 1) return null;
  try {
    const d = (XLSX.SSF as any).parse_date_code(Math.floor(value));
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

// Zone name map: "Zone N" → short display name
const ZONE_NAMES: Record<string, string> = {
  "Zone 1": "Zone 1 — Process / Production",
  "Zone 2": "Zone 2 — Tank Gallery / Labs",
  "Zone 3": "Zone 3 — Basement / Raw Milk Receiving",
  "Zone 4": "Zone 4 — Employee Facilities",
  "Zone 5": "Zone 5 — Exterior Building",
  "Zone 6": "Zone 6 — Cold Warehouse",
  "Zone 7": "Zone 7 — WH #2 / Case Wash",
  "Zone 8": "Zone 8 — Maintenance / Boiler / Ammonia",
  "Zone 9": "Zone 9 — Caser Stacker / Chain System",
  "Zone 10": "Zone 10 — Warehouse #1",
  "Zone 11": "Zone 11 — Maintenance Boiler / Hot Water",
};

function normalizeZone(rawZone: string): string {
  // Extract "Zone N" prefix e.g. "Zone 1 (Process Rooms...)" → "Zone 1"
  const match = rawZone.match(/^(Zone\s+\d+)/i);
  if (match) {
    const key = match[1].replace(/\s+/, " ");
    return ZONE_NAMES[key] || key;
  }
  return rawZone || "Unknown Zone";
}

function toHazardRating(v: unknown): "A" | "B" | "C" | null {
  const s = str(v).toUpperCase();
  if (s === "A" || s === "B" || s === "C") return s;
  return null;
}

function toPriority(rating: "A" | "B" | "C"): "High" | "Medium" | "Low" {
  if (rating === "A") return "High";
  if (rating === "B") return "Medium";
  return "Low";
}

export interface ParsedInspectionFinding {
  zone: string;
  date: string;
  area: string;
  finding: string;
  hazardRating: "A" | "B" | "C";
  priority: "High" | "Medium" | "Low";
  assignedTo: string;
  inspector: string;
  notes: string;
}

export interface ParsedInspectionSheet {
  sheetName: string;
  zone: string;
  date: string;
  inspector: string;
  findings: ParsedInspectionFinding[];
  additionalComments: string;
}

export interface ParsedInspectionFile {
  sheets: ParsedInspectionSheet[];
  totalFindings: number;
  isBlank: boolean;
}

function parseInspectionSheet(rows: unknown[][], sheetName: string): ParsedInspectionSheet {
  // Zone: row 5 (index 4), col B (index 1)
  const rawZone = str(rows[4]?.[1]) || sheetName;
  const zone = normalizeZone(rawZone);

  // Date: row 4 (index 3), col B (index 1)
  let date = "";
  const dateVal = rows[3]?.[1];
  if (typeof dateVal === "number" && dateVal > 100) {
    date = excelDateToISO(dateVal) || "";
  } else if (typeof dateVal === "string" && dateVal && dateVal !== "DATE") {
    date = dateVal.trim();
  }

  // Inspector: row 4 col D (index 3), row 5 col D, or row 5 col C
  let inspector = "";
  for (const [ri, ci] of [[3, 3], [3, 4], [4, 3], [4, 2]]) {
    const v = str(rows[ri as number]?.[ci as number]);
    if (v && !v.includes("Print clearly") && !v.includes("SIGNATURES") && !v.includes("INSPECTORS")) {
      inspector = v;
      break;
    }
  }

  const findings: ParsedInspectionFinding[] = [];
  let currentSection = "";
  let additionalComments = "";

  for (let i = 8; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;

    const cellA = row[0];
    const cellB = str(row[1]);
    const cellC = row[2];
    const cellE = str(row[4]);
    const cellF = str(row[5]);

    // Additional comments row
    if (str(cellA) === "Additional Comments:" || cellB.toLowerCase().startsWith("additional comment")) {
      additionalComments = str(row[1]) || str(row[2]);
      continue;
    }

    // Section header: integer in col A, non-empty description in col B, no hazard rating
    if (typeof cellA === "number" && Number.isInteger(cellA) && cellA > 0 && cellB) {
      currentSection = cellB;
      continue;
    }

    // Checklist item: numeric (decimal) or string decimal in col A, description in col B
    const hasItemRef =
      (typeof cellA === "number" && cellA > 0 && !Number.isInteger(cellA)) ||
      (typeof cellA === "string" && /^\d+[\.\s]\d+/.test(cellA));

    if (!hasItemRef || !cellB) continue;

    const rating = toHazardRating(cellC);
    if (!rating) continue; // Only import actual issues (A/B/C), skip blank or X

    const findingText = cellE
      ? `${cellB} — ${cellE}`
      : cellB;

    findings.push({
      zone,
      date,
      area: currentSection,
      finding: findingText,
      hazardRating: rating,
      priority: toPriority(rating),
      assignedTo: cellF || "",
      inspector,
      notes: "",
    });
  }

  return { sheetName, zone, date, inspector, findings, additionalComments };
}

export function parseInspectionFile(buffer: Buffer): ParsedInspectionFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheets: ParsedInspectionSheet[] = [];
  let totalFindings = 0;

  for (const sheetName of workbook.SheetNames) {
    if (!sheetName.trim().toLowerCase().startsWith("inspection")) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as unknown[][];

    const parsed = parseInspectionSheet(rows, sheetName);
    sheets.push(parsed);
    totalFindings += parsed.findings.length;
  }

  return {
    sheets,
    totalFindings,
    isBlank: totalFindings === 0,
  };
}

// Export zone names for use in the frontend
export { ZONE_NAMES };
