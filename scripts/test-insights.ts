// Checks for the dashboard's takeaways and theme × category grid (src/lib/analysis/insights.ts).
// Plain Node, no test library.  Usage:  node scripts/test-insights.ts
import assert from "node:assert/strict";
import { buildHeatGrid, buildInsights, heatKey, trendInsight } from "../src/lib/analysis/insights.ts";
import { computeMetrics } from "../src/lib/analysis/metrics.ts";
import { rankPriorities } from "../src/lib/analysis/priority.ts";
import type { AnalysisResult, ReviewLabel } from "../src/lib/analysis/types.ts";
import type { FeedbackRow } from "../src/lib/feedback-types.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}\n      ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

// Fixture, 100 mentions:
//   Delivery: 40 mentions in "Ops", 30 negative (severity 3), 10 positive
//   Fraud:    20 mentions in "Fraud", all negative (severity 5)
//   Design:   40 mentions in "Product", all positive
const rows: FeedbackRow[] = [
  { id: 1, review: "Delivery was late again", category: "Ops", date: null, occurrences: 30 },
  { id: 2, review: "Delivery was quick", category: "Ops", date: null, occurrences: 10 },
  { id: 3, review: "I was scammed", category: "Fraud", date: null, occurrences: 20 },
  { id: 4, review: "Lovely design", category: "Product", date: null, occurrences: 40 },
];
const label = (id: number, sentiment: ReviewLabel["sentiment"], theme: string, severity: number): ReviewLabel => ({
  id,
  sentiment,
  theme,
  severity,
  keyIssue: theme.toLowerCase(),
  kind: sentiment === "positive" ? "praise" : "complaint",
});
const result: AnalysisResult = {
  source: "gemini",
  model: "test",
  datasetLabel: "Test",
  context: "",
  totalMentions: 100,
  totalUnique: 4,
  analysedTexts: 4,
  truncated: false,
  failedTexts: 0,
  generatedAt: "2026-01-01T00:00:00.000Z",
  themes: ["Delivery", "Fraud", "Design"],
  labels: [label(1, "negative", "Delivery", 3), label(2, "positive", "Delivery", 1), label(3, "negative", "Fraud", 5), label(4, "positive", "Design", 1)],
};
const metrics = computeMetrics(rows, result);
const priorities = rankPriorities(metrics);
const insights = buildInsights(metrics, priorities, []);
const byKind = (k: string) => insights.find((i) => i.kind === k);

check("overall: 50 positive and 50 negative of 100 mentions", () => {
  const o = byKind("overall");
  assert.ok(o && o.kind === "overall");
  assert.equal(o.positive, 50);
  assert.equal(o.negative, 50);
  assert.equal(o.labelled, 100);
});

check("fix first: Fraud (20% × 100% negative × 5/5 = 0.20 beats Delivery 40% × 75% × 3/5 = 0.18)", () => {
  const f = byKind("fix-first");
  assert.ok(f && f.kind === "fix-first");
  assert.equal(f.theme, priorities[0].theme);
  assert.equal(f.theme, "Fraud");
  assert.equal(f.complaints, 20);
});

check("highest risk is only shown when it differs from the top problem", () => {
  // The most severe theme is Fraud, which is already "fix first", so no separate risk line.
  assert.equal(byKind("highest-risk"), undefined);
});

check("hot spot: Fraud is the most negative category (100%)", () => {
  const h = byKind("hot-spot");
  assert.ok(h && h.kind === "hot-spot");
  assert.equal(h.category, "Fraud");
  assert.equal(h.negativeShare, 1);
});

check("strength: Design gets the most praise (40 positive mentions)", () => {
  const s = byKind("strength");
  assert.ok(s && s.kind === "strength");
  assert.equal(s.theme, "Design");
  assert.equal(s.positive, 40);
});

check("no trend without dates; rising and steady are told apart", () => {
  assert.equal(byKind("trend"), undefined);
  const pts = (shares: number[]) => shares.map((s, i) => ({ date: `2026-01-0${i + 1}`, negativeShare: s, mentions: 10 }));
  const rising = trendInsight(pts([0.1, 0.1, 0.2, 0.3, 0.5, 0.5]));
  assert.ok(rising && rising.kind === "trend" && rising.direction === "rising");
  const steady = trendInsight(pts([0.3, 0.3, 0.31, 0.3, 0.3, 0.31]));
  assert.ok(steady && steady.kind === "trend" && steady.direction === "steady");
  assert.equal(trendInsight(pts([0.1, 0.2])), null);
});

check("heat grid: Delivery inside Ops is 75% negative of 40 mentions", () => {
  const grid = buildHeatGrid(rows, result, metrics, ["Fraud", "Ops", "Product"]);
  assert.ok(grid);
  assert.deepEqual(grid.cells[heatKey("Delivery", "Ops")], { mentions: 40, negativeShare: 0.75 });
  assert.deepEqual(grid.cells[heatKey("Fraud", "Fraud")], { mentions: 20, negativeShare: 1 });
  assert.equal(grid.cells[heatKey("Design", "Ops")], undefined);
});

check("heat grid needs at least two categories", () => {
  assert.equal(buildHeatGrid(rows, result, metrics, ["Ops"]), null);
});

console.log(`\n${passed} checks passed.`);
