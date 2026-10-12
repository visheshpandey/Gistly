import type { FeedbackRow } from "../feedback-types.ts";
import { groupIssues } from "./issues.ts";
import { KINDS, type AnalysisResult, type Kind, type ReviewLabel } from "./types.ts";

// All the numbers shown for an analysis are worked out here from the AI's labels.
// Every count is weighted by occurrences (how many times the feedback was received), so volume stays accurate.
// The AI never writes a number, and the category is never used as sentiment.

export type ThemeStat = {
  theme: string;
  mentions: number;
  share: number; // share of all labelled mentions, 0 to 1
  positive: number;
  positiveShare: number; // positive mentions / theme mentions, 0 to 1
  topStrengths: { issue: string; mentions: number }[]; // most common points in the positive feedback
  negative: number;
  negativeShare: number; // negative mentions / theme mentions, 0 to 1
  avgSeverity: number; // average over negative mentions (0 if there are none)
  topIssues: { issue: string; mentions: number }[];
  // Negative share in the later half of the dates compared with the earlier half. null when there are no real dates
  // or too little feedback in a half to tell. Never guessed, and not part of the priority score.
  trend: "worse" | "better" | "steady" | null;
  quotes: { text: string; mentions: number }[];
};

export type CategoryStat = { category: string; mentions: number; positive: number; neutral: number; negative: number };

export type AnalysisMetrics = {
  labelledMentions: number; // mentions covered by a label
  totalMentions: number; // all mentions in the dataset
  positive: number;
  neutral: number;
  negative: number;
  netSentiment: number; // positive share minus negative share, in points (-100 to 100)
  critical: number; // negative mentions with severity 4 or 5
  kinds: Record<Kind, number>;
  severity: number[]; // negative mentions at severity 1 to 5 (index 0 = severity 1)
  themes: ThemeStat[]; // most mentioned first
  byCategory: CategoryStat[] | null; // null when the data has no category
};

const TOP_ISSUES = 3;
const MIN_HALF_MENTIONS = 5; // each half needs at least this many mentions before we call a direction
const TREND_POINTS = 0.05; // a change of more than 5 percentage points counts as better or worse

function trendOf(early: { total: number; neg: number }, late: { total: number; neg: number }): ThemeStat["trend"] {
  if (early.total < MIN_HALF_MENTIONS || late.total < MIN_HALF_MENTIONS) return null;
  const change = late.neg / late.total - early.neg / early.total;
  return change > TREND_POINTS ? "worse" : change < -TREND_POINTS ? "better" : "steady";
}
const QUOTES = 2;

export function computeMetrics(rows: FeedbackRow[], result: AnalysisResult): AnalysisMetrics {
  const labelOf = new Map<number, ReviewLabel>(result.labels.map((l) => [l.id, l]));
  const kinds = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
  const severity = [0, 0, 0, 0, 0];
  const themes = new Map<
    string,
    {
      mentions: number;
      positive: number;
      negative: number;
      severitySum: number;
      issues: Map<string, number>;
      negativeIssues: Map<string, number>;
      positiveIssues: Map<string, number>;
      entries: { text: string; mentions: number; negative: boolean }[];
      early: { total: number; neg: number };
      late: { total: number; neg: number };
    }
  >();
  const categories = new Map<string, CategoryStat>();
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let critical = 0;
  let labelled = 0;

  // The middle of the date range splits the feedback into an earlier and a later half.
  const times = rows.map((r) => (r.date ? Date.parse(r.date) : NaN)).filter((n) => Number.isFinite(n));
  const midTime = times.length > 1 && Math.max(...times) > Math.min(...times) ? (Math.min(...times) + Math.max(...times)) / 2 : null;

  for (const row of rows) {
    const label = labelOf.get(row.id);
    if (!label) continue;
    const w = row.occurrences;
    const isNegative = label.sentiment === "negative";
    labelled += w;
    kinds[label.kind] += w;
    if (label.sentiment === "positive") positive += w;
    else if (label.sentiment === "neutral") neutral += w;
    else negative += w;
    if (isNegative) {
      severity[Math.min(4, Math.max(0, label.severity - 1))] += w;
      if (label.severity >= 4) critical += w;
    }

    let t = themes.get(label.theme);
    if (!t) {
      t = {
        mentions: 0,
        positive: 0,
        negative: 0,
        severitySum: 0,
        issues: new Map(),
        negativeIssues: new Map(),
        positiveIssues: new Map(),
        entries: [],
        early: { total: 0, neg: 0 },
        late: { total: 0, neg: 0 },
      };
      themes.set(label.theme, t);
    }
    t.mentions += w;
    if (label.sentiment === "positive") t.positive += w;
    if (isNegative) {
      t.negative += w;
      t.severitySum += label.severity * w;
    }
    if (label.keyIssue) {
      t.issues.set(label.keyIssue, (t.issues.get(label.keyIssue) ?? 0) + w);
      if (isNegative) t.negativeIssues.set(label.keyIssue, (t.negativeIssues.get(label.keyIssue) ?? 0) + w);
      if (label.sentiment === "positive") t.positiveIssues.set(label.keyIssue, (t.positiveIssues.get(label.keyIssue) ?? 0) + w);
    }
    t.entries.push({ text: row.review, mentions: w, negative: isNegative });
    if (row.date && midTime !== null) {
      const half = Date.parse(row.date) < midTime ? t.early : t.late;
      half.total += w;
      if (isNegative) half.neg += w;
    }

    if (row.category) {
      let c = categories.get(row.category);
      if (!c) {
        c = { category: row.category, mentions: 0, positive: 0, neutral: 0, negative: 0 };
        categories.set(row.category, c);
      }
      c.mentions += w;
      c[label.sentiment] += w;
    }
  }

  const top = (map: Map<string, number>) => groupIssues(map, TOP_ISSUES);

  const themeStats: ThemeStat[] = [...themes.entries()]
    .map(([theme, t]) => {
      // Quotes and issues come from the negative feedback when there is any, because that is what needs action.
      const pool = t.negative > 0 ? t.entries.filter((e) => e.negative) : t.entries;
      return {
        theme,
        mentions: t.mentions,
        share: labelled > 0 ? t.mentions / labelled : 0,
        positive: t.positive,
        positiveShare: t.mentions > 0 ? t.positive / t.mentions : 0,
        topStrengths: top(t.positiveIssues),
        negative: t.negative,
        negativeShare: t.mentions > 0 ? t.negative / t.mentions : 0,
        avgSeverity: t.negative > 0 ? t.severitySum / t.negative : 0,
        topIssues: top(t.negative > 0 ? t.negativeIssues : t.issues),
        trend: trendOf(t.early, t.late),
        quotes: [...pool].sort((a, b) => b.mentions - a.mentions).slice(0, QUOTES).map((e) => ({ text: e.text, mentions: e.mentions })),
      };
    })
    .sort((a, b) => b.mentions - a.mentions);

  return {
    labelledMentions: labelled,
    totalMentions: result.totalMentions,
    positive,
    neutral,
    negative,
    netSentiment: labelled > 0 ? ((positive - negative) / labelled) * 100 : 0,
    critical,
    kinds,
    severity,
    themes: themeStats,
    byCategory: categories.size > 0 ? [...categories.values()].sort((a, b) => b.mentions - a.mentions) : null,
  };
}
