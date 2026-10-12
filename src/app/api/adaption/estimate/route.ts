import { adapt, getStatus } from "@/lib/adaption/client";
import { badRequest, errorResponse } from "@/lib/adaption/http";
import type { EstimateResponse } from "@/lib/adaption/types";

// Step 2: ask Adaption what a run would cost. estimate = true, so nothing runs and no credits are used.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { datasetId?: unknown } | null;
  if (typeof body?.datasetId !== "string" || !body.datasetId) return badRequest("datasetId is required.");

  try {
    // The upload needs a moment to be processed. Report it clearly if it is not ready yet.
    const status = await getStatus(body.datasetId);
    if (status.status === "failed") {
      return Response.json(
        { error: status.error ?? "Adaption could not process the uploaded file.", code: "api" },
        { status: 502 },
      );
    }
    const result = await adapt(body.datasetId, { estimate: true });
    const response: EstimateResponse = {
      datasetId: body.datasetId,
      credits: result.credits,
      minutes: result.minutes,
    };
    return Response.json(response);
  } catch (e) {
    return errorResponse(e);
  }
}

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
