import type { AnalysisMetrics } from "../analysis/metrics.ts";
import { explainRank, type PriorityItem } from "../analysis/priority.ts";
import type { AnalysisResult } from "../analysis/types.ts";
import type { Issue } from "../issues/types.ts";
import type { ReportData } from "./types.ts";

const MAX_PRIORITIES = 5;
const MAX_STRENGTHS = 3;

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const nf = new Intl.NumberFormat("en-US");

// A short summary written from a template and the real numbers, never by an AI.
function summaryText(m: AnalysisMetrics, top: PriorityItem | undefined): string {
  const total = Math.max(1, m.labelledMentions);
  const parts = [
    `Of ${nf.format(m.labelledMentions)} feedback mentions, ${pct(m.positive / total)} were positive and ${pct(m.negative / total)} were negative (net sentiment ${m.netSentiment > 0 ? "+" : ""}${m.netSentiment.toFixed(1)}).`,
  ];
  if (top) {
    parts.push(
      `The biggest problem is ${top.theme}: ${nf.format(top.stat.mentions)} mentions, ${pct(top.negativeShare)} of them negative, with an average severity of ${top.avgSeverity.toFixed(1)} out of 5.`,
    );
  }
  if (m.critical > 0) {
    parts.push(`${nf.format(m.critical)} negative mentions are rated serious (4 or 5 out of 5).`);
  }
  return parts.join(" ");
}

export function buildReport(input: {
  title: string;
  datasetLabel: string;
  uniqueReviews: number;
  result: AnalysisResult;
  metrics: AnalysisMetrics;
  priorities: PriorityItem[];
  issues: Issue[];
}): ReportData {
  const { metrics: m, priorities, result } = input;
  const total = Math.max(1, m.labelledMentions);
  return {
    version: 1,
    title: input.title,
    generatedAt: new Date().toISOString(),
    datasetLabel: input.datasetLabel,
    model: result.model,
    kpis: {
      totalMentions: m.totalMentions,
      uniqueReviews: input.uniqueReviews,
      positive: m.positive / total,
      neutral: m.neutral / total,
      negative: m.negative / total,
      netSentiment: m.netSentiment,
      critical: m.critical,
    },
    summary: summaryText(m, priorities[0]),
    priorities: priorities.slice(0, MAX_PRIORITIES).map((p) => ({
      rank: p.rank,
      theme: p.theme,
      score: p.score,
      mentions: p.stat.mentions,
      frequency: p.frequency,
      negativeShare: p.negativeShare,
      avgSeverity: p.avgSeverity,
      why: explainRank(p, priorities[0]),
      action: result.actions?.[p.theme] ?? "",
      topIssues: p.stat.topIssues,
      quote: p.stat.quotes[0]?.text ?? "",
    })),
    strengths: [...m.themes]
      .filter((t) => t.positive > 0)
      .sort((a, b) => b.positive - a.positive)
      .slice(0, MAX_STRENGTHS)
      .map((t) => ({ theme: t.theme, positiveShare: t.positiveShare, mentions: t.mentions, topPoint: t.topStrengths[0]?.issue ?? "" })),
    themes: m.themes.map((t) => ({ theme: t.theme, mentions: t.mentions, share: t.share, negativeShare: t.negativeShare })),
    issues: input.issues.map((i) => ({ title: i.title, theme: i.theme, status: i.status, note: i.note })),
  };
}
