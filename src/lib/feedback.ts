// Loads the built-in sample dataset on the server.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type { FeedbackRow, LocalStats } from "@/lib/feedback-types";
import { CsvFeeder } from "@/lib/local/csv-feed";
import { DedupeEngine, withTimings } from "@/lib/local/engine";

const CSV_PATH = path.join(process.cwd(), "data", "feedback.csv");

export type SampleResult = { rows: FeedbackRow[]; stats: LocalStats | null; error: string | null };

// Loads the built-in sample dataset (columns: review, category).
// Used by /api/sample. It goes through the same engine as an uploaded file, so the numbers match.
export async function loadSample(): Promise<SampleResult> {
  let raw: string;
  try {
    raw = await fs.readFile(CSV_PATH, "utf8");
  } catch {
    return {
      rows: [],
      stats: null,
      error:
        "data/feedback.csv was not found. Copy the dataset into the data folder (see data/README.md).",
    };
  }

  const started = performance.now();
  const engine = new DedupeEngine({ nearDup: false });
  const feeder = new CsvFeeder({ text: "review", category: "category", date: null }, engine);
  try {
    feeder.feed(Papa.parse<string[]>(raw, { skipEmptyLines: true }).data);
  } catch {
    return {
      rows: [],
      stats: null,
      error: "data/feedback.csv has no usable rows. It needs the columns: review, category.",
    };
  }

  const result = engine.finish();
  if (result.rows.length === 0) {
    return {
      rows: [],
      stats: null,
      error: "data/feedback.csv has no usable rows. It needs the columns: review, category.",
    };
  }
  const stats = withTimings(result, feeder.feedMs, performance.now() - started);
  return { rows: result.rows, stats, error: null };
}
