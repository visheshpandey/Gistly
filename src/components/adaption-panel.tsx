"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { DEFAULT_CAP, qualityLine, useAdaption } from "@/components/adaption-provider";
import { Stat } from "@/components/stat";
import { MAX_REPEATS_SENT, MAX_ROWS_SENT } from "@/lib/adaption/types";

const nf = new Intl.NumberFormat("en-US");
function seconds(ms: number): string {
  return ms < 100 ? "under 0.1 s" : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

// The result we compute in the browser the moment a file is imported.
function InstantResult() {
  const { stats } = useFeedbackData();

  if (!stats) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Instant numbers are not available for this dataset. Upload the file again to see them.
      </p>
    );
  }

  const removedPct = stats.rowsKept > 0 ? (stats.duplicatesRemoved / stats.rowsKept) * 100 : 0;
  const ignored = stats.emptyRows + stats.junkRows;
  const t = stats.timings;
  const nearDupNote =
    stats.nearDup === "done"
      ? ` Near-duplicate pass merged ${nf.format(stats.nearDupMerged)}.`
      : stats.nearDup === "skipped"
        ? " Near-duplicate pass was skipped because it would have taken too long."
        : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">Instant</Badge>
        <p className="text-sm text-muted-foreground">Computed in your browser. Nothing was sent anywhere.</p>
      </div>
      <div className="kpi-strip">
        <Stat
          tint="a"
          label="Your data"
          value={nf.format(stats.rowsRead)}
          note={
            ignored > 0
              ? `${nf.format(stats.rowsKept)} usable rows. ${nf.format(ignored)} empty or symbol-only rows ignored`
              : `${nf.format(stats.rowsKept)} usable rows`
          }
        />
        <Stat
          tint="d"
          label="Unique entries"
          value={nf.format(stats.uniqueEntries)}
          note={`${nf.format(stats.duplicatesRemoved)} duplicates removed (${removedPct.toFixed(1)}%).${nearDupNote}`}
        />
        <Stat
          tint="e"
          label="Data quality (instant)"
          value={`${stats.after.grade} · ${stats.after.score.toFixed(1)}/10`}
          note={`Before cleaning: ${stats.before.grade} · ${stats.before.score.toFixed(1)}/10. Checks repeats, empty and very short rows, not the meaning of the text.`}
        />
        <Stat
          tint="c"
          label="Processed in"
          value={seconds(t.totalMs)}
          note={`Reading ${seconds(t.parseMs)} · deduplicating ${seconds(t.dedupeMs)} · scoring ${seconds(t.scoreMs)}`}
        />
      </div>
      {stats.overflowRows > 0 && (
        <p role="alert" className="notice p-3 text-sm">
          This file has more unique entries than InsightFlow can hold. {nf.format(stats.overflowRows)} rows after
          the limit were not included, so totals are lower than the file.
        </p>
      )}
    </div>
  );
}

function Panel() {
  const { rows, summary } = useFeedbackData();
  const { report, job, runningElsewhere, consent, setConsent, highlight, verify, confirmRun, dismiss } = useAdaption();
  const [capText, setCapText] = useState(String(consent.cap));
  const [elapsed, setElapsed] = useState(0);

  // Keep the cap box in step with the saved setting (it loads a moment after the page opens).
  useEffect(() => {
    const id = window.setTimeout(() => setCapText(String(consent.cap)), 0);
    return () => window.clearTimeout(id);
  }, [consent.cap]);

  // Tick the clock while a run is in progress, so it never looks frozen.
  const startedAt = job.phase === "running" ? job.startedAt : null;
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [startedAt]);

  const q = report?.quality ?? null;
  const line = report ? qualityLine(report) : null;
  const busy = job.phase === "preparing" || job.phase === "running";
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const staleBy = report && report.totalMentions !== summary.total ? summary.total - report.totalMentions : 0;
  const unknownProgress = job.phase === "running" && (job.percent === null || job.percent === 0);

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Instant result" className="flex flex-col gap-4">
        <InstantResult />
      </section>

      <section
        aria-label="Verified by Adaption"
        className={`flex flex-col gap-4 rounded-xl transition-shadow ${highlight ? "ring-2 ring-primary/70 ring-offset-8 ring-offset-background" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={report ? "default" : "outline"}>
            {report
              ? report.fromCache
                ? "Verified by Adaption (reused)"
                : report.source === "precomputed"
                  ? "Saved Adaption result"
                  : "Verified by Adaption"
              : "Not verified yet"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {report
              ? "A second opinion from Adaption on a sample of your data."
              : "Adaption gives a deeper quality check on a small sample. It runs in the background."}
          </p>
        </div>

        {report && (
          <>
            {line && (
              <p className="text-base font-medium">
                Verified by Adaption: <span className="tabular-nums">{line}</span>
              </p>
            )}
            <div className="kpi-strip">
              <Stat
                tint="a"
                label="Sent to Adaption"
                value={nf.format(report.rowsSent)}
                note={`${nf.format(report.textsSent)} texts, each up to ${MAX_REPEATS_SENT} times${report.sampled ? ", a sample of your data" : ""}`}
              />
              <Stat
                tint="d"
                label="Duplicates removed"
                value={nf.format(report.duplicatesRemoved)}
                note={`${nf.format(report.rowsAfter)} of ${nf.format(report.rowsSent)} rows kept`}
              />
              <Stat
                tint="e"
                label="Data quality (Adaption)"
                value={q && q.gradeAfter && q.scoreAfter !== null ? `${q.gradeAfter} · ${q.scoreAfter.toFixed(1)}/10` : "Not scored"}
                note={
                  q
                    ? `Before: ${q.gradeBefore ?? "?"}${q.scoreBefore !== null ? ` · ${q.scoreBefore.toFixed(1)}/10` : ""}${
                        q.percentileAfter !== null ? ` · percentile rank ${q.percentileAfter.toFixed(0)} of 100 (higher is better)` : ""
                      }`
                    : "Adaption did not return a quality score"
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {report.sampled
                ? `To keep the run short, Adaption processed a sample of ${nf.format(report.textsSent)} of your ${nf.format(report.totalUnique)} unique texts. The score describes that sample. `
                : ""}
              {staleBy > 0 ? `You have added ${nf.format(staleBy)} rows since this check. ` : ""}
              The instant numbers above come from your whole file and are our own estimate. The Adaption score uses a
              different scale, so the two are shown separately.
            </p>
          </>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-base font-medium">Check new uploads automatically</h2>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent.enabled}
                onChange={(e) => setConsent({ ...consent, enabled: e.target.checked })}
                className="mt-0.5 size-4"
              />
              <span>
                After I upload a file, check it with Adaption in the background
                <span className="block text-xs text-muted-foreground">
                  Off by default. A small sample of your review text is sent to Adaption (adaptionlabs.ai). The cost is
                  checked first, and nothing runs if it is above your limit.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="credit-cap">Most credits per run</label>
              <Input
                id="credit-cap"
                type="number"
                min={1}
                max={1000}
                value={capText}
                onChange={(e) => setCapText(e.target.value)}
                onBlur={() => setConsent({ ...consent, cap: Number(capText) || DEFAULT_CAP })}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">A typical run uses about 4.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-medium">Check this dataset with Adaption</h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Adaption removes duplicate and near-duplicate rows and scores the quality of your data. Only the Prompt
                Deduplication recipe is used, so your wording is never rewritten. A run usually takes 5 to 15 minutes
                however large your file is, because we send a small sample (at most {nf.format(MAX_ROWS_SENT)} rows),
                and it runs in the background. Checking the same data twice reuses the first result for free.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Your feedback text is sent to Adaption (adaptionlabs.ai) for processing. You see the credit cost before
                anything runs.
              </p>
            </div>

            {(job.phase === "idle" || job.phase === "error") && (
              <div className="flex flex-col gap-2">
                <div>
                  <Button onClick={verify} disabled={busy || rows.length === 0 || runningElsewhere !== null}>
                    {job.phase === "error" ? "Try again" : "Check cost"}
                  </Button>
                </div>
                {runningElsewhere && (
                  <p role="status" className="text-xs text-muted-foreground">
                    An Adaption check is already running for “{runningElsewhere.label}”. Wait for it to finish, then check
                    this dataset.
                  </p>
                )}
              </div>
            )}

            {job.phase === "preparing" && (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {job.message}
              </p>
            )}

            {job.phase === "estimated" && (
              <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4">
                <p className="text-sm" role="status">
                  This run would use about <span className="font-semibold">{nf.format(job.credits)} credits</span> and take
                  about <span className="font-semibold">{nf.format(job.minutes)} minutes</span>. It sends{" "}
                  {nf.format(job.rowsSent)} rows ({nf.format(job.textsSent)} texts{job.sampled ? ", a sample of your data" : ""}).
                </p>
                {job.overCap && (
                  <p className="text-sm text-destructive">
                    That is more than your limit of {nf.format(consent.cap)} credits. Raise the limit above, or confirm this one run.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={confirmRun}>Run with {nf.format(job.credits)} credits</Button>
                  <Button variant="outline" onClick={dismiss}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {job.phase === "running" && (
              <div className="flex flex-col gap-2" role="status" aria-live="polite">
                <div
                  className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Adaption progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={unknownProgress ? undefined : (job.percent ?? undefined)}
                >
                  {unknownProgress ? (
                    <div className="absolute inset-y-0 w-1/3 animate-[slide_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
                  ) : (
                    <div className="h-full bg-primary transition-all" style={{ width: `${job.percent}%` }} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Adaption is working ({job.statusText}) · {clock}. This usually takes 5 to 15 minutes and runs in the
                  background. You can keep using InsightFlow or close this page; we pick it up again when you return.
                </p>
              </div>
            )}

            {job.phase === "error" && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">
                  {job.code === "not_configured" ? "Adaption is not set up" : "Adaption could not finish"}
                </p>
                <p className="mt-1 text-muted-foreground">{job.message}</p>
                <p className="mt-1 text-muted-foreground">The instant numbers above are not affected.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function AdaptionPanel() {
  return (
    <DataGate>
      <Panel />
    </DataGate>
  );
}