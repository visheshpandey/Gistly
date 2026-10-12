import { generateJson } from "@/lib/analysis/gemini";
import { badRequest, handleRoute } from "@/lib/server/api";
import { THEMES_SCHEMA, themesPrompt } from "@/lib/analysis/prompts";
import { tidyThemeName } from "@/lib/analysis/themes";
import { OTHER_THEME, THEME_SAMPLE_SIZE, type ThemesResponse } from "@/lib/analysis/types";

// Step 1 of an analysis: read a sample of reviews and propose the theme names.
export const POST = handleRoute(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as { texts?: unknown; context?: unknown } | null;
  const texts = body?.texts;
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > THEME_SAMPLE_SIZE + 20) {
    return badRequest("Send a sample of review texts.");
  }
  if (!texts.every((t) => typeof t === "string")) return badRequest("Review texts must be strings.");
  const context = typeof body?.context === "string" ? body.context.slice(0, 200) : "";

  const { data, model } = await generateJson(themesPrompt(texts as string[], context), THEMES_SCHEMA);
  const raw = (data as { themes?: unknown } | null)?.themes;
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    if (typeof t !== "string") continue;
    const name = tidyThemeName(t).slice(0, 60);
    const key = name.toLowerCase();
    if (!name || key === OTHER_THEME.toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    themes.push(name);
  }
  if (themes.length < 2) {
    return Response.json(
      { error: "The AI did not propose usable themes. Please try again.", code: "bad_output" },
      { status: 502 },
    );
  }
  const response: ThemesResponse = { themes: themes.slice(0, 12), model };
  return Response.json(response);
});

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
