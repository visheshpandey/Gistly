"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { Stat } from "@/components/stat";
import { PendingNotice } from "@/components/new-data-banner";
import { useAnalysis } from "@/components/use-analysis";
import { useAnalysisRunner } from "@/components/use-analysis-runner";
import type { AnalysisMetrics } from "@/lib/analysis/metrics";
import { MAX_ANALYSED, type AnalysisResult } from "@/lib/analysis/types";

const nf = new Intl.NumberFormat("en-US");
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0%");

function SentimentBar({ m }: { m: AnalysisMetrics }) {
  const parts = [
    { key: "positive", label: "Positive", value: m.positive, className: "bg-pos" },
    { key: "neutral", label: "Neutral", value: m.neutral, className: "bg-neu" },
    { key: "negative", label: "Negative", value: m.negative, className: "bg-neg" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${pct(p.value, m.labelledMentions)}`).join(", ")}
      >
        {parts.map((p) => (
          <div key={p.key} className={p.className} style={{ width: pct(p.value, m.labelledMentions) }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${p.className}`} aria-hidden="true" />
            {p.label}: <span className="font-medium tabular-nums">{pct(p.value, m.labelledMentions)}</span>
            <span className="text-muted-foreground tabular-nums">({nf.format(p.value)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Results({ result, metrics, onRerun, busy }: { result: AnalysisResult; metrics: AnalysisMetrics; onRerun: () => void; busy: boolean }) {
  const m = metrics;
  const net = m.netSentiment;
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Summary" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{result.source === "precomputed" ? "Saved AI analysis" : "AI analysis"}</Badge>
            <p className="text-sm text-muted-foreground">
              {result.model} · {nf.format(result.analysedTexts - result.failedTexts)} of {nf.format(result.totalUnique)} unique
              reviews labelled, covering {nf.format(m.labelledMentions)} of {nf.format(m.totalMentions)} mentions
            </p>
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
            tint="a"
            label="Net sentiment"
            value={`${net > 0 ? "+" : ""}${net.toFixed(1)}`}
            note="Positive share minus negative share, in points"
          />
          <Stat tint="e" label="Positive" value={pct(m.positive, m.labelledMentions)} note={`${nf.format(m.positive)} mentions`} />
          <Stat tint="b" label="Negative" value={pct(m.negative, m.labelledMentions)} note={`${nf.format(m.negative)} mentions`} />
          <Stat
            tint="c"
            label="Critical problems"
            value={nf.format(m.critical)}
            note={`Negative mentions rated 4 or 5 out of 5 (${pct(m.critical, m.negative)} of all negative)`}
          />
        </div>
        <SentimentBar m={m} />
      </section>

      <section aria-label="Themes" className="flex flex-col gap-4">
        <div>
          <h2 className="title-bar text-2xl font-semibold">What people talk about</h2>
          <p className="text-sm text-muted-foreground">
            Themes found by the AI, by number of mentions. Problem-heavy themes list their most common issues.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {m.themes.map((t) => (
            <Card key={t.theme}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold">{t.theme}</h3>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {nf.format(t.mentions)} mentions · {(t.share * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <div
                    className="flex h-2 w-full overflow-hidden rounded-full bg-pos/30"
                    role="img"
                    aria-label={`${(t.negativeShare * 100).toFixed(0)}% negative`}
                  >
                    <div className="bg-neg" style={{ width: `${t.negativeShare * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(t.negativeShare * 100).toFixed(0)}% negative
                    {t.negative > 0 ? ` · average severity ${t.avgSeverity.toFixed(1)} of 5` : ""}
                  </p>
                </div>
                {t.topIssues.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {t.topIssues.map((i) => (
                      <li key={i.issue} className="flex justify-between gap-3">
                        <span className="first-letter:uppercase">{i.issue}</span>
                        <span className="tabular-nums text-muted-foreground">{nf.format(i.mentions)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {t.quotes.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t pt-3">
                    {t.quotes.map((q) => (
                      <p key={q.text} className="text-xs text-muted-foreground">
                        “{q.text}” <span className="tabular-nums">×{nf.format(q.mentions)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {m.byCategory && (
        <section aria-label="Sentiment by category" className="flex flex-col gap-3">
          <div>
            <h2 className="title-bar text-2xl font-semibold">Sentiment inside each category</h2>
            <p className="text-sm text-muted-foreground">
              A category is not a sentiment: every category contains both praise and complaints. Sentiment comes from
              what each review says.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="p-3">Category</th>
                  <th scope="col" className="p-3 text-right">Mentions</th>
                  <th scope="col" className="w-2/5 p-3">Sentiment</th>
                  <th scope="col" className="p-3 text-right">Negative</th>
                </tr>
              </thead>
              <tbody>
                {m.byCategory.map((c) => (
                  <tr key={c.category} className="border-b last:border-0">
                    <td className="p-3 font-medium">{c.category}</td>
                    <td className="p-3 text-right tabular-nums">{nf.format(c.mentions)}</td>
                    <td className="p-3">
                      <div
                        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${pct(c.positive, c.mentions)} positive, ${pct(c.neutral, c.mentions)} neutral, ${pct(c.negative, c.mentions)} negative`}
                      >
                        <div className="bg-pos" style={{ width: pct(c.positive, c.mentions) }} />
                        <div className="bg-neu" style={{ width: pct(c.neutral, c.mentions) }} />
                        <div className="bg-neg" style={{ width: pct(c.negative, c.mentions) }} />
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums">{pct(c.negative, c.mentions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        How this was made: the AI read the text of each unique review and labelled its sentiment, theme, severity and
        main issue. Every count and percentage above is calculated by InsightFlow from those labels and weighted by how
        many times each review was received, so the AI never writes a number. Categories were not sent to the AI.
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
          <h2 className="text-base font-medium">{result ? "Run the analysis again" : "Analyse this feedback"}</h2>
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
