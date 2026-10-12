// API: step 1 of a question. The AI turns the question into a search plan using only values in this dataset.
import { generateJson } from "@/lib/analysis/gemini";
import { badRequest, handleRoute } from "@/lib/server/api";
import { SENTIMENTS } from "@/lib/analysis/types";
import { PLAN_SCHEMA, planPrompt } from "@/lib/ask/prompts";
import { MAX_QUESTION_CHARS, type AskContext, type AskFocus, type AskPlan, type CompareBy } from "@/lib/ask/types";

const FOCUS: AskFocus[] = ["overview", "problems", "strengths", "compare", "examples", "trend"];
const COMPARE: CompareBy[] = ["theme", "category", "none"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseContext(value: unknown): AskContext | null {
  const c = value as Partial<AskContext> | null;
  if (!c || !Array.isArray(c.themes) || !Array.isArray(c.categories)) return null;
  const themes = c.themes.filter((t): t is string => typeof t === "string").slice(0, 20);
  const categories = c.categories.filter((t): t is string => typeof t === "string").slice(0, 40);
  const range = c.dateRange;
  return {
    themes,
    categories,
    hasDates: c.hasDates === true,
    dateRange: range && DATE.test(range.from) && DATE.test(range.to) ? { from: range.from, to: range.to } : null,
    today: typeof c.today === "string" && DATE.test(c.today) ? c.today : new Date().toISOString().slice(0, 10),
  };
}

// Step 1 of a question: the AI says which feedback the question is about. It cannot see any feedback here.
export const POST = handleRoute(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as { question?: unknown; context?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > MAX_QUESTION_CHARS) {
    return badRequest(`Ask a question between 3 and ${MAX_QUESTION_CHARS} characters.`);
  }
  const context = parseContext(body?.context);
  if (!context) return badRequest("Missing information about the feedback.");

  const { data } = await generateJson(planPrompt(question, context), PLAN_SCHEMA);
  const r = (data ?? {}) as Record<string, unknown>;
  // Only accept values that really exist in this dataset, so a wrong guess becomes "no filter".
  const theme = typeof r.theme === "string" && r.theme !== "Other" && context.themes.includes(r.theme) ? r.theme : "";
  const category =
    typeof r.category === "string" ? (context.categories.find((c) => c.toLowerCase() === (r.category as string).toLowerCase()) ?? "") : "";
  const plan: AskPlan = {
    inScope: r.in_scope === true,
    focus: FOCUS.includes(r.focus as AskFocus) ? (r.focus as AskFocus) : "overview",
    sentiment: SENTIMENTS.includes(r.sentiment as never) ? (r.sentiment as AskPlan["sentiment"]) : "any",
    theme,
    category,
    keywords: Array.isArray(r.keywords)
      ? r.keywords.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 4)
      : [],
    compareBy: COMPARE.includes(r.compare_by as CompareBy) ? (r.compare_by as CompareBy) : "none",
    from: context.hasDates && typeof r.from === "string" && DATE.test(r.from) ? r.from : "",
    to: context.hasDates && typeof r.to === "string" && DATE.test(r.to) ? r.to : "",
  };
  // A trend or a comparison needs both good and bad feedback in view, so it is never limited to one sentiment.
  if (plan.focus === "trend" || plan.compareBy !== "none") plan.sentiment = "any";
  return Response.json(plan);
});

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
