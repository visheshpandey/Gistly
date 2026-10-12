import Papa from "papaparse";
import { completeUpload, createDataset, uploadFile } from "@/lib/adaption/client";
import { badRequest, errorResponse } from "@/lib/adaption/http";
import { MAX_ROWS_SENT } from "@/lib/adaption/types";

type InputRow = { review: string; category: string | null; occurrences: number };

function parseRows(body: unknown): InputRow[] | null {
  const rows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const out: InputRow[] = [];
  for (const r of rows) {
    const row = r as Partial<InputRow> | null;
    if (
      !row ||
      typeof row.review !== "string" ||
      typeof row.occurrences !== "number" ||
      !Number.isInteger(row.occurrences) ||
      row.occurrences < 1
    ) {
      return null;
    }
    out.push({
      review: row.review,
      category: typeof row.category === "string" ? row.category : null,
      occurrences: row.occurrences,
    });
  }
  return out;
}

// Step 1 of a run: build a CSV with one line per row sent (repeats included, so Adaption has
// real duplicates to remove), create the dataset on Adaption and upload the file. No credits are used.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rows = parseRows(body);
  if (!rows) return badRequest("Send a list of feedback rows with review text and occurrence counts.");

  // The browser already caps repeats and samples big files. This is a safety net for direct calls.
  const mentions = rows.reduce((sum, r) => sum + r.occurrences, 0);
  if (mentions > MAX_ROWS_SENT) {
    return badRequest(
      `Too many rows for one Adaption run (${mentions.toLocaleString("en-US")}). The limit is ${MAX_ROWS_SENT.toLocaleString("en-US")}.`,
    );
  }

  const hasCategory = rows.some((r) => r.category);
  const records: Record<string, string>[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.occurrences; i++) {
      records.push(hasCategory ? { review: row.review, category: row.category ?? "" } : { review: row.review });
    }
  }
  const csv = Papa.unparse(records);

  try {
    const { datasetId, uploadUrl } = await createDataset(`insightflow-${Date.now()}.csv`);
    await uploadFile(uploadUrl, csv);
    await completeUpload(datasetId, csv);
    return Response.json({ datasetId, mentions });
  } catch (e) {
    return errorResponse(e);
  }
}

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
