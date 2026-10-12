"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedbackData } from "@/components/data-provider";
import { useAnalysis } from "@/components/use-analysis";
import { AnalysisRunError, runAnalysis, runIncrementalAnalysis, type AnalysisProgress } from "@/lib/analysis/run";

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; mode: "full" | "incremental"; progress: AnalysisProgress | null }
  | { phase: "error"; message: string; code: string };

// What is stored: the state plus which dataset it belongs to. Only the open dataset's state is shown.
type Tracked = { forUid: string; state: RunState };

// Starts, tracks and cancels an AI analysis. Used by the AI Analysis page and by the "new feedback" banner.
// An analysis is for one dataset. If another dataset is opened while it runs, it is stopped, and when it finishes
// it is always saved for the dataset it was started on.
export function useAnalysisRunner() {
  const { rows, uid, label, context, summary } = useFeedbackData();
  const { result, save } = useAnalysis();
  const [tracked, setTracked] = useState<Tracked>({ forUid: "", state: { phase: "idle" } });
  const [elapsed, setElapsed] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const startedAt = useRef(0);

  const run: RunState = tracked.forUid === uid ? tracked.state : { phase: "idle" };
  const running = run.phase === "running";

  // Tick the clock while the analysis runs, so the user can see it is working.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed(Math.round((performance.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  // Opening a different dataset, or leaving the page, stops an analysis that is still running.
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [uid],
  );

  // "incremental" labels only the reviews added since the last analysis. It needs an earlier analysis to build on.
  async function start(mode: "full" | "incremental") {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    startedAt.current = performance.now();
    setElapsed(0);
    const forUid = uid;
    const effective = mode === "incremental" && result ? "incremental" : "full";
    const show = (state: RunState) => setTracked({ forUid, state });
    show({ phase: "running", mode: effective, progress: null });
    const info = { datasetLabel: label, context, totalMentions: summary.total };
    const options = {
      signal: abort.signal,
      onProgress: (progress: AnalysisProgress) => show({ phase: "running", mode: effective, progress }),
    };
    try {
      const next =
        effective === "incremental" && result
          ? await runIncrementalAnalysis(rows, result, info, options)
          : await runAnalysis(rows, info, options);
      save(next, forUid);
      show({ phase: "idle" });
    } catch (e) {
      if (abort.signal.aborted) {
        // Cancelled or switched away. Clear the state, unless a newer run has already taken over.
        if (controller.current === abort) show({ phase: "idle" });
        return;
      }
      const err = e instanceof AnalysisRunError ? e : new AnalysisRunError("Something went wrong.", "api");
      show({ phase: "error", message: err.message, code: err.code });
    }
  }

  function cancel() {
    controller.current?.abort();
    setTracked({ forUid: uid, state: { phase: "idle" } });
  }

  return { run, elapsed, running, start, cancel };
}
