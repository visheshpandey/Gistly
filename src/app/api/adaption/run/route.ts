import { adapt } from "@/lib/adaption/client";
import { badRequest, handleRoute } from "@/lib/server/api";

// Step 3: start the real run. This spends credits, so it is only allowed after an estimate.
// The server cannot remember the estimate between requests, so it asks Adaption again and
// refuses unless the caller confirms the same credit amount the user was shown.
export const POST = handleRoute(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as
    | { datasetId?: unknown; confirmedCredits?: unknown }
    | null;
  if (typeof body?.datasetId !== "string" || !body.datasetId) return badRequest("datasetId is required.");
  if (typeof body.confirmedCredits !== "number") {
    return badRequest("Run an estimate first and confirm the credit cost.");
  }

  const estimate = await adapt(body.datasetId, { estimate: true });
  if (estimate.credits > body.confirmedCredits) {
    return Response.json(
      {
        error: `The cost changed to about ${estimate.credits} credits. Check the new estimate before running.`,
        code: "estimate_changed",
      },
      { status: 409 },
    );
  }
  // The idempotency key makes a double click safe: a repeat launch returns the original run.
  const run = await adapt(body.datasetId, {
    estimate: false,
    idempotencyKey: `insightflow-${body.datasetId}`,
  });
  return Response.json({ runId: run.runId, credits: estimate.credits });
});

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
