// Runs in a Web Worker, so reading a huge file never freezes the page. It does two jobs:
//  - "preview": read the start of a file so the user can say which column is which.
//  - "import": read the whole file, feed every row to the deduplicator, and send back the result.
// Big text files (CSV, TSV, TXT, JSON Lines) are streamed piece by piece. Excel and JSON have to be read whole,
// so they have a size limit.
import Papa from "papaparse";
import type { ColumnMapping } from "../csv.ts";
import { CsvFeeder } from "./csv-feed.ts";
import { DedupeEngine, NEAR_DUP_BUDGET_MS, withTimings } from "./engine.ts";
import type { FilePreview, SourceOptions, WorkerRequest, WorkerResponse } from "./messages.ts";
import {
  LineSplitter,
  MAX_JSON_BYTES,
  MAX_XLSX_BYTES,
  TEXT_FIELD,
  cellToString,
  cleanHeader,
  fieldOf,
  findRecords,
  recordsToTable,
  syntheticHeader,
  type SourceFormat,
} from "./sources.ts";
import { chooseEncoding, decodeHead, readTextBatches } from "./text-stream.ts";

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};
const scope = self as unknown as WorkerScope;
const post = (message: WorkerResponse) => scope.postMessage(message);

const PREVIEW_ROWS = 200;
const HEAD_BYTES = 1024 * 1024;
const PROGRESS_EVERY_MS = 100;
const BATCH_ROWS = 5000;

const EMPTY_FILE = "No rows found. The file needs a header row and at least one row of data.";
const NO_RECORDS =
  'Could not find a list of records in this JSON file. It should look like [{"review": "..."}, ...] or an object that contains such a list.';

// A problem we can explain to the user in plain words.
class FileProblem extends Error {}

async function readHead(file: File) {
  const bytes = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  return { bytes, encoding: chooseEncoding(bytes), longer: file.size > bytes.byteLength };
}

// The whole file as text. Only for formats that cannot be streamed, and only below their size limit.
async function readAllText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return new TextDecoder(chooseEncoding(bytes.subarray(0, HEAD_BYTES))).decode(bytes);
}

const splitLines = (text: string) => text.split(/\r\n|\n|\r/);

function parseJsonRecords(text: string): unknown[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new FileProblem("This file is not valid JSON.");
  }
  const records = findRecords(json);
  if (!records || records.length === 0) throw new FileProblem(NO_RECORDS);
  return records;
}

async function loadXlsx(file: File) {
  if (file.size > MAX_XLSX_BYTES) {
    throw new FileProblem("This Excel file is larger than 50 MB. Save it as CSV instead, which can be any size.");
  }
  return await import("read-excel-file/web-worker");
}

const XLSX_PROBLEM =
  "This Excel file could not be read. If it is password protected or damaged, save it again as .xlsx or CSV.";

// ---------- preview ----------

function tablePreview(
  format: SourceFormat,
  all: string[][],
  o: { hasHeader: boolean; encoding: string; moreRows: boolean; sheets?: string[]; sheet?: string | null; note?: string | null },
): FilePreview {
  const header = o.hasHeader ? cleanHeader(all[0] ?? []) : syntheticHeader(all);
  const body = (o.hasHeader ? all.slice(1) : all).slice(0, PREVIEW_ROWS);
  if (body.length === 0) throw new FileProblem(EMPTY_FILE);
  return {
    format,
    fields: header,
    rows: body.map((r) => header.map((_, i) => r[i] ?? "")),
    sheets: o.sheets ?? [],
    sheet: o.sheet ?? null,
    hasHeader: o.hasHeader,
    encoding: o.encoding,
    note: o.note ?? null,
    moreRows: o.moreRows,
  };
}

async function preview(file: File, opts: SourceOptions): Promise<FilePreview> {
  switch (opts.format) {
    case "csv": {
      const h = await readHead(file);
      const text = decodeHead(h.bytes, h.encoding, h.longer, "csv");
      const all = Papa.parse<string[]>(text, { preview: PREVIEW_ROWS + 2, skipEmptyLines: true }).data;
      return tablePreview("csv", all, {
        hasHeader: opts.hasHeader,
        encoding: h.encoding,
        moreRows: h.longer || all.length > PREVIEW_ROWS + (opts.hasHeader ? 1 : 0),
      });
    }
    case "lines": {
      const h = await readHead(file);
      const lines = splitLines(decodeHead(h.bytes, h.encoding, h.longer, "lines")).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) throw new FileProblem("This file has no text in it.");
      return {
        format: "lines",
        fields: [TEXT_FIELD],
        rows: lines.slice(0, PREVIEW_ROWS).map((l) => [l]),
        sheets: [],
        sheet: null,
        hasHeader: false,
        encoding: h.encoding,
        note: "Every line is treated as one piece of feedback. Blank lines are ignored.",
        moreRows: h.longer || lines.length > PREVIEW_ROWS,
      };
    }
    case "jsonl": {
      const h = await readHead(file);
      const records: unknown[] = [];
      let unreadable = 0;
      for (const line of splitLines(decodeHead(h.bytes, h.encoding, h.longer, "lines"))) {
        const t = line.trim();
        if (!t) continue;
        try {
          records.push(JSON.parse(t));
        } catch {
          unreadable += 1;
        }
        if (records.length >= PREVIEW_ROWS) break;
      }
      if (records.length === 0) {
        throw new FileProblem('This does not look like a JSON Lines file. Each line should be one record, like {"review": "..."}.');
      }
      const table = recordsToTable(records, PREVIEW_ROWS);
      return {
        format: "jsonl",
        fields: table.fields,
        rows: table.rows,
        sheets: [],
        sheet: null,
        hasHeader: false,
        encoding: h.encoding,
        note: unreadable > 0 ? `${unreadable} lines could not be read as JSON and are skipped.` : null,
        moreRows: h.longer || records.length >= PREVIEW_ROWS,
      };
    }
    case "json": {
      if (file.size > MAX_JSON_BYTES) {
        throw new FileProblem("This JSON file is larger than 100 MB. Convert it to JSON Lines (one record per line), which can be any size.");
      }
      const records = parseJsonRecords(await readAllText(file));
      const table = recordsToTable(records, PREVIEW_ROWS);
      return {
        format: "json",
        fields: table.fields,
        rows: table.rows,
        sheets: [],
        sheet: null,
        hasHeader: false,
        encoding: "utf-8",
        note: `Found ${records.length.toLocaleString("en-US")} records.`,
        moreRows: records.length > PREVIEW_ROWS,
      };
    }
    case "xlsx": {
      const lib = await loadXlsx(file);
      let sheets: { sheet: string; data: unknown[][] }[];
      try {
        sheets = (await lib.default(file)) as unknown as { sheet: string; data: unknown[][] }[];
      } catch {
        throw new FileProblem(XLSX_PROBLEM);
      }
      if (sheets.length === 0) throw new FileProblem(XLSX_PROBLEM);
      const chosen = sheets.find((s) => s.sheet === opts.sheet) ?? sheets.find((s) => s.data.length > 0) ?? sheets[0];
      const all = chosen.data.slice(0, PREVIEW_ROWS + 2).map((r) => r.map(cellToString));
      return tablePreview("xlsx", all, {
        hasHeader: opts.hasHeader,
        encoding: "xlsx",
        moreRows: chosen.data.length > PREVIEW_ROWS + (opts.hasHeader ? 1 : 0),
        sheets: sheets.map((s) => s.sheet),
        sheet: chosen.sheet,
        note: sheets.length > 1 ? `This workbook has ${sheets.length} sheets. Pick the one with your feedback.` : null,
      });
    }
  }
}

// ---------- import ----------

async function runImport(file: File, opts: SourceOptions, mappingIn: ColumnMapping, nearDup: boolean): Promise<void> {
  const started = performance.now();
  const engine = new DedupeEngine({ nearDup, nearDupDeadline: started + NEAR_DUP_BUDGET_MS });
  // Plain text has exactly one column, whatever the user chose.
  const mapping: ColumnMapping = opts.format === "lines" ? { text: TEXT_FIELD, category: null, date: null } : mappingIn;
  const feeder = new CsvFeeder(mapping, engine);

  let lastPost = 0;
  const progress = (fraction: number | null) => {
    const now = performance.now();
    if (now - lastPost < PROGRESS_EVERY_MS) return;
    lastPost = now;
    post({
      type: "progress",
      phase: "reading",
      rowsRead: engine.rowsRead,
      percent: fraction === null ? null : Math.min(99, Math.round(fraction * 100)),
    });
  };

  // Only the chosen columns are fed to the engine, in this order, with the names as the header.
  const chosen = [mapping.text, mapping.category, mapping.date].filter((c): c is string => !!c);
  const project = (record: unknown) => chosen.map((f) => fieldOf(record, f));

  switch (opts.format) {
    case "csv": {
      const h = await readHead(file);
      const delimiter = Papa.parse(decodeHead(h.bytes, h.encoding, h.longer, "csv"), { preview: 20, skipEmptyLines: true }).meta.delimiter;
      let first = true;
      await readTextBatches(file.stream(), h.encoding, "csv", (text, bytes) => {
        const rows = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: true }).data;
        if (rows.length === 0) return;
        if (first) {
          first = false;
          if (opts.hasHeader) rows[0] = cleanHeader(rows[0]);
          else rows.unshift(syntheticHeader(rows));
        }
        feeder.feed(rows);
        progress(file.size > 0 ? bytes / file.size : null);
      });
      break;
    }
    case "lines": {
      const h = await readHead(file);
      const splitter = new LineSplitter();
      feeder.feed([[TEXT_FIELD]]);
      const feedLines = (lines: string[]) => {
        const rows = lines.map((l) => l.trim()).filter(Boolean).map((l) => [l]);
        if (rows.length > 0) feeder.feed(rows);
      };
      await readTextBatches(file.stream(), h.encoding, "lines", (text, bytes) => {
        feedLines(splitter.push(text));
        progress(file.size > 0 ? bytes / file.size : null);
      });
      feedLines(splitter.flush());
      break;
    }
    case "jsonl": {
      const h = await readHead(file);
      const splitter = new LineSplitter();
      feeder.feed([chosen]);
      const feedLines = (lines: string[]) => {
        const rows: string[][] = [];
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            rows.push(project(JSON.parse(t)));
          } catch {
            engine.addRow("", null, null); // an unreadable line counts as an empty row, so it shows in the totals
          }
        }
        if (rows.length > 0) feeder.feed(rows);
      };
      await readTextBatches(file.stream(), h.encoding, "lines", (text, bytes) => {
        feedLines(splitter.push(text));
        progress(file.size > 0 ? bytes / file.size : null);
      });
      feedLines(splitter.flush());
      break;
    }
    case "json": {
      if (file.size > MAX_JSON_BYTES) throw new FileProblem("This JSON file is larger than 100 MB. Convert it to JSON Lines instead.");
      const records = parseJsonRecords(await readAllText(file));
      feeder.feed([chosen]);
      for (let i = 0; i < records.length; i += BATCH_ROWS) {
        feeder.feed(records.slice(i, i + BATCH_ROWS).map(project));
        progress((i + BATCH_ROWS) / records.length);
      }
      break;
    }
    case "xlsx": {
      const lib = await loadXlsx(file);
      let data: unknown[][];
      try {
        data = (await lib.readSheet(file, opts.sheet ?? undefined)) as unknown[][];
      } catch {
        throw new FileProblem(XLSX_PROBLEM);
      }
      const rows = data.map((r) => r.map(cellToString)).filter((r) => r.some((c) => c.trim() !== ""));
      if (rows.length === 0) throw new FileProblem(EMPTY_FILE);
      if (opts.hasHeader) rows[0] = cleanHeader(rows[0]);
      else rows.unshift(syntheticHeader(rows));
      for (let i = 0; i < rows.length; i += BATCH_ROWS) {
        feeder.feed(rows.slice(i, i + BATCH_ROWS));
        progress((i + BATCH_ROWS) / rows.length);
      }
      break;
    }
  }

  post({ type: "progress", phase: "finishing", rowsRead: engine.rowsRead, percent: 99 });
  if (engine.rowsRead === 0) throw new FileProblem(EMPTY_FILE);
  const result = engine.finish();
  if (result.rows.length === 0) throw new FileProblem("No usable feedback text was found in the chosen column.");
  post({ type: "done", rows: result.rows, stats: withTimings(result, feeder.feedMs, performance.now() - started) });
}

scope.onmessage = (event) => {
  const req = event.data;
  const run = async () => {
    try {
      if (req.type === "preview") {
        post({ type: "preview", preview: await preview(req.file, req) });
      } else {
        await runImport(req.file, req, req.mapping, req.nearDup);
      }
    } catch (e) {
      const message =
        e instanceof FileProblem
          ? e.message
          : e instanceof Error && e.message.startsWith("The column")
            ? e.message
            : `This file could not be read (${e instanceof Error ? e.message : "unknown problem"}).`;
      post({ type: "error", message });
    }
  };
  void run();
};
