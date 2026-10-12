import type { AnalysisMetrics, ThemeStat } from "./metrics.ts";

// Ranks problem themes by how much they hurt. Pure math on the AI's labels. No AI involved.
//
//   frequency      = theme mentions / all labelled mentions          (how much of the feedback is about it)
//   negative share = negative mentions / theme mentions              (how much of that is a complaint)
//   severity       = average severity of its negative mentions / 5   (how serious the complaints are, 0 to 1)
//
//   raw score      = frequency x negative share x severity
//   priority score = raw score / the top theme's raw score x 100     (the top theme is always 100)
//
// All counts are weighted by how often each review was received. Themes with no negative feedback are not ranked.
// Not included yet: recent growth. It needs real dates, and the sample data has none.
export type PriorityItem = {
  rank: number;
  theme: string;
  score: number; // 0 to 100, relative to the top theme
  raw: number;
  frequency: number; // 0 to 1
  negativeShare: number; // 0 to 1
  severity: number; // 0 to 1 (average severity / 5)
  avgSeverity: number; // 1 to 5
  stat: ThemeStat;
};

export function rankPriorities(metrics: AnalysisMetrics): PriorityItem[] {
  const items = metrics.themes
    .filter((t) => t.negative > 0 && metrics.labelledMentions > 0)
    .map((t) => {
      const frequency = t.mentions / metrics.labelledMentions;
      const severity = t.avgSeverity / 5;
      return { theme: t.theme, frequency, negativeShare: t.negativeShare, severity, avgSeverity: t.avgSeverity, raw: frequency * t.negativeShare * severity, stat: t };
    })
    .sort((a, b) => b.raw - a.raw);
  const top = items[0]?.raw ?? 0;
  return items.map((it, i) => ({ ...it, rank: i + 1, score: top > 0 ? (it.raw / top) * 100 : 0 }));
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const nf = new Intl.NumberFormat("en-US");

const PARTS: { key: "frequency" | "negativeShare" | "severity"; label: string }[] = [
  { key: "frequency", label: "how much of the feedback is about it" },
  { key: "negativeShare", label: "how much of that is negative" },
  { key: "severity", label: "how serious the complaints are" },
];

// A plain-language explanation that shows the numbers. Built from a template, never written by the AI.
export function explainRank(item: PriorityItem, top: PriorityItem | undefined): string {
  const numbers =
    `${nf.format(item.stat.mentions)} mentions (${pct(item.frequency)} of all feedback), ${pct(item.negativeShare)} of them negative, ` +
    `average severity ${item.avgSeverity.toFixed(1)} of 5. ` +
    `${pct(item.frequency)} × ${pct(item.negativeShare)} × ${item.severity.toFixed(2)} = ${item.raw.toFixed(3)}.`;

  if (!top || item.rank === 1) {
    return `Ranks first: ${numbers} Nothing else combines this much volume, negativity and severity.`;
  }
  // Find the part where this theme falls furthest behind the top one.
  let weakest = PARTS[0];
  let worstRatio = Infinity;
  for (const part of PARTS) {
    const ratio = top[part.key] > 0 ? item[part.key] / top[part.key] : 1;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      weakest = part;
    }
  }
  const topValue = weakest.key === "severity" ? `${top.avgSeverity.toFixed(1)} of 5` : pct(top[weakest.key]);
  const ownValue = weakest.key === "severity" ? `${item.avgSeverity.toFixed(1)} of 5` : pct(item[weakest.key]);
  return (
    `Ranks #${item.rank} with ${item.score.toFixed(0)}% of the top problem's impact: ${numbers} ` +
    `It falls furthest behind #1 on ${weakest.label} (${ownValue} against ${topValue}).`
  );
}
