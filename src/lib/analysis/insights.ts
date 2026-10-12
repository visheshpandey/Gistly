import type { FeedbackRow } from "../feedback-types.ts";
import type { TrendPoint } from "./filters.ts";
import type { AnalysisMetrics } from "./metrics.ts";
import type { PriorityItem } from "./priority.ts";
import type { AnalysisResult } from "./types.ts";

// The dashboard's "key takeaways" and its theme × category grid, worked out from the numbers.
// Pure functions that return plain data: the UI decides how to show them. No AI is involved.

export type Insight =
  | { kind: "overall"; positive: number; neutral: number; negative: number; labelled: number; net: number }
  | { kind: "fix-first"; theme: string; negativeShare: number; complaints: number }
  | { kind: "highest-risk"; theme: string; avgSeverity: number }
  | { kind: "hot-spot"; category: string; negativeShare: number; positive: number; neutral: number; negative: number }
  | { kind: "strength"; theme: string; positive: number; positiveShare: number }
  | { kind: "trend"; direction: "rising" | "falling" | "steady"; early: number; late: number; series: number[] };

const RISK_MIN_SHARE_OF_COMPLAINTS = 0.02; // a "highest risk" theme needs at least 2% of all complaints
const RISK_MIN_SEVERITY = 3.5;
const HOT_SPOT_MIN_SHARE = 0.05; // a category needs at least 5% of the feedback to be called a hot spot
const TREND_MIN_POINTS = 6;
const TREND_STEADY_POINTS = 3; // a change under 3 percentage points counts as steady

// Compares the first and last third of the dated feedback. Only meaningful when the data has real dates.
export function trendInsight(points: TrendPoint[]): Insight | null {
  if (points.length < TREND_MIN_POINTS) return null;
  const third = Math.floor(points.length / 3);
  const avg = (p: TrendPoint[]) => (p.reduce((s, x) => s + x.negativeShare, 0) / p.length) * 100;
  const early = avg(points.slice(0, third));
  const late = avg(points.slice(-third));
  const change = late - early;
  const direction = Math.abs(change) < TREND_STEADY_POINTS ? "steady" : change > 0 ? "rising" : "falling";
  return { kind: "trend", direction, early, late, series: points.map((p) => p.negativeShare) };
}

export function buildInsights(m: AnalysisMetrics, priorities: PriorityItem[], trend: TrendPoint[]): Insight[] {
  const out: Insight[] = [
    { kind: "overall", positive: m.positive, neutral: m.neutral, negative: m.negative, labelled: m.labelledMentions, net: m.netSentiment },
  ];

  const top = priorities[0];
  if (top) out.push({ kind: "fix-first", theme: top.theme, negativeShare: top.negativeShare, complaints: top.stat.negative });

  // The most serious problem with real volume, if it is not already the top one.
  const risk = priorities
    .filter((p) => p.stat.negative >= m.negative * RISK_MIN_SHARE_OF_COMPLAINTS)
    .sort((a, b) => b.avgSeverity - a.avgSeverity)[0];
  if (risk && top && risk.theme !== top.theme && risk.avgSeverity >= RISK_MIN_SEVERITY) {
    out.push({ kind: "highest-risk", theme: risk.theme, avgSeverity: risk.avgSeverity });
  }

  const categories = m.byCategory ?? [];
  const area = categories
    .filter((c) => c.mentions >= m.labelledMentions * HOT_SPOT_MIN_SHARE)
    .map((c) => ({ ...c, share: c.mentions > 0 ? c.negative / c.mentions : 0 }))
    .sort((a, b) => b.share - a.share)[0];
  if (area && categories.length > 1) {
    out.push({
      kind: "hot-spot",
      category: area.category,
      negativeShare: area.share,
      positive: area.positive,
      neutral: area.neutral,
      negative: area.negative,
    });
  }

  const strength = [...m.themes].filter((t) => t.positive > 0).sort((a, b) => b.positive - a.positive)[0];
  if (strength) out.push({ kind: "strength", theme: strength.theme, positive: strength.positive, positiveShare: strength.positiveShare });

  const t = trendInsight(trend);
  if (t) out.push(t);
  return out;
}

export type HeatCell = { mentions: number; negativeShare: number };
export type HeatGrid = { rows: string[]; cols: string[]; cells: Record<string, HeatCell> };

const MAX_HEAT_ROWS = 8;
const MAX_HEAT_COLS = 10;
export const heatKey = (theme: string, category: string) => `${theme}\u0000${category}`;

// Negative share for every theme inside every category. Null when there is nothing to compare.
export function buildHeatGrid(
  rows: FeedbackRow[],
  result: AnalysisResult,
  metrics: AnalysisMetrics,
  categories: string[],
): HeatGrid | null {
  if (categories.length < 2) return null;
  const labelOf = new Map(result.labels.map((l) => [l.id, l]));
  const tally = new Map<string, { mentions: number; negative: number }>();
  for (const r of rows) {
    const l = labelOf.get(r.id);
    if (!l || !r.category) continue;
    const key = heatKey(l.theme, r.category);
    const t = tally.get(key) ?? { mentions: 0, negative: 0 };
    t.mentions += r.occurrences;
    if (l.sentiment === "negative") t.negative += r.occurrences;
    tally.set(key, t);
  }
  const cells: Record<string, HeatCell> = {};
  for (const [key, t] of tally) cells[key] = { mentions: t.mentions, negativeShare: t.mentions > 0 ? t.negative / t.mentions : 0 };
  return {
    rows: metrics.themes.slice(0, MAX_HEAT_ROWS).map((t) => t.theme),
    cols: categories.slice(0, MAX_HEAT_COLS),
    cells,
  };
}
