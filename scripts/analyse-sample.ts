// Runs the real AI analysis on the sample dataset through the running app, and prints a summary.
// Add --save to store the result as data/analysis-sample.json, so the demo shows it with no AI call.
//
// Usage (PowerShell, from the insightflow folder, with `npm run dev` running):
//   node scripts/analyse-sample.ts                  (preview only)
//   node scripts/analyse-sample.ts --save           (also writes data/analysis-sample.json)
//   node scripts/analyse-sample.ts --url http://localhost:3000
import fs from "node:fs";
import path from "node:path";
import { computeMetrics } from "../src/lib/analysis/metrics.ts";
import { explainRank, rankPriorities } from "../src/lib/analysis/priority.ts";
import { runAnalysis } from "../src/lib/analysis/run.ts";
import type { FeedbackRow } from "../src/lib/feedback-types.ts";

const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const baseUrl = urlIndex >= 0 ? args[urlIndex + 1] : "http://localhost:3000";
const save = args.includes("--save");

const sampleRes = await fetch(`${baseUrl}/api/sample`);
if (!sampleRes.ok) throw new Error(`Could not load the sample from ${baseUrl}. Is npm run dev running?`);
const rows = ((await sampleRes.json()) as { rows: FeedbackRow[] }).rows;
const totalMentions = rows.reduce((sum, r) => sum + r.occurrences, 0);

const started = performance.now();
let lastLine = "";
const result = await runAnalysis(
  rows,
  { datasetLabel: "Sample dataset", context: "", totalMentions },
  {
    baseUrl,
    onProgress: (p) => {
      const line = `${p.phase}: ${p.done}/${p.total}`;
      if (line !== lastLine) console.log(line);
      lastLine = line;
    },
  },
);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

const m = computeMetrics(rows, result);
const pct = (n: number) => `${((n / m.labelledMentions) * 100).toFixed(1)}%`;
console.log(`\nDone in ${seconds} s with ${result.model}. Labelled ${result.labels.length} of ${result.analysedTexts} unique reviews (${result.failedTexts} failed).`);
console.log(`Themes: ${result.themes.join(" | ")}`);
console.log(`Mentions: positive ${pct(m.positive)}, neutral ${pct(m.neutral)}, negative ${pct(m.negative)}; net sentiment ${m.netSentiment.toFixed(1)}; critical ${m.critical}`);
console.log(`Kinds: ${JSON.stringify(m.kinds)}; negative severity 1-5: ${JSON.stringify(m.severity)}`);
console.log("\nThemes by volume:");
for (const t of m.themes) {
  console.log(`  ${t.theme.padEnd(28)} ${String(t.mentions).padStart(5)} mentions | negative ${(t.negativeShare * 100).toFixed(0)}% | avg severity ${t.avgSeverity.toFixed(1)} | ${t.topIssues.map((i) => `${i.issue} (${i.mentions})`).join(", ")}`);
}
const ranked = rankPriorities(m);
console.log("\nPriority ranking (score 0-100 relative to the top problem):");
for (const p of ranked) {
  console.log(`  #${p.rank} ${p.theme.padEnd(28)} score ${p.score.toFixed(0).padStart(3)} | frequency ${(p.frequency * 100).toFixed(1)}% x negative ${(p.negativeShare * 100).toFixed(0)}% x severity ${p.severity.toFixed(2)}`);
  console.log(`      why: ${explainRank(p, ranked[0])}`);
  console.log(`      action: ${result.actions?.[p.theme] ?? "(none)"}`);
}
if (m.byCategory) {
  console.log("\nSentiment inside each category (category is not sentiment):");
  for (const c of m.byCategory) {
    console.log(`  ${c.category.padEnd(20)} positive ${((c.positive / c.mentions) * 100).toFixed(0)}% | neutral ${((c.neutral / c.mentions) * 100).toFixed(0)}% | negative ${((c.negative / c.mentions) * 100).toFixed(0)}%`);
  }
}

if (save) {
  const file = path.join(process.cwd(), "data", "analysis-sample.json");
  fs.writeFileSync(file, JSON.stringify({ ...result, source: "precomputed" }, null, 2));
  console.log(`\nSaved ${file}`);
}
