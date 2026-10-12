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
import { explainRank, rankPriorities, type PriorityItem } from "@/lib/analysis/priority";
import type { AnalysisResult } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function TrendBadge({ trend }: { trend: PriorityItem["stat"]["trend"] }) {
  if (!trend) return null;
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide",
        trend === "worse" ? "bg-neg text-on-neg" : trend === "better" ? "bg-pos-bg text-foreground" : "bg-neu-bg text-muted-foreground",
      )}
    >
      {trend === "worse" ? "Getting worse" : trend === "better" ? "Getting better" : "Steady"}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border bg-card px-3 py-1 text-[0.8125rem] text-muted-foreground">
      {label} <b className="font-semibold tabular-nums text-foreground">{value}</b>
    </span>
  );
}

// Everything about one problem: the numbers, why it ranks where it does, the suggested action and real quotes.
function Detail({
  p,
  top,
  result,
  saved,
  onSave,
}: {
  p: PriorityItem;
  top: PriorityItem;
  result: AnalysisResult;
  saved: boolean;
  onSave: () => void;
}) {
  const action = result.actions?.[p.theme];
  return (
    <Card>
      <CardContent className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank #{p.rank}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{p.theme}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Fact label="score" value={`${p.score.toFixed(0)} / 100`} />
              <Fact label="mentions" value={nf.format(p.stat.mentions)} />
              <Fact label="negative" value={pct(p.negativeShare)} />
              <Fact label="severity" value={`${p.avgSeverity.toFixed(1)} / 5`} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested action</h3>
              <Badge variant="secondary">AI-written</Badge>
            </div>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed">
              {action ?? <span className="text-muted-foreground">Not written yet.</span>}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why it ranks here</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{explainRank(p, top)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {saved ? (
              <>
                <Badge variant="secondary">Saved as an issue</Badge>
                <Link href="/issues" className={buttonVariants({ variant: "ghost" })}>
                  View in Issues
                </Link>
              </>
            ) : (
              <Button onClick={onSave}>Track this issue</Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {p.stat.topIssues.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Most common issues</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {p.stat.topIssues.map((i) => (
                  <li key={i.issue} className="flex flex-col gap-1">
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="first-letter:uppercase">{i.issue}</span>
                      <span className="tabular-nums text-muted-foreground">{nf.format(i.mentions)}</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-neg"
                        style={{ width: `${(i.mentions / Math.max(1, p.stat.topIssues[0].mentions)) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.stat.quotes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What customers said</h3>
              <ul className="mt-2 flex flex-col">
                {p.stat.quotes.map((q) => (
                  <li key={q.text} className="flex items-baseline gap-3 border-b py-2 last:border-b-0">
                    <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      {nf.format(q.mentions)}×
                    </span>
                    <span className="text-sm">“{q.text}”</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Panel() {
  const { rows, uid } = useFeedbackData();
  const { result, metrics, loaded, save } = useAnalysis();
  const { issues, add } = useIssues();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const priorities = useMemo(() => (metrics ? rankPriorities(metrics) : []), [metrics]);

  if (!loaded && !result) {
    return <p role="status" className="text-sm text-muted-foreground">Loading your analysis...</p>;
  }

  if (!result || !metrics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <h2 className="text-base font-semibold">Run the AI analysis first</h2>
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

  const top = priorities[0];
  const current = priorities.find((p) => p.theme === selected) ?? top;
  const isSaved = (theme: string) => issues.some((i) => i.datasetUid === uid && i.theme === theme);
  const saveIssue = (p: PriorityItem) =>
    add({
      datasetUid: uid,
      theme: p.theme,
      title: p.stat.topIssues[0] ? `${p.theme}: ${p.stat.topIssues[0].issue}` : p.theme,
      action: result.actions?.[p.theme] ?? "",
      snapshot: {
        priorityScore: p.score,
        mentions: p.stat.mentions,
        negativeShare: p.negativeShare,
        avgSeverity: p.avgSeverity,
      },
    });

  return (
    <div className="flex flex-col gap-6">
      <NewDataBanner />

      <div className="flex flex-col gap-3 rounded-xl bg-tint-a p-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl text-sm leading-relaxed">
          <span className="font-semibold">Score = share of feedback × negative share × severity</span>, shown relative to
          the top problem (always 100). Repeated reviews count every time. Ranking and numbers are calculated by
          InsightFlow; only the suggested actions are AI-written ({result.model}).
        </p>
        {missingActions && (
          <Button onClick={() => void writeActions()} disabled={busy} className="shrink-0">
            {busy ? "Writing actions..." : "Write suggested actions"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Problems ranked by priority. Select a row for details.</caption>
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="w-12 px-4 py-3">#</th>
                <th scope="col" className="px-4 py-3">Problem</th>
                <th scope="col" className="px-4 py-3 text-right">Mentions</th>
                <th scope="col" className="px-4 py-3 text-right">Negative</th>
                <th scope="col" className="px-4 py-3 text-right">Severity</th>
                <th scope="col" className="w-48 px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {priorities.map((p) => {
                const active = p.theme === current.theme;
                return (
                  <tr
                    key={p.theme}
                    aria-selected={active}
                    onClick={() => setSelected(p.theme)}
                    className={cn(
                      "cursor-pointer border-b transition-colors last:border-b-0",
                      active ? "bg-sel" : "hover:bg-muted/60",
                    )}
                  >
                    <td className="px-4 py-3 font-semibold tabular-nums text-muted-foreground">{p.rank}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(p.theme)}
                        className="text-left font-semibold hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {p.theme}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <TrendBadge trend={p.stat.trend} />
                        {isSaved(p.theme) && <span className="text-xs text-muted-foreground">Tracked</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {nf.format(p.stat.mentions)}
                      <div className="text-xs text-muted-foreground">{pct(p.frequency)} of all</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(p.negativeShare)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.avgSeverity.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                          role="img"
                          aria-label={`Priority score ${p.score.toFixed(0)} out of 100`}
                        >
                          <div className="h-full rounded-full bg-neg" style={{ width: `${p.score}%` }} />
                        </div>
                        <span className="w-8 text-right font-bold tabular-nums">{p.score.toFixed(0)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-label={`Details for ${current.theme}`}>
        <Detail p={current} top={top} result={result} saved={isSaved(current.theme)} onSave={() => saveIssue(current)} />
      </section>
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
