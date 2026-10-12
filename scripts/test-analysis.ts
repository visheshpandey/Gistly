// Automated checks for the calculation code. Plain Node, no test library.
//
// Usage (PowerShell, from the insightflow folder):
//   node scripts/test-analysis.ts
//
// The fixture is tiny so every expected number can be checked by hand. See the comments next to each check.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mergeRows } from "../src/lib/dedupe.ts";
import { groupIssues } from "../src/lib/analysis/issues.ts";
import { computeMetrics } from "../src/lib/analysis/metrics.ts";
import { explainRank, rankPriorities } from "../src/lib/analysis/priority.ts";
import { tidyThemeName } from "../src/lib/analysis/themes.ts";
import type { AnalysisResult, ReviewLabel } from "../src/lib/analysis/types.ts";
import { buildFacts, findUnverifiedNumbers, selectRows } from "../src/lib/ask/facts.ts";
import type { AskPlan } from "../src/lib/ask/types.ts";
import type { FeedbackRow } from "../src/lib/feedback-types.ts";
import { normalizeText } from "../src/lib/local/normalize.ts";
import { scoreQuality } from "../src/lib/local/quality.ts";
import { decodeReport, encodeReport } from "../src/lib/report/encode.ts";
import type { ReportData } from "../src/lib/report/types.ts";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => {
      passed += 1;
      console.log(`PASS  ${name}`);
    },
    (e: unknown) => {
      console.log(`FAIL  ${name}\n      ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    },
  );
}

// Fixture. 100 mentions in total:
//   Delivery:  40 mentions, 30 negative (severity 4)  -> 10 positive
//   Fraud:     20 mentions, 20 negative (severity 5)
//   Design:    40 mentions, 0 negative, 40 positive
const rows: FeedbackRow[] = [
  { id: 1, review: "Delivery was late again", category: "Ops", date: null, occurrences: 30 },
  { id: 2, review: "Delivery was quick and neat", category: "Ops", date: null, occurrences: 10 },
  { id: 3, review: "I was scammed by a seller", category: "Fraud", date: null, occurrences: 20 },
  { id: 4, review: "Lovely modern design", category: "Product", date: null, occurrences: 40 },
];
const label = (id: number, sentiment: ReviewLabel["sentiment"], theme: string, severity: number, keyIssue: string): ReviewLabel => ({
  id,
  sentiment,
  theme,
  severity,
  keyIssue,
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
  themes: ["Delivery", "Fraud", "Design"],
  labels: [
    label(1, "negative", "Delivery", 4, "late delivery"),
    label(2, "positive", "Delivery", 1, "fast delivery"),
    label(3, "negative", "Fraud", 5, "seller scam"),
    label(4, "positive", "Design", 1, "modern design"),
  ],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

await check("metrics: counts are weighted by how often each review was received", () => {
  const m = computeMetrics(rows, result);
  assert.equal(m.labelledMentions, 100);
  assert.equal(m.positive, 50); // 10 + 40
  assert.equal(m.negative, 50); // 30 + 20
  assert.equal(m.neutral, 0);
  assert.equal(m.netSentiment, 0);
  assert.equal(m.critical, 50); // severity 4 and 5 negatives: 30 + 20
  assert.deepEqual(m.severity, [0, 0, 0, 30, 20]);
});

await check("metrics: theme numbers are right", () => {
  const delivery = computeMetrics(rows, result).themes.find((t) => t.theme === "Delivery");
  assert.ok(delivery);
  assert.equal(delivery.mentions, 40);
  assert.equal(delivery.negative, 30);
  assert.equal(delivery.negativeShare, 0.75);
  assert.equal(delivery.avgSeverity, 4);
});

await check("metrics: reviews without a label are left out, not guessed", () => {
  const extra = [...rows, { id: 5, review: "New and unanalysed", category: null, date: null, occurrences: 7 }];
  assert.equal(computeMetrics(extra, result).labelledMentions, 100);
});

await check("priority: score = frequency x negative share x severity, top theme is 100", () => {
  const p = rankPriorities(computeMetrics(rows, result));
  // Fraud:    0.20 * 1.00 * (5/5) = 0.2
  // Delivery: 0.40 * 0.75 * (4/5) = 0.24
  assert.deepEqual(p.map((x) => x.theme), ["Delivery", "Fraud"]); // Design has no negatives, so it is not ranked
  assert.ok(Math.abs(p[0].raw - 0.24) < 1e-9);
  assert.ok(Math.abs(p[1].raw - 0.2) < 1e-9);
  assert.equal(p[0].score, 100);
  assert.ok(Math.abs(p[1].score - (0.2 / 0.24) * 100) < 1e-9);
});

await check("priority: the explanation shows the real numbers and where it falls behind", () => {
  const p = rankPriorities(computeMetrics(rows, result));
  const text = explainRank(p[1], p[0]);
  assert.match(text, /Ranks #2/);
  assert.match(text, /20 mentions/);
  assert.match(text, /falls furthest behind #1 on how much of the feedback is about it/); // 20% against 40%
});

await check("issues: near-identical phrases are merged, different problems stay apart", () => {
  const grouped = groupIssues(
    new Map([
      ["unhelpful customer service unresolved issue", 252],
      ["unhelpful service issue remains unresolved", 53],
      ["long wait for service response", 228],
    ]),
    5,
  );
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0], { issue: "unhelpful customer service unresolved issue", mentions: 305 });
  assert.equal(grouped[1].mentions, 228);
});

await check("themes: small words are lowercase inside a name", () => {
  assert.equal(tidyThemeName("Fraud And Security"), "Fraud and Security");
  assert.equal(tidyThemeName("The Product Of Quality"), "The Product of Quality");
});

await check("normalize: variants of the same feedback match, different feedback does not", () => {
  assert.equal(normalizeText("Great app!!!"), normalizeText("great app"));
  assert.equal(normalizeText("Don't like it"), normalizeText("dont like it"));
  assert.equal(normalizeText("sooooo good"), normalizeText("soo good"));
  assert.notEqual(normalizeText("price 1000"), normalizeText("price 100"));
  assert.equal(normalizeText("😀 !!! https://x.co/a"), "");
});

await check("quality: a clean file scores high, a messy one scores low, scores stay between 0 and 10", () => {
  const clean = scoreQuality({ rows: 100, duplicates: 0, emptyOrJunk: 0, short: 0, garbage: 0, long: 0 });
  const messy = scoreQuality({ rows: 100, duplicates: 95, emptyOrJunk: 40, short: 60, garbage: 40, long: 30 });
  assert.equal(clean.score, 10);
  assert.equal(clean.grade, "A");
  assert.equal(messy.score, 0);
  assert.equal(messy.grade, "F");
  assert.equal(scoreQuality({ rows: 0, duplicates: 0, emptyOrJunk: 0, short: 0, garbage: 0, long: 0 }).grade, "F");
});

await check("merge: existing ids are kept, repeats add up, new feedback gets new ids", () => {
  const merged = mergeRows(rows, [
    { id: 1, review: "DELIVERY was late again!!!", category: "Ops", date: null, occurrences: 5 }, // same feedback, different punctuation
    { id: 2, review: "Brand new feedback", category: "Ops", date: null, occurrences: 2 },
  ]);
  assert.equal(merged.length, 5);
  assert.equal(merged[0].occurrences, 35);
  assert.equal(merged[0].id, 1);
  assert.equal(merged[4].id, 5); // next free id, not the incoming id 2
  assert.equal(rows[0].occurrences, 30); // the original list is untouched
});

const plan = (p: Partial<AskPlan>): AskPlan => ({
  inScope: true,
  focus: "overview",
  sentiment: "any",
  theme: "",
  category: "",
  keywords: [],
  compareBy: "none",
  from: "",
  to: "",
  ...p,
});

await check("ask: selection filters by sentiment, theme, category and keyword", () => {
  assert.equal(selectRows(rows, result, plan({ sentiment: "negative" })).length, 2);
  assert.equal(selectRows(rows, result, plan({ theme: "Delivery" })).length, 2);
  assert.equal(selectRows(rows, result, plan({ category: "fraud" })).length, 1); // case-insensitive
  assert.equal(selectRows(rows, result, plan({ keywords: ["scammed"] })).length, 1);
  assert.equal(selectRows(rows, result, plan({ keywords: ["unicorn"] })).length, 0);
});

await check("ask: comparison leaders are worked out by code", () => {
  const facts = buildFacts(rows, result, plan({ compareBy: "theme" }));
  assert.ok(facts.comparison);
  assert.equal(facts.comparison.leaders.mostNegativeMentions, "Delivery"); // 30 against 20
  assert.equal(facts.comparison.leaders.highestNegativeShare, "Fraud"); // 100% against 75%
  assert.equal(facts.comparison.leaders.highestPositiveShare, "Design"); // 100%
});

await check("ask: a number the AI makes up is caught, a rounded real number is not", () => {
  const facts = buildFacts(rows, result, plan({ sentiment: "negative" })); // 50 negative mentions
  assert.deepEqual(findUnverifiedNumbers("There are 50 negative mentions.", facts), []);
  assert.deepEqual(findUnverifiedNumbers("About 4,321 customers complained.", facts), ["4,321"]);
});

await check("report link: encode then decode gives the same report, and garbage is rejected", async () => {
  const report: ReportData = {
    version: 1,
    title: "T",
    generatedAt: "2026-01-01T00:00:00.000Z",
    datasetLabel: "Test",
    model: "test",
    kpis: { totalMentions: 100, uniqueReviews: 4, positive: 0.5, neutral: 0, negative: 0.5, netSentiment: 0, critical: 50 },
    summary: "Summary text",
    priorities: [],
    strengths: [],
    themes: [],
    issues: [],
  };
  const text = await encodeReport(report);
  assert.deepEqual(await decodeReport(text), report);
  assert.equal(await decodeReport("z.garbage"), null);
  assert.equal(await decodeReport("nonsense"), null);
});

await check("trend: compares the earlier and later half of the dates, and says nothing without dates", () => {
  const dated: FeedbackRow[] = [
    { id: 1, review: "a", category: null, date: "2026-01-01", occurrences: 10 }, // early, negative
    { id: 2, review: "b", category: null, date: "2026-01-02", occurrences: 10 }, // early, positive -> 50% negative
    { id: 3, review: "c", category: null, date: "2026-03-01", occurrences: 18 }, // late, negative
    { id: 4, review: "d", category: null, date: "2026-03-02", occurrences: 2 }, // late, positive -> 90% negative
  ];
  const labelled: AnalysisResult = {
    ...result,
    themes: ["X"],
    labels: [label(1, "negative", "X", 3, "p"), label(2, "positive", "X", 1, "q"), label(3, "negative", "X", 3, "p"), label(4, "positive", "X", 1, "q")],
  };
  assert.equal(computeMetrics(dated, labelled).themes[0].trend, "worse");
  // The same feedback with the early and late dates swapped goes from 90% negative to 50% negative, so it is "better".
  const swapped = dated.map((r) => ({ ...r, date: r.date?.startsWith("2026-01") ? `2026-03${r.date.slice(7)}` : `2026-01${r.date?.slice(7)}` }));
  assert.equal(computeMetrics(swapped, labelled).themes[0].trend, "better");
  assert.equal(computeMetrics(rows, result).themes[0].trend, null); // no dates, so no direction is guessed
});

// The saved sample analysis must match the sample data, so the demo never shows wrong numbers.
await check("saved sample analysis: every label points at a real row and totals add up", () => {
  const file = path.join(process.cwd(), "data", "analysis-sample.json");
  if (!fs.existsSync(file)) return;
  const saved = JSON.parse(fs.readFileSync(file, "utf8")) as AnalysisResult;
  const ids = new Set(saved.labels.map((l) => l.id));
  assert.equal(ids.size, saved.labels.length);
  for (const l of saved.labels) assert.ok(saved.themes.includes(l.theme) || l.theme === "Other", `unknown theme ${l.theme}`);
  assert.equal(saved.labels.length, saved.totalUnique - saved.failedTexts);
});

console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}.`);
