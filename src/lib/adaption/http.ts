import "server-only";
import { AdaptionError } from "@/lib/adaption/client";

// Turns any error into a JSON response the browser can show. Never includes secrets.
export function errorResponse(e: unknown): Response {
  if (e instanceof AdaptionError) {
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  }
  return Response.json({ error: "Something went wrong on the server.", code: "api" }, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message, code: "bad_request" }, { status: 400 });
}

// Adaption has finished a dataset when its status is succeeded (the download docs also say "ready").
export function isDone(status: string): boolean {
  return status === "succeeded" || status === "ready";
}
