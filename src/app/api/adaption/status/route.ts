import { getStatus } from "@/lib/adaption/client";
import { badRequest, handleRoute } from "@/lib/server/api";
import type { StatusResponse } from "@/lib/adaption/types";

// The browser polls this every few seconds while a run is in progress.
export const GET = handleRoute(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return badRequest("id is required.");

  const s = await getStatus(id);
  const response: StatusResponse = { status: s.status, percent: s.percent, error: s.error };
  return Response.json(response);
});
