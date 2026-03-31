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

function str(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

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
  const rawZone = str(rows[4]?.[1]) || sheetName;
  const zone = normalizeZone(rawZone);

  let date = "";
  const dateVal = rows[3]?.[1];
  if (dateVal instanceof Date) {
    date = excelDateToISO(dateVal) || "";
  } else if (typeof dateVal === "number" && dateVal > 100) {
    date = excelDateToISO(dateVal) || "";
  } else if (typeof dateVal === "string" && dateVal && dateVal !== "DATE") {
    date = dateVal.trim();
  }

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

    if (str(cellA) === "Additional Comments:" || cellB.toLowerCase().startsWith("additional comment")) {
      additionalComments = str(row[1]) || str(row[2]);
      continue;
    }

    if (typeof cellA === "number" && Number.isInteger(cellA) && cellA > 0 && cellB) {
      currentSection = cellB;
      continue;
    }

    const hasItemRef =
      (typeof cellA === "number" && cellA > 0 && !Number.isInteger(cellA)) ||
      (typeof cellA === "string" && /^\d+[\.\s]\d+/.test(cellA));

    if (!hasItemRef || !cellB) continue;

    const rating = toHazardRating(cellC);
    if (!rating) continue;

    const findingText = cellE ? `${cellB} — ${cellE}` : cellB;

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

export async function parseInspectionFile(buffer: Buffer): Promise<ParsedInspectionFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheets: ParsedInspectionSheet[] = [];
  let totalFindings = 0;

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    if (!sheetName.trim().toLowerCase().startsWith("inspection")) continue;
    if (worksheet.rowCount === 0) continue;

    const rows = sheetToRows(worksheet);
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

export { ZONE_NAMES };
