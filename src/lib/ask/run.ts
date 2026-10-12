// Answers one question in three steps: plan (AI), facts (code), explanation (AI), then checks the figures.
import type { FeedbackRow } from "../feedback-types.ts";
import { post, type RunOptions } from "../analysis/run.ts";
import type { AnalysisResult } from "../analysis/types.ts";
import { buildFacts, describeScope, findUnverifiedNumbers } from "./facts.ts";
import type { AskContext, AskPlan, AskResult } from "./types.ts";

export type AskProgress = "understanding" | "calculating" | "writing";

export type AskInfo = { context: string; hasDates: boolean };

const NOT_ABOUT_FEEDBACK =
  "I can only answer questions about your customer feedback, such as what customers are unhappy about, what they like, or how groups compare. Try asking one of those.";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Answers a question about the feedback. Three steps: plan, calculate, explain. See types.ts.
export async function askQuestion(
  question: string,
  rows: FeedbackRow[],
  result: AnalysisResult,
  info: AskInfo,
  options: RunOptions & { onStep?: (step: AskProgress) => void } = {},
): Promise<AskResult> {
  options.onStep?.("understanding");
  const dates = rows.map((r) => r.date).filter((d): d is string => !!d).sort();
  const context: AskContext = {
    themes: [...result.themes, "Other"],
    categories: [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))],
    hasDates: dates.length > 0,
    dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    today: today(),
  };
  const plan = await post<AskPlan>("/api/ask/plan", { question, context }, options);

  if (!plan.inScope) {
    return { question, plan, facts: null, answer: NOT_ABOUT_FEEDBACK, unverifiedNumbers: [] };
  }

  options.onStep?.("calculating");
  let usedPlan = plan;
  let facts = buildFacts(rows, result, usedPlan);

  // If nothing matches every condition, drop the guessed ones one at a time (category, then theme) and say so.
  const dropped: string[] = [];
  if (facts.matchedMentions === 0 && usedPlan.category) {
    usedPlan = { ...usedPlan, category: "" };
    dropped.push("the category");
    facts = buildFacts(rows, result, usedPlan);
  }
  if (facts.matchedMentions === 0 && usedPlan.theme && usedPlan.keywords.length > 0) {
    usedPlan = { ...usedPlan, theme: "" };
    dropped.push("the theme");
    facts = buildFacts(rows, result, usedPlan);
  }
  if (dropped.length > 0 && facts.matchedMentions > 0) {
    facts.relaxedNote = `Nothing matched every condition in the question, so ${dropped.join(" and ")} was ignored.`;
  }

  // Still nothing: say so plainly instead of asking the AI to explain an empty selection.
  if (facts.matchedMentions === 0) {
    return {
      question,
      plan,
      facts,
      answer: `I found nothing to answer this with. I looked at: ${describeScope(plan)}. Try a broader question, or check the spelling of the topic.`,
      unverifiedNumbers: [],
    };
  }

  options.onStep?.("writing");
  const written = await post<{ answer: string }>("/api/ask/answer", { question, facts, context: info.context }, options);
  return { question, plan: usedPlan, facts, answer: written.answer, unverifiedNumbers: findUnverifiedNumbers(written.answer, facts) };
}
