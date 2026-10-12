import "server-only";

// Server-only wrapper around the Gemini API (Google AI Studio).
// The key and the model name come from the environment and never reach the browser.
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "network"
  | "bad_output"
  | "api";

export class GeminiError extends Error {
  code: GeminiErrorCode;
  status: number; // HTTP status we answer our own client with

  constructor(message: string, code: GeminiErrorCode, status: number) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

function settings(): { key: string; model: string } {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!key || !model) {
    throw new GeminiError(
      "AI analysis is not configured. Add GEMINI_API_KEY and GEMINI_MODEL to .env.local and restart the server.",
      "not_configured",
      503,
    );
  }
  return { key, model };
}

async function errorFromResponse(res: Response): Promise<GeminiError> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    // The body was not JSON. The status code is enough.
  }
  const suffix = detail ? ` (${detail.slice(0, 160)})` : "";
  if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(detail))) {
    return new GeminiError(`Gemini rejected the API key${suffix}.`, "auth", 502);
  }
  if (res.status === 404) {
    return new GeminiError("Gemini does not know this model. Check GEMINI_MODEL in .env.local.", "api", 502);
  }
  if (res.status === 429) {
    return new GeminiError("Gemini is rate limiting requests. Waiting a moment and retrying.", "rate_limit", 429);
  }
  return new GeminiError(`Gemini returned an error (HTTP ${res.status})${suffix}.`, "api", 502);
}

// Asks Gemini for JSON that matches `schema`. Returns the parsed JSON and the model that answered.
export async function generateJson(
  prompt: string,
  schema: object,
  timeoutMs = 45_000,
): Promise<{ data: unknown; model: string }> {
  const { key, model } = settings();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new GeminiError("Gemini took too long to answer.", "timeout", 504);
    }
    throw new GeminiError("Could not reach Gemini. Check your internet connection.", "network", 502);
  }
  if (!res.ok) throw await errorFromResponse(res);

  let body: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    body = await res.json();
  } catch {
    throw new GeminiError("Gemini sent a response we could not read.", "bad_output", 502);
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiError("Gemini returned no answer for this batch.", "bad_output", 502);
  }
  try {
    return { data: JSON.parse(text), model };
  } catch {
    throw new GeminiError("Gemini returned text that is not valid JSON.", "bad_output", 502);
  }
}
