import "server-only";
import { GeminiError } from "@/lib/analysis/gemini";

// Turns any error into a JSON response the browser can show. Never includes secrets.
export function errorResponse(e: unknown): Response {
  if (e instanceof GeminiError) {
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  }
  return Response.json({ error: "Something went wrong on the server.", code: "api" }, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message, code: "bad_request" }, { status: 400 });
}
