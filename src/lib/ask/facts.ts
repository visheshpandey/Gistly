import type { FeedbackRow } from "../feedback-types.ts";
import { trendSeries } from "../analysis/filters.ts";
import { groupIssues } from "../analysis/issues.ts";
import { computeMetrics } from "../analysis/metrics.ts";
import type { AnalysisResult, ReviewLabel } from "../analysis/types.ts";
import type { AskFacts, AskPlan } from "./types.ts";

// Works out the real numbers behind a question. Everything here is plain code on the AI's labels.

const pct = (part: number, whole: number) => `${whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0"}%`;
const MAX_QUOTES = 5;
const MAX_ISSUES = 5;
const MAX_GROUPS = 8;
const MAX_TREND_POINTS = 24;

function labelMap(result: AnalysisResult): Map<number, ReviewLabel> {
  return new Map(result.labels.map((l) => [l.id, l]));
}

// Rows that fit the plan. Only reviews the AI has labelled can be selected.
export function selectRows(rows: FeedbackRow[], result: AnalysisResult, plan: AskPlan): FeedbackRow[] {
  const labelOf = labelMap(result);
  const keywords = plan.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  const category = plan.category.toLowerCase();
  return rows.filter((row) => {
    const label = labelOf.get(row.id);
    if (!label) return false;
    if (plan.sentiment !== "any" && label.sentiment !== plan.sentiment) return false;
    if (plan.theme && label.theme !== plan.theme) return false;
    if (category && (row.category ?? "").toLowerCase() !== category) return false;
    if (plan.from && (!row.date || row.date < plan.from)) return false;
    if (plan.to && (!row.date || row.date > plan.to)) return false;
    if (keywords.length > 0) {
      const text = row.review.toLowerCase();
      const issue = label.keyIssue.toLowerCase();
      if (!keywords.some((k) => text.includes(k) || issue.includes(k))) return false;
    }
    return true;
  });
}

export function describeScope(plan: AskPlan): string {
  const parts: string[] = [];
  parts.push(plan.sentiment === "any" ? "all feedback" : `${plan.sentiment} feedback`);
  if (plan.theme) parts.push(`about "${plan.theme}"`);
  if (plan.category) parts.push(`in the category "${plan.category}"`);
  if (plan.keywords.length > 0) parts.push(`mentioning ${plan.keywords.map((k) => `"${k}"`).join(" or ")}`);
  if (plan.from || plan.to) parts.push(`from ${plan.from || "the start"} to ${plan.to || "now"}`);
  return parts.join(" ");
}

export function buildFacts(rows: FeedbackRow[], result: AnalysisResult, plan: AskPlan): AskFacts {
  const labelOf = labelMap(result);
  const all = computeMetrics(rows, result);
  const matched = selectRows(rows, result, plan);
  const m = computeMetrics(matched, result);

  // Which issues to list depends on the question: complaints, praise, or everything.
  const issueCounts = new Map<string, number>();
  for (const row of matched) {
    const label = labelOf.get(row.id);
    if (!label || !label.keyIssue) continue;
    const wanted =
      plan.sentiment !== "any"
        ? true
        : plan.focus === "strengths"
          ? label.sentiment === "positive"
          : plan.focus === "problems"
            ? label.sentiment === "negative"
            : true;
    if (wanted) issueCounts.set(label.keyIssue, (issueCounts.get(label.keyIssue) ?? 0) + row.occurrences);
  }

  // Group comparison. The leaders are found here in code, because an AI is not reliable at picking a maximum.
  let comparison: AskFacts["comparison"] = null;
  const groups =
    plan.compareBy === "category" && m.byCategory
      ? { by: "category", items: m.byCategory.map((c) => ({ name: c.category, mentions: c.mentions, negative: c.negative, positive: c.positive })) }
      : plan.compareBy === "theme"
        ? { by: "theme", items: m.themes.map((t) => ({ name: t.theme, mentions: t.mentions, negative: t.negative, positive: t.positive })) }
        : null;
  if (groups && groups.items.length > 0) {
    const items = groups.items;
    const top = (score: (g: (typeof items)[number]) => number) => [...items].sort((a, b) => score(b) - score(a))[0].name;
    comparison = {
      by: groups.by,
      leaders: {
        mostNegativeMentions: top((g) => g.negative),
        highestNegativeShare: top((g) => (g.mentions > 0 ? g.negative / g.mentions : 0)),
        highestPositiveShare: top((g) => (g.mentions > 0 ? g.positive / g.mentions : 0)),
      },
      rows: [...items]
        .sort((a, b) => b.negative - a.negative)
        .slice(0, MAX_GROUPS)
        .map((g) => ({
          name: g.name,
          mentions: g.mentions,
          negativeMentions: g.negative,
          negativeShare: pct(g.negative, g.mentions),
          positiveShare: pct(g.positive, g.mentions),
        })),
    };
  }
  let trend: AskFacts["trend"] = null;
  if (plan.focus === "trend") {
    const points = trendSeries(matched, result);
    if (points.length > 1) {
      trend = points.slice(-MAX_TREND_POINTS).map((p) => ({
        period: p.date,
        mentions: p.mentions,
        negativeShare: `${(p.negativeShare * 100).toFixed(1)}%`,
      }));
    }
  }

  const labelledUnique = rows.filter((r) => labelOf.has(r.id)).length;
  const notAnalysed = rows.length - labelledUnique;

  return {
    scope: describeScope(plan),
    relaxedNote: "",
    allMentions: all.labelledMentions,
    matchedMentions: m.labelledMentions,
    matchedUniqueReviews: matched.length,
    matchedShareOfAll: pct(m.labelledMentions, all.labelledMentions),
    sentiment: {
      positive: pct(m.positive, m.labelledMentions),
      neutral: pct(m.neutral, m.labelledMentions),
      negative: pct(m.negative, m.labelledMentions),
      positiveMentions: m.positive,
      neutralMentions: m.neutral,
      negativeMentions: m.negative,
    },
    criticalMentions: m.critical,
    topThemes: m.themes.slice(0, 5).map((t) => ({
      theme: t.theme,
      mentions: t.mentions,
      shareOfSelection: pct(t.mentions, m.labelledMentions),
      negativeShare: pct(t.negative, t.mentions),
    })),
    topIssues: groupIssues(issueCounts, MAX_ISSUES),
    comparison,
    trend,
    quotes: [...matched]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, MAX_QUOTES)
      .map((r) => ({ text: r.review, receivedTimes: r.occurrences, sentiment: labelOf.get(r.id)?.sentiment ?? "unknown" })),
    coverageNote:
      notAnalysed > 0
        ? `${labelledUnique} of ${rows.length} unique reviews have AI labels. ${notAnalysed} newer reviews are not included.`
        : `All ${rows.length} unique reviews have AI labels.`,
  };
}

// Finds figures in the AI's answer that are not in the facts it was given.
// Small numbers (10 and under) and years are ignored, because they are usually counts of things, not statistics.
export function findUnverifiedNumbers(answer: string, facts: AskFacts): string[] {
  const allowed = new Set<number>();
  for (const token of JSON.stringify(facts).match(/\d+(?:\.\d+)?/g) ?? []) {
    const v = parseFloat(token);
    // An answer may round a figure either way (95.5% as 95% or 96%).
    allowed.add(v);
    allowed.add(Math.round(v));
    allowed.add(Math.floor(v));
    allowed.add(Math.ceil(v));
    allowed.add(Math.round(v * 10) / 10);
  }
  const unverified: string[] = [];
  for (const token of answer.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const v = parseFloat(token.replace(/,/g, ""));
    if (!Number.isFinite(v) || v <= 10 || (v >= 1900 && v <= 2100)) continue;
    if (!allowed.has(v) && !unverified.includes(token)) unverified.push(token);
  }
  return unverified;
}
