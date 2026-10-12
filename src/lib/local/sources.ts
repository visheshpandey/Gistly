// Helpers for reading the different kinds of files people bring: tables (CSV, TSV, Excel), JSON, JSON Lines and plain
// text. Pure functions with no browser or library code, so they can be tested in Node.

export type SourceFormat = "csv" | "lines" | "json" | "jsonl" | "xlsx";

export const FORMAT_LABEL: Record<SourceFormat, string> = {
  csv: "Table (CSV or TSV)",
  lines: "Text, one review per line",
  json: "JSON",
  jsonl: "JSON Lines",
  xlsx: "Excel workbook",
};

export const SUPPORTED_TEXT = "CSV, TSV, TXT, JSON, JSONL and Excel (.xlsx)";
export const ACCEPT_FILES = ".csv,.tsv,.txt,.json,.jsonl,.ndjson,.xlsx,.xlsm";

// Biggest sizes for formats that cannot be read piece by piece. CSV, TSV, TXT and JSONL have no limit.
export const MAX_JSON_BYTES = 100 * 1024 * 1024;
export const MAX_XLSX_BYTES = 50 * 1024 * 1024;

const OLD_EXCEL = new Set(["xls", "xlsb", "ods", "numbers"]);
const DOCUMENTS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "rtf", "png", "jpg", "jpeg", "gif", "zip", "gz", "7z", "mp3", "mp4"]);

export type Detected = { ok: true; format: SourceFormat } | { ok: false; reason: string };

// Works out the format from the file name.
export function detectFormat(fileName: string): Detected {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  if (ext === "csv" || ext === "tsv" || ext === "tab") return { ok: true, format: "csv" };
  if (ext === "txt" || ext === "text") return { ok: true, format: "lines" };
  if (ext === "json") return { ok: true, format: "json" };
  if (ext === "jsonl" || ext === "ndjson") return { ok: true, format: "jsonl" };
  if (ext === "xlsx" || ext === "xlsm") return { ok: true, format: "xlsx" };
  if (OLD_EXCEL.has(ext)) {
    return {
      ok: false,
      reason: `${ext === "xls" ? "Old Excel files (.xls)" : `.${ext} files`} are not supported. In your spreadsheet program, choose Save As and pick Excel Workbook (.xlsx) or CSV, then upload that.`,
    };
  }
  if (DOCUMENTS.has(ext)) {
    return { ok: false, reason: `.${ext} files are documents, not tables of feedback. Supported files: ${SUPPORTED_TEXT}.` };
  }
  return { ok: false, reason: `This file type is not supported. Supported files: ${SUPPORTED_TEXT}.` };
}

// Splits streamed text into lines, even when a chunk ends in the middle of a line.
export class LineSplitter {
  private tail = "";

  push(text: string): string[] {
    const parts = (this.tail + text).split(/\r\n|\n|\r/);
    this.tail = parts.pop() ?? "";
    return parts;
  }

  flush(): string[] {
    const rest = this.tail;
    this.tail = "";
    return rest === "" ? [] : [rest];
  }
}

// Turns any spreadsheet or JSON value into text. Dates become ISO text, so they can be read as dates later.
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

// Header names: trimmed, never empty, and never repeated ("Comment", "Comment (2)").
export function cleanHeader(cells: string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((raw, i) => {
    let name = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (!name) name = `Column ${i + 1}`;
    const key = name.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? name : `${name} (${n})`;
  });
}

// Names for a table with no header row: "Column 1", "Column 2", ...
export function syntheticHeader(rows: string[][]): string[] {
  const width = Math.max(1, ...rows.slice(0, 200).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
}

// Finds the list of records in a parsed JSON file: the file itself if it is a list, otherwise the first property
// that holds a list (for example {"reviews": [...]} or {"data": {"items": [...]}}).
export function findRecords(json: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && depth < 3) {
    for (const value of Object.values(json as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) return value;
    }
    for (const value of Object.values(json as Record<string, unknown>)) {
      const inner = findRecords(value, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

const MAX_FIELDS = 60;
export const TEXT_FIELD = "text";

// The column names of a list of records, in the order they first appear. A record that is just a string is a "text".
export function fieldsOf(records: unknown[]): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    if (!seen.has(name) && fields.length < MAX_FIELDS) {
      seen.add(name);
      fields.push(name);
    }
  };
  for (const record of records) {
    if (record && typeof record === "object" && !Array.isArray(record)) {
      for (const key of Object.keys(record)) add(key);
    } else if (typeof record === "string") {
      add(TEXT_FIELD);
    }
  }
  return fields;
}

// One field of one record, as text.
export function fieldOf(record: unknown, field: string): string {
  if (typeof record === "string") return field === TEXT_FIELD ? record : "";
  if (record && typeof record === "object" && !Array.isArray(record)) return cellToString((record as Record<string, unknown>)[field]);
  return "";
}

// A table (header plus rows) built from the first records, for previewing.
export function recordsToTable(records: unknown[], limit: number): { fields: string[]; rows: string[][] } {
  const sample = records.slice(0, limit);
  const fields = fieldsOf(sample);
  return { fields, rows: sample.map((r) => fields.map((f) => fieldOf(r, f))) };
}

// True when most of the non-empty values are numbers. A column like that is not feedback text.
export function looksNumeric(values: string[]): boolean {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (filled.length < 3) return false;
  const numbers = filled.filter((v) => /^[-+]?[\d,.]+%?$/.test(v) && /\d/.test(v)).length;
  return numbers / filled.length >= 0.8;
}
