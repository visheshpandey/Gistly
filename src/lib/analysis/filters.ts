import type { FeedbackRow } from "../feedback-types.ts";
import type { AnalysisResult, ReviewLabel, Sentiment } from "./types.ts";

// Dashboard filters. Every chart and card is computed from the rows that pass these, so they all change together.
export type Filters = {
  category: string; // "all" or a category name
  sentiment: Sentiment | "all";
  theme: string; // "all" or a theme name
  from: string; // YYYY-MM-DD or ""
  to: string; // YYYY-MM-DD or ""
};

export const NO_FILTERS: Filters = { category: "all", sentiment: "all", theme: "all", from: "", to: "" };

export function filtersActive(f: Filters): boolean {
  return f.category !== "all" || f.sentiment !== "all" || f.theme !== "all" || f.from !== "" || f.to !== "";
}

// Rows that pass every filter. Rows without an AI label are kept only when no AI filter is set.
export function filterRows(rows: FeedbackRow[], result: AnalysisResult, f: Filters): FeedbackRow[] {
  const labelOf = new Map<number, ReviewLabel>(result.labels.map((l) => [l.id, l]));
  return rows.filter((row) => {
    if (f.category !== "all" && row.category !== f.category) return false;
    if (f.from && (!row.date || row.date < f.from)) return false;
    if (f.to && (!row.date || row.date > f.to)) return false;
    const label = labelOf.get(row.id);
    if (!label) return f.sentiment === "all" && f.theme === "all";
    if (f.sentiment !== "all" && label.sentiment !== f.sentiment) return false;
    if (f.theme !== "all" && label.theme !== f.theme) return false;
    return true;
  });
}

export type TrendPoint = { date: string; mentions: number; negativeShare: number };

// Negative share over time. Needs real dates. Days are grouped into months when there are many of them.
export function trendSeries(rows: FeedbackRow[], result: AnalysisResult): TrendPoint[] {
  const labelOf = new Map<number, ReviewLabel>(result.labels.map((l) => [l.id, l]));
  const days = new Set(rows.filter((r) => r.date).map((r) => r.date as string));
  const byMonth = days.size > 60;
  const buckets = new Map<string, { mentions: number; negative: number }>();
  for (const row of rows) {
    const label = labelOf.get(row.id);
    if (!row.date || !label) continue;
    const key = byMonth ? row.date.slice(0, 7) : row.date;
    const b = buckets.get(key) ?? { mentions: 0, negative: 0 };
    b.mentions += row.occurrences;
    if (label.sentiment === "negative") b.negative += row.occurrences;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => ({ date, mentions: b.mentions, negativeShare: b.mentions > 0 ? b.negative / b.mentions : 0 }));
}
