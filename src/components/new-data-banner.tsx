"use client";

import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/components/use-analysis";
import { useAnalysisRunner, type RunState } from "@/components/use-analysis-runner";

const nf = new Intl.NumberFormat("en-US");

// Shown when feedback has been added since the last analysis. One click labels only the new reviews.
export function PendingNotice({
  count,
  run,
  elapsed,
  onAnalyse,
  onCancel,
}: {
  count: number;
  run: RunState;
  elapsed: number;
  onAnalyse: () => void;
  onCancel: () => void;
}) {
  const running = run.phase === "running";
  const progress = running ? run.progress : null;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p className="font-medium">
          {nf.format(count)} new {count === 1 ? "review has" : "reviews have"} not been analysed yet
        </p>
        <p className="text-muted-foreground">
          {running
            ? progress?.phase === "labelling"
              ? `Labelled ${nf.format(progress.done)} of ${nf.format(progress.total)} · ${elapsed}s`
              : progress?.phase === "actions"
                ? `Updating recommendations · ${elapsed}s`
                : `Starting · ${elapsed}s`
            : "Charts and rankings cover the older feedback until you analyse them. This only takes a few seconds."}
        </p>
        {run.phase === "error" && (
          <p role="alert" className="mt-1 text-destructive">
            {run.message}
          </p>
        )}
      </div>
      {running ? (
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      ) : (
        <Button onClick={onAnalyse}>Analyse new feedback</Button>
      )}
    </div>
  );
}

// Self-contained version for pages that only need the banner (dashboard, recommendations).
export function NewDataBanner() {
  const { pending, result } = useAnalysis();
  const { run, elapsed, start, cancel } = useAnalysisRunner();
  if (!result || (pending.length === 0 && run.phase !== "running")) return null;
  return <PendingNotice count={pending.length} run={run} elapsed={elapsed} onAnalyse={() => void start("incremental")} onCancel={cancel} />;
}
