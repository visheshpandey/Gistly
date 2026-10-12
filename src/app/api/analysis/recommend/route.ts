import { generateJson } from "@/lib/analysis/gemini";
import { badRequest, errorResponse } from "@/lib/analysis/http";
import { actionsPrompt, actionsSchema } from "@/lib/analysis/prompts";
import { MAX_ACTION_THEMES, type ActionRequestItem, type ActionsResponse } from "@/lib/analysis/types";

function parseItems(value: unknown): ActionRequestItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTION_THEMES) return null;
  const items: ActionRequestItem[] = [];
  for (const v of value) {
    const it = v as Partial<ActionRequestItem> | null;
    if (
      !it ||
      typeof it.theme !== "string" ||
      it.theme.length === 0 ||
      it.theme.length > 60 ||
      typeof it.mentions !== "number" ||
      typeof it.negativeShare !== "number" ||
      typeof it.avgSeverity !== "number" ||
      !Array.isArray(it.topIssues) ||
      !Array.isArray(it.quotes)
    ) {
      return null;
    }
    items.push({
      theme: it.theme,
      mentions: it.mentions,
      negativeShare: it.negativeShare,
      avgSeverity: it.avgSeverity,
      topIssues: it.topIssues.filter((t): t is string => typeof t === "string").slice(0, 3),
      quotes: it.quotes.filter((t): t is string => typeof t === "string").slice(0, 2),
    });
  }
  return items;
}

// Asks the AI for one suggested action per problem theme. The numbers are shown to it but never come back from it.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { items?: unknown; context?: unknown } | null;
  const items = parseItems(body?.items);
  if (!items) return badRequest(`Send between 1 and ${MAX_ACTION_THEMES} themes with their numbers.`);
  const context = typeof body?.context === "string" ? body.context.slice(0, 200) : "";

  try {
    const { data, model } = await generateJson(actionsPrompt(items, context), actionsSchema());
    const allowed = new Set(items.map((i) => i.theme));
    const actions: Record<string, string> = {};
    for (const raw of Array.isArray(data) ? data : []) {
      const r = raw as { theme?: unknown; action?: unknown } | null;
      if (typeof r?.theme === "string" && allowed.has(r.theme) && typeof r.action === "string" && r.action.trim()) {
        actions[r.theme] = r.action.trim().slice(0, 240);
      }
    }
    if (Object.keys(actions).length === 0) {
      return Response.json({ error: "The AI did not return any actions. Please try again.", code: "bad_output" }, { status: 502 });
    }
    const response: ActionsResponse = { actions, model };
    return Response.json(response);
  } catch (e) {
    return errorResponse(e);
  }
}

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
