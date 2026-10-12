import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/server/env";
import { ServiceError } from "@/lib/server/service-error";

// Server-only wrapper around the Adaption REST API.
// Endpoints and fields follow https://docs.adaptionlabs.ai/api (checked 2026-10-11).
// The API key is read from the environment here and never leaves the server.

const BASE_URL = "https://api.prod.adaptionlabs.ai";

export type AdaptionErrorCode =
  | "not_configured"
  | "not_ready"
  | "auth"
  | "credits"
  | "rate_limit"
  | "timeout"
  | "network"
  | "api";

export class AdaptionError extends ServiceError<AdaptionErrorCode> {
  constructor(message: string, code: AdaptionErrorCode, status: number) {
    super(message, code, status);
    this.name = "AdaptionError";
  }
}

// Adaption has finished a dataset when its status is succeeded (the download docs also say "ready").
export function isDone(status: string): boolean {
  return status === "succeeded" || status === "ready";
}

function apiKey(): string {
  const key = serverEnv.adaptionApiKey();
  if (!key) {
    throw new AdaptionError(
      "Adaption is not configured. Add ADAPTION_API_KEY to .env.local and restart the server.",
      "not_configured",
      503,
    );
  }
  return key;
}

async function errorFromResponse(res: Response): Promise<AdaptionError> {
  let detail = "";
  try {
    const body = (await res.json()) as Record<string, unknown>;
    const pick = body.message ?? body.detail ?? body.error;
    detail = typeof pick === "string" ? pick : "";
  } catch {
    // The body was not JSON. The status code is enough.
  }
  const suffix = detail ? ` (${detail})` : "";
  if (res.status === 401 || res.status === 403) {
    return new AdaptionError(`Adaption rejected the API key${suffix}.`, "auth", 502);
  }
  if (res.status === 402) {
    return new AdaptionError(`Not enough Adaption credits${suffix}.`, "credits", 402);
  }
  if (res.status === 409) {
    // Adaption answers 409 while a dataset is still being imported. The caller can retry shortly.
    return new AdaptionError(
      "Adaption is still preparing your file. This usually takes a few seconds.",
      "not_ready",
      409,
    );
  }
  if (res.status === 429) {
    return new AdaptionError("Adaption is rate limiting requests. Wait a moment and try again.", "rate_limit", 429);
  }
  return new AdaptionError(`Adaption returned an error (HTTP ${res.status})${suffix}.`, "api", 502);
}

async function call(
  path: string,
  init: { method?: string; body?: unknown } = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const key = apiKey();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new AdaptionError("Adaption took too long to answer. Please try again.", "timeout", 504);
    }
    throw new AdaptionError("Could not reach Adaption. Check your internet connection.", "network", 502);
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res;
}

async function callJson(path: string, init?: { method?: string; body?: unknown }, timeoutMs?: number) {
  const res = await call(path, init, timeoutMs);
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new AdaptionError("Adaption sent a response we could not read.", "api", 502);
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

const dataset = (id: string) => `/api/v1/datasets/${encodeURIComponent(id)}`;

// Step 1: create a dataset and get a one-time upload URL.
export async function createDataset(name: string): Promise<{ datasetId: string; uploadUrl: string }> {
  const body = await callJson("/api/v1/datasets", { method: "POST", body: { source: { name } } });
  const datasetId = asString(body.dataset_id);
  const uploadUrl = asString(asObject(body.upload_instructions)?.url);
  if (!datasetId || !uploadUrl) {
    throw new AdaptionError("Adaption did not return an upload location.", "api", 502);
  }
  return { datasetId, uploadUrl };
}

// Step 2: send the CSV bytes to the presigned storage URL. This URL is not the Adaption API,
// so the API key is deliberately NOT sent here.
export async function uploadFile(uploadUrl: string, csv: string): Promise<void> {
  const bytes = Buffer.from(csv, "utf8");
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      body: bytes,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AdaptionError("Could not upload the file to Adaption.", "network", 502);
  }
  if (!res.ok) {
    throw new AdaptionError(`Uploading the file to Adaption failed (HTTP ${res.status}).`, "api", 502);
  }
}

// Step 3: tell Adaption the upload is finished. It checks the file and starts importing it.
// Without this call the dataset stays "pending" forever.
export async function completeUpload(id: string, csv: string): Promise<void> {
  const bytes = Buffer.from(csv, "utf8");
  await callJson(`${dataset(id)}/upload/complete`, {
    method: "POST",
    body: {
      file_size_bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  });
}

export type DatasetStatus = {
  status: string;
  rowCount: number | null;
  percent: number | null;
  error: string | null;
};

export async function getStatus(id: string): Promise<DatasetStatus> {
  const body = await callJson(`${dataset(id)}/status`);
  const progress = asObject(body.progress);
  const errorData = asObject(body.error_data);
  return {
    status: asString(body.status) ?? "unknown",
    rowCount: asNumber(body.row_count),
    percent: asNumber(progress?.percent),
    error: asString(errorData?.message),
  };
}

export type AdaptResult = { runId: string | null; credits: number; minutes: number };

// Only the Prompt Deduplication recipe is on. Rephrasing and reasoning traces are off explicitly,
// because the docs do not say what the defaults are.
// With estimate = true nothing runs and no credits are spent.
export async function adapt(
  id: string,
  options: { estimate: boolean; idempotencyKey?: string },
): Promise<AdaptResult> {
  const body = await callJson(`${dataset(id)}/adapt`, {
    method: "POST",
    body: {
      estimate: options.estimate,
      column_mapping: { prompt: "review" },
      recipe_specification: {
        recipes: { deduplication: true, prompt_rephrase: false, reasoning_traces: false },
      },
      training_type: "instruction_dataset",
      ...(options.idempotencyKey ? { job_specification: { idempotency_key: options.idempotencyKey } } : {}),
    },
  });
  return {
    runId: asString(body.run_id),
    credits: asNumber(body.estimatedCreditsConsumed) ?? 0,
    minutes: asNumber(body.estimatedMinutes) ?? 0,
  };
}

export type Evaluation = {
  status: string;
  quality: {
    gradeBefore: string | null;
    gradeAfter: string | null;
    scoreBefore: number | null;
    scoreAfter: number | null;
    percentileAfter: number | null;
  } | null;
};

export async function getEvaluation(id: string): Promise<Evaluation> {
  const body = await callJson(`${dataset(id)}/evaluation`);
  const q = asObject(body.quality);
  return {
    status: asString(body.status) ?? "unknown",
    quality: q
      ? {
          gradeBefore: asString(q.grade_before),
          gradeAfter: asString(q.grade_after),
          scoreBefore: asNumber(q.score_before),
          scoreAfter: asNumber(q.score_after),
          percentileAfter: asNumber(q.percentile_after),
        }
      : null,
  };
}

// The download is a binary stream. We ask for CSV and read it as text.
export async function downloadCsv(id: string): Promise<string> {
  const res = await call(`${dataset(id)}/download?fileFormat=csv`, {}, 120_000);
  return await res.text();
}
