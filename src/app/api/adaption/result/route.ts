import Papa from "papaparse";
import { downloadCsv, getEvaluation, getStatus } from "@/lib/adaption/client";
import { badRequest, errorResponse, isDone } from "@/lib/adaption/http";
import type { ResultResponse } from "@/lib/adaption/types";

// Step 4: once the run has succeeded, read the quality evaluation and count the deduplicated rows.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { datasetId?: unknown; rowsSent?: unknown }
    | null;
  if (typeof body?.datasetId !== "string" || !body.datasetId) return badRequest("datasetId is required.");
  if (typeof body.rowsSent !== "number") return badRequest("rowsSent is required.");
  const { datasetId, rowsSent } = body as { datasetId: string; rowsSent: number };

  try {
    const status = await getStatus(datasetId);
    if (status.status === "failed") {
      return Response.json(
        { error: status.error ?? "The Adaption run failed.", code: "api" },
        { status: 502 },
      );
    }
    if (!isDone(status.status)) {
      const pending: ResultResponse = { state: "pending" };
      return Response.json(pending);
    }

    const evaluation = await getEvaluation(datasetId);
    if (evaluation.status === "pending" || evaluation.status === "running") {
      const pending: ResultResponse = { state: "pending" };
      return Response.json(pending);
    }

    const parsed = Papa.parse<Record<string, string>>(await downloadCsv(datasetId), {
      header: true,
      skipEmptyLines: true,
    });

    const response: ResultResponse = {
      state: "ready",
      // Column names are not documented, so they are returned to let us check them on the first real run.
      outputColumns: parsed.meta.fields ?? [],
      result: {
        datasetId,
        rowsSent,
        rowsAfter: parsed.data.length,
        // A skipped or failed evaluation has no quality metrics. The page says so instead of guessing.
        quality: evaluation.quality,
        generatedAt: new Date().toISOString(),
      },
    };
    return Response.json(response);
  } catch (e) {
    return errorResponse(e);
  }
}

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
