import { getStatus } from "@/lib/adaption/client";
import { badRequest, errorResponse } from "@/lib/adaption/http";
import type { StatusResponse } from "@/lib/adaption/types";

// The browser polls this every few seconds while a run is in progress.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return badRequest("id is required.");

  try {
    const s = await getStatus(id);
    const response: StatusResponse = { status: s.status, percent: s.percent, error: s.error };
    return Response.json(response);
  } catch (e) {
    return errorResponse(e);
  }
}
