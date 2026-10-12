import "server-only";

// The only place that reads environment variables. Values come from .env.local on your computer and from the
// project settings on Vercel; see .env.example for the list. None of these are ever sent to the browser.

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const serverEnv = {
  /** Google Gemini key, for AI analysis, Ask and suggested actions. */
  geminiApiKey: () => read("GEMINI_API_KEY"),
  /** Gemini model id, for example a Flash model from Google AI Studio. */
  geminiModel: () => read("GEMINI_MODEL"),
  /** Adaption key, for the deduplication and quality check. */
  adaptionApiKey: () => read("ADAPTION_API_KEY"),
};
