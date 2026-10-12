import { generateJson } from "@/lib/analysis/gemini";
import { badRequest, errorResponse } from "@/lib/analysis/http";
import { ANSWER_SCHEMA, answerPrompt } from "@/lib/ask/prompts";
import { MAX_QUESTION_CHARS, type AskFacts } from "@/lib/ask/types";

// Step 3 of a question: the AI explains numbers that Verdict already calculated.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { question?: unknown; facts?: unknown; context?: unknown }
    | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > MAX_QUESTION_CHARS) {
    return badRequest(`Ask a question between 3 and ${MAX_QUESTION_CHARS} characters.`);
  }
  const facts = body?.facts as Partial<AskFacts> | undefined;
  if (!facts || typeof facts.scope !== "string" || typeof facts.matchedMentions !== "number") {
    return badRequest("Missing the calculated facts.");
  }
  const context = typeof body?.context === "string" ? body.context.slice(0, 200) : "";

  try {
    const { data } = await generateJson(answerPrompt(question, facts as AskFacts, context), ANSWER_SCHEMA);
    const answer = (data as { answer?: unknown } | null)?.answer;
    if (typeof answer !== "string" || !answer.trim()) {
      return Response.json({ error: "The AI did not write an answer. Please try again.", code: "bad_output" }, { status: 502 });
    }
    return Response.json({ answer: answer.trim().slice(0, 1200) });
  } catch (e) {
    return errorResponse(e);
  }
}

// Calls to an outside service can take several seconds. Allow up to a minute on hosts that cut functions off early.
export const maxDuration = 60;
