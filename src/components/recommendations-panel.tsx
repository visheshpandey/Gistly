"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { NewDataBanner } from "@/components/new-data-banner";
import { useAnalysis } from "@/components/use-analysis";
import { useIssues } from "@/components/use-issues";
import { AnalysisRunError, fetchActions } from "@/lib/analysis/run";
import { explainRank, rankPriorities } from "@/lib/analysis/priority";

const nf = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function Panel() {
  const { rows, uid } = useFeedbackData();
  const { result, metrics, loaded, save } = useAnalysis();
  const { issues, add } = useIssues();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const priorities = useMemo(() => (metrics ? rankPriorities(metrics) : []), [metrics]);

  if (!loaded && !result) {
    return <p role="status" className="text-sm text-muted-foreground">Loading your analysis...</p>;
  }

  if (!result || !metrics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <h2 className="text-base font-medium">Run the AI analysis first</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Recommendations are ranked from the sentiment, themes and severity the AI finds in your feedback.
          </p>
          <Link href="/analysis" className={buttonVariants()}>
            Go to AI Analysis
          </Link>
        </CardContent>
      </Card>
    );
  }

  const missingActions = priorities.slice(0, 6).some((p) => !result.actions?.[p.theme]);

  async function writeActions() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const actions = await fetchActions(rows, result);
      save({ ...result, actions: { ...result.actions, ...actions } });
    } catch (e) {
      setError(e instanceof AnalysisRunError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (priorities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No problems found</p>
        <p className="mt-1 text-sm text-muted-foreground">The analysis found no negative feedback to rank.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <NewDataBanner />
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="text-base font-medium">How problems are ranked</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Each problem theme gets a score from three numbers multiplied together: how much of all feedback is about it,
            how much of that is negative, and how serious the complaints are (average severity out of 5). Scores are shown
            relative to the top problem, which is always 100. Repeated reviews count every time they were received.
          </p>
          <p className="text-xs text-muted-foreground">
            Ranking and numbers are calculated by InsightFlow. Only the suggested actions are written by AI ({result.model}).
          </p>
        </CardContent>
      </Card>

      {missingActions && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void writeActions()} disabled={busy}>
            {busy ? "Writing actions..." : "Write suggested actions"}
          </Button>
          <p className="text-sm text-muted-foreground">Some problems have no suggested action yet.</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      <ol className="flex flex-col gap-4">
        {priorities.map((p) => {
          const action = result.actions?.[p.theme];
          return (
            <li key={p.theme}>
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-label={`Rank ${p.rank}`}>
                        {p.rank}
                      </span>
                      <h2 className="text-lg font-semibold tracking-tight">{p.theme}</h2>
                      {p.stat.trend && (
                        <Badge variant={p.stat.trend === "worse" ? "destructive" : "secondary"}>
                          {p.stat.trend === "worse" ? "Getting worse" : p.stat.trend === "better" ? "Getting better" : "Steady"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-2xl font-semibold tabular-nums">
                        {p.score.toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground"> / 100</span>
                      </p>
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Priority score ${p.score.toFixed(0)} out of 100`}>
                        <div className="h-full bg-rose-500" style={{ width: `${p.score}%` }} />
                      </div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <dt className="text-xs text-muted-foreground">Share of feedback</dt>
                      <dd className="text-lg font-semibold tabular-nums">{pct(p.frequency)}</dd>
                      <dd className="text-xs text-muted-foreground tabular-nums">{nf.format(p.stat.mentions)} mentions</dd>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <dt className="text-xs text-muted-foreground">Negative</dt>
                      <dd className="text-lg font-semibold tabular-nums">{pct(p.negativeShare)}</dd>
                      <dd className="text-xs text-muted-foreground tabular-nums">{nf.format(p.stat.negative)} mentions</dd>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <dt className="text-xs text-muted-foreground">Severity</dt>
                      <dd className="text-lg font-semibold tabular-nums">{p.avgSeverity.toFixed(1)}/5</dd>
                      <dd className="text-xs text-muted-foreground">average</dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="text-sm font-medium">Why it ranks here</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{explainRank(p, priorities[0])}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">Suggested action</h3>
                      <Badge variant="secondary">AI-written</Badge>
                    </div>
                    <p className="mt-1 text-sm">{action ?? <span className="text-muted-foreground">Not written yet.</span>}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {issues.some((i) => i.datasetUid === uid && i.theme === p.theme) ? (
                      <>
                        <Badge variant="secondary">Saved as an issue</Badge>
                        <Link href="/issues" className={buttonVariants({ variant: "ghost" })}>
                          View in Issues
                        </Link>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() =>
                          add({
                            datasetUid: uid,
                            theme: p.theme,
                            title: p.stat.topIssues[0] ? `${p.theme}: ${p.stat.topIssues[0].issue}` : p.theme,
                            action: action ?? "",
                            snapshot: {
                              priorityScore: p.score,
                              mentions: p.stat.mentions,
                              negativeShare: p.negativeShare,
                              avgSeverity: p.avgSeverity,
                            },
                          })
                        }
                      >
                        Save as issue
                      </Button>
                    )}
                  </div>

                  {(p.stat.topIssues.length > 0 || p.stat.quotes.length > 0) && (
                    <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
                      {p.stat.topIssues.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium">Most common issues</h3>
                          <ul className="mt-1 flex flex-col gap-1 text-sm">
                            {p.stat.topIssues.map((i) => (
                              <li key={i.issue} className="flex justify-between gap-3">
                                <span className="first-letter:uppercase">{i.issue}</span>
                                <span className="tabular-nums text-muted-foreground">{nf.format(i.mentions)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {p.stat.quotes.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium">What customers said</h3>
                          <div className="mt-1 flex flex-col gap-1.5">
                            {p.stat.quotes.map((q) => (
                              <p key={q.text} className="text-xs text-muted-foreground">
                                “{q.text}” <span className="tabular-nums">×{nf.format(q.mentions)}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RecommendationsPanel() {
  return (
    <DataGate>
      <Panel />
    </DataGate>
  );
}
