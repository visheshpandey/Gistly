// Asks questions about the sample dataset through the running app and prints the plan, the numbers and the answer.
//
// Usage (PowerShell, from the insightflow folder, with `npm run dev` running):
//   node scripts/ask-sample.ts
//   node scripts/ask-sample.ts "What do customers say about delivery?"
import fs from "node:fs";
import path from "node:path";
import { askQuestion } from "../src/lib/ask/run.ts";
import type { AnalysisResult } from "../src/lib/analysis/types.ts";
import type { FeedbackRow } from "../src/lib/feedback-types.ts";

const baseUrl = "http://localhost:3000";
const custom = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const questions =
  custom.length > 0
    ? custom
    : [
        "What are customers most unhappy about?",
        "What do customers say about refunds?",
        "Which category has the most problems?",
        "What do customers like most?",
        "Is delivery getting worse over time?",
        "Who won the football world cup?",
        "What do customers say about unicorns?",
      ];

const rows = ((await (await fetch(`${baseUrl}/api/sample`)).json()) as { rows: FeedbackRow[] }).rows;
const result = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "analysis-sample.json"), "utf8")) as AnalysisResult;

for (const question of questions) {
  const started = performance.now();
  try {
    const r = await askQuestion(question, rows, result, { context: "", hasDates: false }, { baseUrl });
    console.log(`\nQ: ${question}   (${((performance.now() - started) / 1000).toFixed(1)} s)`);
    console.log(`   plan: in scope ${r.plan.inScope}, focus ${r.plan.focus}, sentiment ${r.plan.sentiment}, theme "${r.plan.theme}", category "${r.plan.category}", keywords [${r.plan.keywords.join(", ")}], compare by ${r.plan.compareBy}`);
    if (r.facts) {
      console.log(`   facts: ${r.facts.scope} -> ${r.facts.matchedMentions} of ${r.facts.allMentions} mentions (${r.facts.matchedShareOfAll}); negative ${r.facts.sentiment.negative}; top issue: ${r.facts.topIssues[0]?.issue ?? "none"} (${r.facts.topIssues[0]?.mentions ?? 0})`);
    }
    console.log(`   A: ${r.answer}`);
    console.log(`   unverified numbers: ${r.unverifiedNumbers.length ? r.unverifiedNumbers.join(", ") : "none"}`);
  } catch (e) {
    console.log(`\nQ: ${question}\n   FAILED: ${e instanceof Error ? e.message : e}`);
  }
}
