import { generateJson } from "@/lib/analysis/gemini";
import { badRequest, errorResponse } from "@/lib/analysis/http";
import { labelPrompt, labelSchema } from "@/lib/analysis/prompts";
import {
  BATCH_SIZE,
  KINDS,
  OTHER_THEME,
  SENTIMENTS,
  type Kind,
  type LabelResponse,
  type ReviewLabel,
  type Sentiment,
} from "@/lib/analysis/types";

type Item = { id: number; text: string };

function parseItems(value: unknown): Item[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > BATCH_SIZE + 10) return null;
  const items: Item[] = [];
  for (const v of value) {
    const item = v as Partial<Item> | null;
    if (!item || !Number.isInteger(item.id) || typeof item.text !== "string") return null;
    items.push({ id: item.id as number, text: item.text });
  }
  return items;
}

// Keeps only labels that are complete and valid. Anything else is left out, and the browser retries it.
function validLabel(raw: unknown, ids: Set<number>, themes: Set<string>): ReviewLabel | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== "number" || !ids.has(r.id)) return null;
  if (!SENTIMENTS.includes(r.sentiment as Sentiment)) return null;
  if (!KINDS.includes(r.kind as Kind)) return null;
  if (typeof r.severity !== "number" || !Number.isFinite(r.severity)) return null;
  const theme = typeof r.theme === "string" && themes.has(r.theme) ? r.theme : OTHER_THEME;
  const keyIssue = typeof r.key_issue === "string" ? r.key_issue.trim().toLowerCase().slice(0, 80) : "";
  return {
    id: r.id,
    sentiment: r.sentiment as Sentiment,
    theme,
    severity: Math.min(5, Math.max(1, Math.round(r.severity))),
    keyIssue,
    kind: r.kind as Kind,
  };
}

// Step 2 of an analysis: label one batch of reviews with sentiment, theme, severity, key issue and kind.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { items?: unknown; themes?: unknown; context?: unknown }
    | null;
  const items = parseItems(body?.items);
  if (!items) return badRequest(`Send between 1 and ${BATCH_SIZE} reviews with an id and text.`);
  const themes = body?.themes;
  if (
    !Array.isArray(themes) ||
    themes.length < 2 ||
    themes.length > 15 ||
    !themes.every((t) => typeof t === "string" && t.length > 0 && t.length <= 60)
  ) {
    return badRequest("Send the list of themes.");
  }
  const context = typeof body?.context === "string" ? body.context.slice(0, 200) : "";

  try {
    const { data, model } = await generateJson(
      labelPrompt(items, themes as string[], context),
      labelSchema(themes as string[]),
    );
    const ids = new Set(items.map((i) => i.id));
    const allowed = new Set(themes as string[]);
    const labels: ReviewLabel[] = [];
    const taken = new Set<number>();
    for (const raw of Array.isArray(data) ? data : []) {
      const label = validLabel(raw, ids, allowed);
      if (label && !taken.has(label.id)) {
        taken.add(label.id);
        labels.push(label);
      }
    }
    const response: LabelResponse = { labels, model };
    return Response.json(response);
  } catch (e) {
    return errorResponse(e);
  }
}

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
