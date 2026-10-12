import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ServiceError } from "@/lib/server/service-error";

// Shared helpers for every route in src/app/api. Every error leaves as the same JSON shape:
//   { error: "message for the user", code: "short_code" }
// so the browser can always show something sensible, and secrets or stack traces never leak.

export type ApiError = { error: string; code: string };

export function errorResponse(e: unknown): Response {
  if (e instanceof ServiceError) {
    return Response.json({ error: e.message, code: e.code } satisfies ApiError, { status: e.status });
  }
  return Response.json({ error: "Something went wrong on the server.", code: "api" } satisfies ApiError, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message, code: "bad_request" } satisfies ApiError, { status: 400 });
}

// Wraps a route handler so nothing can escape as an unhandled crash. Expected service errors are answered as they
// are; anything unexpected is logged on the server (for Vercel's logs) and answered with a generic message.
export function handleRoute<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      // Next.js uses thrown signals of its own (for example to mark a route as dynamic). Let those through.
      unstable_rethrow(e);
      if (!(e instanceof ServiceError)) console.error("[api] unexpected error", e);
      return errorResponse(e);
    }
  };
}
