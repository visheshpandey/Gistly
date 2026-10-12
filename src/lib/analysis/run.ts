import type { FeedbackRow } from "../feedback-types.ts";
import { computeMetrics } from "./metrics.ts";
import { rankPriorities } from "./priority.ts";
import {
  BATCH_SIZE,
  MAX_ACTION_THEMES,
  MAX_ANALYSED,
  THEME_SAMPLE_SIZE,
  type ActionsResponse,
  type AnalysisResult,
  type LabelResponse,
  type ReviewLabel,
  type ThemesResponse,
} from "./types.ts";

// Runs a whole analysis: ask for themes once, then label the reviews in small batches.
// Each batch is its own short request, so it works on any host and can show real progress.
// Runs in the browser, and in Node too (the sample analysis script passes a baseUrl).

export type AnalysisProgress = { phase: "themes" | "labelling" | "actions"; done: number; total: number };

export type RunOptions = {
  baseUrl?: string; // "" in the browser
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
  concurrency?: number; // batches in flight at once
};

export type DatasetInfo = { datasetLabel: string; context: string; totalMentions: number };

export class AnalysisRunError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AnalysisRunError";
    this.code = code;
  }
}

const RETRYABLE = new Set(["rate_limit", "timeout", "network", "bad_output", "api"]);
const MAX_ATTEMPTS = 4;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function cancelled(): AnalysisRunError {
  return new AnalysisRunError("cancelled", "cancelled");
}

export async function post<T>(path: string, body: unknown, options: RunOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw cancelled();
    let res: Response | null = null;
    let failure: AnalysisRunError | null = null;
    try {
      res = await fetch(`${options.baseUrl ?? ""}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch {
      if (options.signal?.aborted) throw cancelled();
      failure = new AnalysisRunError("Could not reach the server. Check your connection.", "network");
    }

    if (res) {
      const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (res.ok) return data as T;
      failure = new AnalysisRunError(data?.error ?? "The request failed.", data?.code ?? "api");
    }

    // "api" errors (for example a wrong model name) are unlikely to fix themselves, so retry them once only.
    const limit = failure && failure.code === "api" ? 2 : MAX_ATTEMPTS;
    if (!failure || !RETRYABLE.has(failure.code) || attempt + 1 >= limit) throw failure;
    await sleep(Math.min(15_000, 1500 * 2 ** attempt), options.signal);
  }
}

function byFrequency(rows: FeedbackRow[]): FeedbackRow[] {
  return [...rows].sort((a, b) => b.occurrences - a.occurrences);
}

// Very large datasets are limited to the most frequent unique entries.
export function selectForAnalysis(rows: FeedbackRow[]): { selected: FeedbackRow[]; truncated: boolean } {
  if (rows.length <= MAX_ANALYSED) return { selected: rows, truncated: false };
  return { selected: byFrequency(rows).slice(0, MAX_ANALYSED), truncated: true };
}

// The theme sample mixes the most common reviews with an even spread of the rest.
export function themeSample(rows: FeedbackRow[]): string[] {
  if (rows.length <= THEME_SAMPLE_SIZE) return rows.map((r) => r.review);
  const sorted = byFrequency(rows);
  const top = Math.floor(THEME_SAMPLE_SIZE / 2);
  const picked = sorted.slice(0, top);
  const rest = sorted.slice(top);
  const step = Math.max(1, Math.floor(rest.length / (THEME_SAMPLE_SIZE - top)));
  for (let i = 0; i < rest.length && picked.length < THEME_SAMPLE_SIZE; i += step) picked.push(rest[i]);
  return picked.map((r) => r.review);
}

// Asks the AI for one suggested action per top problem theme. It is shown the numbers, and returns only text.
// Which themes are the top problems is decided by priority.ts, not by the AI.
export async function fetchActions(
  rows: FeedbackRow[],
  result: AnalysisResult,
  options: RunOptions = {},
): Promise<Record<string, string>> {
  const top = rankPriorities(computeMetrics(rows, result)).slice(0, MAX_ACTION_THEMES);
  if (top.length === 0) return {};
  const answer = await post<ActionsResponse>(
    "/api/analysis/recommend",
    {
      context: result.context,
      items: top.map((p) => ({
        theme: p.theme,
        mentions: p.stat.mentions,
        negativeShare: p.negativeShare,
        avgSeverity: p.avgSeverity,
        topIssues: p.stat.topIssues.map((i) => i.issue),
        quotes: p.stat.quotes.map((q) => q.text),
      })),
    },
    options,
  );
  return answer.actions;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}


type LabelOutcome = { model: string | null; lastError: AnalysisRunError | null };

// Labels reviews in small batches and adds the results to `labels`.
// Two passes: the second one retries any review the first pass could not label.
async function labelRows(
  todoAll: FeedbackRow[],
  themes: string[],
  context: string,
  labels: Map<number, ReviewLabel>,
  options: RunOptions,
): Promise<LabelOutcome> {
  const todoIds = new Set(todoAll.map((r) => r.id));
  let model: string | null = null;
  let lastError: AnalysisRunError | null = null;
  let done = 0;

  for (let pass = 0; pass < 2; pass++) {
    const todo = todoAll.filter((r) => !labels.has(r.id));
    if (todo.length === 0) break;
    const batches = chunk(todo, BATCH_SIZE);
    let next = 0;
    const worker = async () => {
      while (next < batches.length) {
        if (options.signal?.aborted) throw cancelled();
        const batch = batches[next++];
        try {
          const answer = await post<LabelResponse>(
            "/api/analysis/label",
            { items: batch.map((r) => ({ id: r.id, text: r.review })), themes, context },
            options,
          );
          model = answer.model;
          for (const label of answer.labels) {
            if (todoIds.has(label.id) && !labels.has(label.id)) done += 1;
            labels.set(label.id, label);
          }
        } catch (e) {
          // Problems that retrying cannot fix stop the whole run. Others only cost this batch.
          const err = e instanceof AnalysisRunError ? e : new AnalysisRunError("Something went wrong.", "api");
          if (err.code === "cancelled" || err.code === "not_configured" || err.code === "auth") throw err;
          lastError = err;
        }
        options.onProgress?.({ phase: "labelling", done: Math.min(todoAll.length, done), total: todoAll.length });
      }
    };
    const count = Math.max(1, Math.min(options.concurrency ?? 2, batches.length));
    await Promise.all(Array.from({ length: count }, worker));
  }
  return { model, lastError };
}

// The suggested actions are a bonus. If this step fails the analysis is still complete and the
// Recommendations page offers to try again.
async function addActions(rows: FeedbackRow[], result: AnalysisResult, options: RunOptions): Promise<void> {
  options.onProgress?.({ phase: "actions", done: 0, total: 1 });
  try {
    const actions = await fetchActions(rows, result, options);
    if (Object.keys(actions).length > 0) result.actions = actions;
  } catch (e) {
    if (e instanceof AnalysisRunError && (e.code === "cancelled" || e.code === "not_configured" || e.code === "auth")) throw e;
  }
}

export async function runAnalysis(
  rows: FeedbackRow[],
  info: DatasetInfo,
  options: RunOptions = {},
): Promise<AnalysisResult> {
  const { selected, truncated } = selectForAnalysis(rows);

  options.onProgress?.({ phase: "themes", done: 0, total: 1 });
  const themed = await post<ThemesResponse>(
    "/api/analysis/themes",
    { texts: themeSample(selected), context: info.context },
    options,
  );
  const themes = themed.themes;

  const labels = new Map<number, ReviewLabel>();
  const { model, lastError } = await labelRows(selected, themes, info.context, labels, options);
  if (labels.size === 0) {
    throw lastError ?? new AnalysisRunError("The AI could not label any reviews.", "bad_output");
  }

  const result: AnalysisResult = {
    source: "gemini",
    model: model ?? themed.model,
    datasetLabel: info.datasetLabel,
    context: info.context,
    totalMentions: info.totalMentions,
    totalUnique: rows.length,
    analysedTexts: selected.length,
    truncated,
    failedTexts: selected.length - labels.size,
    themes,
    labels: [...labels.values()].sort((a, b) => a.id - b.id),
    generatedAt: new Date().toISOString(),
  };
  await addActions(rows, result, options);
  return result;
}

// Adds new feedback to an existing analysis. Only reviews without a label are sent to the AI,
// and the existing themes are reused, so it is quick and cheap. Run the full analysis again
// if the new data is about very different topics (many reviews land in "Other").
export async function runIncrementalAnalysis(
  rows: FeedbackRow[],
  previous: AnalysisResult,
  info: DatasetInfo,
  options: RunOptions = {},
): Promise<AnalysisResult> {
  const labels = new Map<number, ReviewLabel>(previous.labels.map((l) => [l.id, l]));
  const pending = rows.filter((r) => !labels.has(r.id));
  const { selected } = selectForAnalysis(pending);

  let model: string | null = null;
  if (selected.length > 0) {
    const outcome = await labelRows(selected, previous.themes, info.context, labels, options);
    model = outcome.model;
    if (selected.every((r) => !labels.has(r.id))) {
      throw outcome.lastError ?? new AnalysisRunError("The AI could not label the new reviews.", "bad_output");
    }
  }

  const result: AnalysisResult = {
    ...previous,
    source: "gemini",
    model: model ?? previous.model,
    datasetLabel: info.datasetLabel,
    context: info.context,
    totalMentions: info.totalMentions,
    totalUnique: rows.length,
    analysedTexts: labels.size,
    truncated: previous.truncated || selected.length < pending.length,
    failedTexts: rows.filter((r) => !labels.has(r.id)).length,
    labels: [...labels.values()].sort((a, b) => a.id - b.id),
    generatedAt: new Date().toISOString(),
  };
  await addActions(rows, result, options);
  return result;
}