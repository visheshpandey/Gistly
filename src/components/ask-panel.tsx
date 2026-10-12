"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { NewDataBanner } from "@/components/new-data-banner";
import { useAnalysis } from "@/components/use-analysis";
import { AnalysisRunError } from "@/lib/analysis/run";
import { askQuestion, type AskProgress } from "@/lib/ask/run";
import { getItem, putItem } from "@/lib/storage/db";
import { MAX_QUESTION_CHARS, SUGGESTED_QUESTIONS, type AskResult } from "@/lib/ask/types";

const nf = new Intl.NumberFormat("en-US");

const STEP_TEXT: Record<AskProgress, string> = {
  understanding: "Understanding your question",
  calculating: "Calculating from your feedback",
  writing: "Writing the answer",
};

function AnswerCard({ r }: { r: AskResult }) {
  const f = r.facts;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">{r.question}</h2>
        <p className="max-w-prose text-sm leading-relaxed">{r.answer}</p>

        {r.unverifiedNumbers.length > 0 && (
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            Some figures in this answer ({r.unverifiedNumbers.join(", ")}) could not be matched to the calculated numbers.
            Check the evidence below before relying on them.
          </p>
        )}
        {f?.relaxedNote && <p className="text-xs text-muted-foreground">{f.relaxedNote}</p>}

        {f && f.matchedMentions > 0 && (
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">How this was worked out</summary>
            <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
              <p>
                Looked at: <span className="text-foreground">{f.scope}</span>
              </p>
              <p>
                That is <span className="tabular-nums text-foreground">{nf.format(f.matchedMentions)}</span> of{" "}
                <span className="tabular-nums">{nf.format(f.allMentions)}</span> mentions ({f.matchedShareOfAll}), from{" "}
                <span className="tabular-nums">{nf.format(f.matchedUniqueReviews)}</span> unique reviews.
              </p>
              <p>
                Within it: {f.sentiment.positive} positive, {f.sentiment.neutral} neutral, {f.sentiment.negative} negative.
              </p>
              <p className="text-xs">{f.coverageNote}</p>
              <p className="text-xs">
                Every number was calculated by InsightFlow from the AI labels. The AI only turned your question into a
                search and then explained those numbers.
              </p>
            </div>
          </details>
        )}

        {f && f.quotes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">What customers wrote</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {f.quotes.map((q) => (
                <li key={q.text} className="flex flex-col gap-1 rounded-lg border p-3">
                  <p className="text-sm">“{q.text}”</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={q.sentiment === "negative" ? "destructive" : "secondary"}>{q.sentiment}</Badge>
                    <span className="tabular-nums">received {nf.format(q.receivedTimes)}×</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MAX_SAVED_ANSWERS = 30;

// Each dataset keeps its own questions and answers. Panel is remounted for every dataset (see AskPanel).
function Panel({ uid }: { uid: string }) {
  const { rows, context } = useFeedbackData();
  const { result, loaded, pending } = useAnalysis();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AskResult[]>([]);
  const historyRef = useRef<AskResult[]>([]);
  const [step, setStep] = useState<AskProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const asking = step !== null;

  function commitHistory(next: AskResult[]) {
    historyRef.current = next;
    setHistory(next);
  }

  // Leaving the page cancels a question that is still being answered.
  useEffect(() => () => controller.current?.abort(), []);

  // Bring back this dataset's earlier answers.
  useEffect(() => {
    let cancelled = false;
    getItem<AskResult[]>("ask", uid).then(
      (stored) => {
        if (cancelled || !Array.isArray(stored) || stored.length === 0) return;
        commitHistory([...historyRef.current, ...stored].slice(0, MAX_SAVED_ANSWERS));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (!loaded && !result) {
    return <p role="status" className="text-sm text-muted-foreground">Loading your analysis...</p>;
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <h2 className="text-base font-medium">Run the AI analysis first</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Questions are answered from the labels the AI gives your feedback, so there has to be an analysis to ask
            about.
          </p>
          <Link href="/analysis" className={buttonVariants()}>
            Go to AI Analysis
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 3 || asking || !result) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError(null);
    setStep("understanding");
    try {
      const answer = await askQuestion(
        q,
        rows,
        result,
        { context, hasDates: rows.some((r) => r.date) },
        { signal: abort.signal, onStep: setStep },
      );
      const next = [answer, ...historyRef.current].slice(0, MAX_SAVED_ANSWERS);
      commitHistory(next);
      // Saved quietly; the answers still show if the browser refuses to store them.
      void putItem("ask", uid, next).catch(() => {});
      setQuestion("");
    } catch (e) {
      if (!abort.signal.aborted) {
        setError(e instanceof AnalysisRunError ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setStep(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <NewDataBanner />

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="ask-input" className="text-sm font-medium">
          Ask a question about your feedback
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            disabled={asking}
            placeholder="For example: What do customers say about delivery?"
            className="h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:text-sm"
          />
          <Button type="submit" size="lg" disabled={asking || question.trim().length < 3}>
            {asking ? "Working..." : "Ask"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={asking}
              onClick={() => void ask(q)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        {pending.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {nf.format(pending.length)} newer reviews are not analysed yet, so answers do not include them.
          </p>
        )}
      </form>

      {asking && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Working on your question">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{STEP_TEXT[step]}...</p>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Could not answer that</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      )}

      {history.length === 0 && !asking && (
        <p className="text-sm text-muted-foreground">
          Answers appear here with the real reviews behind them. Each question is answered on its own, so include the
          topic every time. To add more feedback, go to{" "}
          <Link href="/feedback" className="underline underline-offset-4">
            Feedback
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-4">
        {history.map((r, i) => (
          <AnswerCard key={`${r.question}-${history.length - i}`} r={r} />
        ))}
      </div>
    </div>
  );
}

function ForDataset() {
  const { uid } = useFeedbackData();
  return <Panel key={uid} uid={uid} />;
}

export function AskPanel() {
  return (
    <DataGate>
      <ForDataset />
    </DataGate>
  );
}
