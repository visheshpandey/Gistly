"use client";

// AI Analysis page: run or re-run the analysis, then themes, sentiment and categories.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataGate } from "@/components/shared/data-gate";
import { useFeedbackData } from "@/providers/data-provider";
import { Stat } from "@/components/shared/stat";
import { MeterBar, MiniHistogram, SentimentBar } from "@/components/charts/mini-viz";
import { SEVERITY_SCALE } from "@/components/charts/palette";
import { PendingNotice } from "@/components/shared/new-data-banner";
import { useAnalysis } from "@/providers/analysis-provider";
import { useAnalysisRunner } from "@/providers/use-analysis-runner";
import type { AnalysisMetrics, ThemeStat } from "@/lib/analysis/metrics";
import { MAX_ANALYSED, type AnalysisResult } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0%");
const whole = (share: number) => `${Math.round(share * 100)}%`;

const neutralOf = (t: ThemeStat) => Math.max(0, t.mentions - t.positive - t.negative);

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

// One row of a "points" list: the text, its count, and a bar sized against the biggest in the list.
function PointBars({ items, color }: { items: { issue: string; mentions: number }[]; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.mentions));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.issue} className="flex flex-col gap-1">
          <span className="flex justify-between gap-3 text-sm">
            <span className="first-letter:uppercase">{i.issue}</span>
            <span className="tabular-nums text-muted-foreground">{nf.format(i.mentions)}</span>
          </span>
          <MeterBar value={i.mentions / max} color={color} className="h-2" label={`${i.issue}: ${nf.format(i.mentions)} mentions`} />
        </li>
      ))}
    </ul>
  );
}

// Everything about the selected theme: its numbers, what goes wrong, what people like, and what they actually wrote.
function ThemeDetail({ t }: { t: ThemeStat }) {
  const facts = [
    { label: "Mentions", value: `${nf.format(t.mentions)} · ${whole(t.share)}` },
    { label: "Positive", value: whole(t.positiveShare) },
    { label: "Negative", value: whole(t.negativeShare) },
    ...(t.negative > 0 ? [{ label: "Severity", value: `${t.avgSeverity.toFixed(1)} / 5` }] : []),
  ];
  return (
    <div className="flex flex-col gap-5 p-5 md:p-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-2xl font-semibold">{t.theme}</h3>
        <dl className="flex flex-wrap gap-2">
          {facts.map((f) => (
            <div key={f.label} className="rounded-md border-[1.5px] border-edge bg-card px-3 py-1.5">
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</dt>
              <dd className="num-display text-lg tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
        <SentimentBar positive={t.positive} neutral={neutralOf(t)} negative={t.negative} className="h-3.5" />
      </div>

      {(t.topIssues.length > 0 || t.topStrengths.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {t.topIssues.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Main problems</Label>
              <PointBars items={t.topIssues} color="var(--neg)" />
            </div>
          )}
          {t.topStrengths.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>What customers like</Label>
              <PointBars items={t.topStrengths} color="var(--pos)" />
            </div>
          )}
        </div>
      )}

      {t.quotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>What customers wrote</Label>
          <ul className="flex flex-col gap-2">
            {t.quotes.map((q) => (
              <li key={q.text} className="flex items-baseline gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{nf.format(q.mentions)}×</span>
                <span>“{q.text}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Results({ result, metrics, onRerun, busy }: { result: AnalysisResult; metrics: AnalysisMetrics; onRerun: () => void; busy: boolean }) {
  const m = metrics;
  const net = m.netSentiment;
  const [selected, setSelected] = useState<string | null>(null);
  const current = m.themes.find((t) => t.theme === selected) ?? m.themes[0];
  const maxMentions = Math.max(1, ...m.themes.map((t) => t.mentions));
  const labelled = result.analysedTexts - result.failedTexts;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Summary" className="flex flex-col gap-4">
        {/* What this analysis is, in one line */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-[1.5px] border-edge bg-card px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Badge>{result.source === "precomputed" ? "Saved AI analysis" : "AI analysis"}</Badge>
            <span>
              <b className="font-semibold tabular-nums">{nf.format(labelled)}</b>
              <span className="text-muted-foreground"> of {nf.format(result.totalUnique)} unique reviews labelled</span>
            </span>
          </div>
          <Button variant="outline" onClick={onRerun} disabled={busy}>
            Run again
          </Button>
        </div>

        {result.truncated && (
          <p role="alert" className="notice p-3 text-sm">
            This dataset has more unique reviews than one analysis covers. The {nf.format(MAX_ANALYSED)} most frequent were
            analysed.
          </p>
        )}
        {result.failedTexts > 0 && (
          <p role="alert" className="notice p-3 text-sm">
            {nf.format(result.failedTexts)} reviews could not be labelled and are left out of these numbers. Run again to
            retry them.
          </p>
        )}

        <div className="kpi-strip">
          <Stat
            label="Net sentiment"
            value={`${net > 0 ? "+" : ""}${net.toFixed(1)}`}
            note="Positive minus negative, in points"
            visual={<SentimentBar positive={m.positive} neutral={m.neutral} negative={m.negative} />}
          />
          <Stat
            label="Positive"
            value={pct(m.positive, m.labelledMentions)}
            note={`${nf.format(m.positive)} mentions`}
            visual={<MeterBar value={m.positive / Math.max(1, m.labelledMentions)} color="var(--pos)" label={`${pct(m.positive, m.labelledMentions)} positive`} />}
          />
          <Stat
            label="Negative"
            value={pct(m.negative, m.labelledMentions)}
            note={`${nf.format(m.negative)} mentions`}
            visual={<MeterBar value={m.negative / Math.max(1, m.labelledMentions)} label={`${pct(m.negative, m.labelledMentions)} negative`} />}
          />
          <Stat
            label="Critical problems"
            value={nf.format(m.critical)}
            note={`Severity 4 or 5 · ${pct(m.critical, m.negative)} of negative`}
            visual={
              <MiniHistogram
                values={m.severity}
                colors={SEVERITY_SCALE}
                label={`Negative mentions by severity 1 to 5: ${m.severity.map((v) => nf.format(v)).join(", ")}`}
              />
            }
          />
        </div>
      </section>

      <section aria-label="Themes" className="flex flex-col gap-4">
        <div>
          <h2 className="title-bar text-2xl font-semibold">What people talk about</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a theme to see its problems, what customers like, and real quotes. Bar length shows how much it is talked
            about; colours show the sentiment.
          </p>
        </div>

        <Card className="gap-0 py-0">
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ol className="flex flex-col gap-1 p-3 md:p-4" aria-label="Themes">
              {m.themes.map((t, i) => {
                const active = t.theme === current?.theme;
                return (
                  <li key={t.theme}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setSelected(t.theme);
                        // On narrow screens the details sit below the list, so bring them into view.
                        if (window.innerWidth < 1024) {
                          document.getElementById("theme-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1.5 rounded-lg border-[1.5px] px-3 py-2.5 text-left transition-colors",
                        active ? "border-edge bg-sel" : "border-transparent hover:bg-muted/70",
                      )}
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{t.theme}</span>
                        <span className="shrink-0 text-sm tabular-nums">
                          {nf.format(t.mentions)} <span className="text-muted-foreground">· {whole(t.share)}</span>
                        </span>
                      </span>
                      {/* One bar for two facts: its length is the theme's size, its colours are the sentiment split. */}
                      <span className="flex items-center gap-3 pl-8">
                        <span className="flex-1">
                          <span className="block" style={{ width: `${Math.max(6, (t.mentions / maxMentions) * 100)}%` }}>
                            <SentimentBar positive={t.positive} neutral={neutralOf(t)} negative={t.negative} className="h-2.5" />
                          </span>
                        </span>
                        <span className={cn("w-16 shrink-0 text-right text-xs font-semibold tabular-nums", t.negativeShare > 0.5 ? "text-neg" : "text-muted-foreground")}>
                          {whole(t.negativeShare)} neg.
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div id="theme-detail" className="scroll-mt-16 border-t-[1.5px] border-edge lg:border-t-0 lg:border-l-[1.5px]" aria-live="polite">
              {current ? <ThemeDetail t={current} /> : <p className="p-6 text-sm text-muted-foreground">No themes found.</p>}
            </div>
          </div>
        </Card>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-pos" />Positive</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-neu" />Neutral</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-neg" />Negative</li>
        </ul>
      </section>

      {m.byCategory && (
        <section aria-label="Sentiment by category" className="flex flex-col gap-4">
          <div>
            <h2 className="title-bar text-2xl font-semibold">Sentiment inside each category</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A category is not a sentiment: every category has praise and complaints. Sentiment comes from what each review
              says.
            </p>
          </div>
          <Card className="gap-0 py-0">
            <ul className="divide-y">
              {m.byCategory.map((c) => (
                <li key={c.category} className="grid items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5.5rem]">
                  <span className="flex items-baseline justify-between gap-2 sm:block">
                    <span className="font-semibold">{c.category}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{nf.format(c.mentions)} mentions</span>
                  </span>
                  <SentimentBar positive={c.positive} neutral={c.neutral} negative={c.negative} className="h-3.5" />
                  <span className={cn("text-sm font-semibold tabular-nums sm:text-right", c.negative / Math.max(1, c.mentions) > 0.5 && "text-neg")}>
                    {pct(c.negative, c.mentions)} neg.
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <p className="notice p-3 text-xs leading-relaxed text-muted-foreground">
        How this was made: the AI read the text of each unique review and labelled its sentiment, theme, severity and main
        issue. Every count and percentage is calculated by Verdict from those labels and weighted by how many times each
        review was received, so the AI never writes a number. Categories were not sent to the AI.
      </p>
    </div>
  );
}

function Panel() {
  const { rows } = useFeedbackData();
  const { result, metrics, loaded, pending } = useAnalysis();
  const { run, elapsed, running, start, cancel } = useAnalysisRunner();

  const progress = run.phase === "running" ? run.progress : null;
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;
  const incremental = run.phase === "running" && run.mode === "incremental";

  const runCard = (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">{result ? "Run the analysis again" : "Analyse this feedback"}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            An AI reads each unique review and labels its sentiment, theme, severity and main issue. For{" "}
            {nf.format(rows.length)} unique reviews this usually takes under a minute.
            {result ? " A full run also looks for themes again. To add only new feedback, use the notice above." : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The text of your reviews is sent to Google Gemini. Categories and dates are not sent.
            {rows.length > MAX_ANALYSED ? ` Only the ${nf.format(MAX_ANALYSED)} most frequent reviews are analysed.` : ""}
          </p>
        </div>

        {!running && (
          <div>
            <Button onClick={() => void start("full")}>{result ? "Run full analysis again" : "Run analysis"}</Button>
          </div>
        )}

        {running && !incremental && (
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Analysis progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent ?? undefined}
            >
              <div
                className={percent === null || progress?.phase !== "labelling" ? "h-full w-1/3 animate-pulse bg-primary" : "h-full bg-primary transition-all"}
                style={percent === null || progress?.phase !== "labelling" ? undefined : { width: `${percent}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {progress?.phase === "labelling"
                ? `Labelled ${nf.format(progress.done)} of ${nf.format(progress.total)} reviews`
                : progress?.phase === "actions"
                  ? "Writing recommended actions"
                  : "Finding the main themes"}{" "}
              · {elapsed}s
            </p>
            <div>
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {run.phase === "error" && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              {run.code === "not_configured" ? "AI analysis is not set up" : "The analysis could not finish"}
            </p>
            <p className="mt-1 text-muted-foreground">{run.message}</p>
            {result && <p className="mt-1 text-muted-foreground">The previous analysis is still shown above.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!loaded && !result) {
    return <p role="status" className="text-sm text-muted-foreground">Checking for a saved analysis...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {result && (pending.length > 0 || incremental) && (
        <PendingNotice
          count={pending.length}
          run={run}
          elapsed={elapsed}
          onAnalyse={() => void start("incremental")}
          onCancel={cancel}
        />
      )}
      {result && metrics && <Results result={result} metrics={metrics} onRerun={() => void start("full")} busy={running} />}
      {(running || run.phase === "error" || !result) && runCard}
    </div>
  );
}
export function AnalysisPanel() {
  return (
    <DataGate>
      <Panel />
    </DataGate>
  );
}
