"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { COLORS, CategoryStack, SentimentDonut, SeverityBars, ThemeBars, TrendLine } from "@/components/charts";
import { useAdaption } from "@/components/adaption-provider";
import { DataGate } from "@/components/data-gate";
import { SampleBanner } from "@/components/dataset-switcher";
import { useFeedbackData } from "@/components/data-provider";
import { EvidenceSheet } from "@/components/evidence-sheet";
import { KpiCards } from "@/components/kpi-cards";
import {
  Donut,
  Funnel,
  Gauge,
  Heatmap,
  MeterBar,
  MiniHistogram,
  PriorityMatrix,
  SentimentBar,
  Sparkline,
  type MatrixPoint,
} from "@/components/mini-viz";
import { NativeSelect } from "@/components/native-select";
import { NewDataBanner } from "@/components/new-data-banner";
import { Stat } from "@/components/stat";
import { useAnalysis } from "@/components/use-analysis";
import { NO_FILTERS, filterRows, filtersActive, trendSeries, type Filters, type TrendPoint } from "@/lib/analysis/filters";
import { computeMetrics, type AnalysisMetrics } from "@/lib/analysis/metrics";
import { rankPriorities, type PriorityItem } from "@/lib/analysis/priority";
import { KINDS, type AnalysisResult, type Kind, type Sentiment } from "@/lib/analysis/types";
import type { FeedbackRow } from "@/lib/feedback-types";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0%");
const MAX_CATEGORY_CHIPS = 8; // more categories than this get a dropdown instead of chips

function ChartCard({
  question,
  note,
  children,
  className,
}: {
  question: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col gap-4">
        <div>
          <h2 className="title-bar text-xl font-semibold">{question}</h2>
          {note && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{note}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// One pill button in a filter group. Pressed means "only show this".
function Chip({
  pressed,
  onClick,
  dot,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border-[1.5px] px-3 py-1 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed
          ? "border-edge bg-hl font-bold text-[#1c1b2e]"
          : "border-edge bg-card text-foreground hover:bg-muted",
      )}
    >
      {dot && (
        <span
          className={cn("size-2 rounded-full", pressed && "ring-2 ring-[#1c1b2e]")}
          style={{ background: dot }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

const KIND_COLOR: Record<Kind, string> = {
  complaint: "var(--neg)",
  praise: "var(--pos)",
  suggestion: "var(--p2)",
  question: "var(--p3)",
};
// Severity 1 (minor) to 5 (severe): sand, mustard, rose, red, ink. Same order as the severity chart.
const SEVERITY_SCALE = ["var(--neu)", "var(--p3)", "var(--p4)", "var(--neg)", "var(--p1)"];
const MAX_HEAT_ROWS = 8;
const MAX_HEAT_COLS = 10;

// Negative share for every theme inside every category, from the same filtered rows as the rest of the page.
function buildHeat(
  rows: FeedbackRow[],
  result: AnalysisResult | null,
  metrics: AnalysisMetrics | null,
  categories: string[],
) {
  if (!result || !metrics || categories.length < 2) return null;
  const labelOf = new Map(result.labels.map((l) => [l.id, l]));
  const grid = new Map<string, { mentions: number; negative: number }>();
  for (const r of rows) {
    const l = labelOf.get(r.id);
    if (!l || !r.category) continue;
    const key = `${l.theme}\u0000${r.category}`;
    const g = grid.get(key) ?? { mentions: 0, negative: 0 };
    g.mentions += r.occurrences;
    if (l.sentiment === "negative") g.negative += r.occurrences;
    grid.set(key, g);
  }
  return {
    rows: metrics.themes.slice(0, MAX_HEAT_ROWS).map((t) => t.theme),
    cols: categories.slice(0, MAX_HEAT_COLS),
    cell: (theme: string, category: string) => {
      const g = grid.get(`${theme}\u0000${category}`);
      return g ? { mentions: g.mentions, negativeShare: g.mentions > 0 ? g.negative / g.mentions : 0 } : null;
    },
  };
}

type Tone = "bad" | "good" | "info";
const TONE_CLASS: Record<Tone, string> = {
  bad: "bg-neg text-on-neg",
  good: "bg-pos-bg text-foreground",
  info: "border border-edge bg-muted text-muted-foreground",
};
type Takeaway = { tone: Tone; tag: string; text: React.ReactNode; theme?: string; visual?: React.ReactNode };

// Compares the first and last third of the dated feedback. Only used when the data has real dates.
function trendTakeaway(points: TrendPoint[]): Takeaway | null {
  if (points.length < 6) return null;
  const third = Math.floor(points.length / 3);
  const avg = (p: TrendPoint[]) => (p.reduce((s, x) => s + x.negativeShare, 0) / p.length) * 100;
  const early = avg(points.slice(0, third));
  const late = avg(points.slice(-third));
  const change = late - early;
  const spark = <Sparkline values={points.map((p) => p.negativeShare)} label="Negative share over time" />;
  if (Math.abs(change) < 3) {
    return { tone: "info", tag: "Steady", text: <>Negative share steady around {late.toFixed(0)}%.</>, visual: spark };
  }
  return change > 0
    ? { tone: "bad", tag: "Rising", text: <>Negative share up from {early.toFixed(0)}% to {late.toFixed(0)}%.</>, visual: spark }
    : { tone: "good", tag: "Improving", text: <>Negative share down from {early.toFixed(0)}% to {late.toFixed(0)}%.</>, visual: spark };
}

// The short version of the dashboard, written from the numbers. No AI writes these sentences.
function buildTakeaways(m: AnalysisMetrics, priorities: PriorityItem[], trend: TrendPoint[]): Takeaway[] {
  const out: Takeaway[] = [];
  const net = m.netSentiment;
  out.push({
    tone: net >= 0 ? "good" : "info",
    tag: "Overall",
    text: (
      <>
        <b className="font-semibold">{pct(m.positive, m.labelledMentions)}</b> positive,{" "}
        <b className="font-semibold">{pct(m.negative, m.labelledMentions)}</b> negative.
      </>
    ),
    visual: <SentimentBar positive={m.positive} neutral={m.neutral} negative={m.negative} />,
  });

  const top = priorities[0];
  if (top) {
    out.push({
      tone: "bad",
      tag: "Fix first",
      theme: top.theme,
      text: (
        <>
          <b className="font-semibold">{top.theme}</b>: {(top.negativeShare * 100).toFixed(0)}% negative,{" "}
          {nf.format(top.stat.negative)} complaints.
        </>
      ),
      visual: <MeterBar value={top.negativeShare} label={`${(top.negativeShare * 100).toFixed(0)}% negative`} />,
    });
  }

  // The most serious problem that has real volume (at least 2% of complaints), if it is not already the top one.
  const risk = priorities
    .filter((p) => p.stat.negative >= m.negative * 0.02)
    .sort((a, b) => b.avgSeverity - a.avgSeverity)[0];
  if (risk && top && risk.theme !== top.theme && risk.avgSeverity >= 3.5) {
    out.push({
      tone: "bad",
      tag: "Highest risk",
      theme: risk.theme,
      text: (
        <>
          <b className="font-semibold">{risk.theme}</b>: most serious complaints, severity {risk.avgSeverity.toFixed(1)} of 5.
        </>
      ),
      visual: <MeterBar value={risk.avgSeverity / 5} color="var(--p1)" label={`Severity ${risk.avgSeverity.toFixed(1)} of 5`} />,
    });
  }

  const area = (m.byCategory ?? [])
    .filter((c) => c.mentions >= m.labelledMentions * 0.05)
    .map((c) => ({ ...c, share: c.mentions > 0 ? c.negative / c.mentions : 0 }))
    .sort((a, b) => b.share - a.share)[0];
  if (area && (m.byCategory?.length ?? 0) > 1) {
    out.push({
      tone: "info",
      tag: "Hot spot",
      text: (
        <>
          <b className="font-semibold">{area.category}</b>: the most negative category, {(area.share * 100).toFixed(0)}%.
        </>
      ),
      visual: <SentimentBar positive={area.positive} neutral={area.neutral} negative={area.negative} />,
    });
  }

  const strength = [...m.themes].filter((t) => t.positive > 0).sort((a, b) => b.positive - a.positive)[0];
  if (strength) {
    out.push({
      tone: "good",
      tag: "Strength",
      theme: strength.theme,
      text: (
        <>
          <b className="font-semibold">{strength.theme}</b>: most praised, {nf.format(strength.positive)} positive mentions.
        </>
      ),
      visual: (
        <MeterBar value={strength.positiveShare} color="var(--pos)" label={`${(strength.positiveShare * 100).toFixed(0)}% positive`} />
      ),
    });
  }

  const t = trendTakeaway(trend);
  if (t) out.push(t);
  return out;
}

function Dashboard() {
  const { rows, summary, label, stats } = useFeedbackData();
  const { result, loaded } = useAnalysis();
  const { report: adaption } = useAdaption();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [evidence, setEvidence] = useState<string | null>(null);

  const filtered = useMemo(() => (result ? filterRows(rows, result, filters) : rows), [rows, result, filters]);
  const metrics = useMemo(() => (result ? computeMetrics(filtered, result) : null), [filtered, result]);
  const priorities = useMemo(() => (metrics ? rankPriorities(metrics) : []), [metrics]);
  const trend = useMemo(() => (result && summary.hasDates ? trendSeries(filtered, result) : []), [filtered, result, summary.hasDates]);
  const takeaways = useMemo(() => (metrics ? buildTakeaways(metrics, priorities, trend) : []), [metrics, priorities, trend]);
  const matrixPoints = useMemo<MatrixPoint[]>(
    () => priorities.map((p) => ({ name: p.theme, x: p.frequency, y: p.negativeShare, size: p.severity, rank: p.rank })),
    [priorities],
  );
  const heat = useMemo(() => buildHeat(filtered, result, metrics, summary.hasCategory ? summary.categories : []), [filtered, result, metrics, summary]);
  const kindItems = useMemo(
    () =>
      metrics
        ? KINDS.map((k) => ({ name: k, value: metrics.kinds[k], color: KIND_COLOR[k] })).filter((k) => k.value > 0)
        : [],
    [metrics],
  );

  if (!loaded && !result) {
    return <p role="status" className="text-sm text-muted-foreground">Loading your analysis...</p>;
  }

  // Without an AI analysis there is nothing to chart yet. Show what we know and point to the next step.
  if (!result || !metrics) {
    return (
      <div className="flex flex-col gap-6">
        <SampleBanner />
        <p className="text-sm text-muted-foreground">
          Dataset: <span className="font-medium text-foreground">{label}</span>
        </p>
        <KpiCards summary={summary} analysis={null} />
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <h2 className="text-base font-semibold">Run the AI analysis to see charts and priorities</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              The AI reads your reviews and labels their sentiment, theme and severity. Then this page shows sentiment,
              the biggest problems, trends and what to fix first.
            </p>
            <Link href="/analysis" className={buttonVariants()}>
              Go to AI Analysis
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const active = filtersActive(filters);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const net = metrics.netSentiment;
  const empty = filtered.length === 0;
  const topScore = priorities[0]?.score ?? 100;
  const categoryChips = summary.hasCategory && summary.categories.length <= MAX_CATEGORY_CHIPS;
  const SENTIMENTS: { value: Sentiment; label: string }[] = [
    { value: "positive", label: "Positive" },
    { value: "neutral", label: "Neutral" },
    { value: "negative", label: "Negative" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SampleBanner />
      <NewDataBanner />

      <section aria-label="Filters" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sentiment">
            <span className="w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sentiment</span>
            <Chip pressed={filters.sentiment === "all"} onClick={() => setFilter("sentiment", "all")}>
              All
            </Chip>
            {SENTIMENTS.map((s) => (
              <Chip
                key={s.value}
                pressed={filters.sentiment === s.value}
                dot={COLORS[s.value]}
                onClick={() => setFilter("sentiment", filters.sentiment === s.value ? "all" : s.value)}
              >
                {s.label}
              </Chip>
            ))}
          </div>
          {categoryChips && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category">
              <span className="w-20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</span>
              <Chip pressed={filters.category === "all"} onClick={() => setFilter("category", "all")}>
                All
              </Chip>
              {summary.categories.map((c) => (
                <Chip
                  key={c}
                  pressed={filters.category === c}
                  onClick={() => setFilter("category", filters.category === c ? "all" : c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {summary.hasCategory && !categoryChips && (
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <label htmlFor="f-category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
              <NativeSelect id="f-category" value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
                <option value="all">All categories</option>
                {summary.categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor="f-theme" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</label>
            <NativeSelect id="f-theme" value={filters.theme} onChange={(e) => setFilter("theme", e.target.value)}>
              <option value="all">All themes</option>
              {[...result.themes, "Other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
          {summary.hasDates && (
            <>
              <div className="flex min-w-36 flex-col gap-1.5">
                <label htmlFor="f-from" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
                <Input id="f-from" type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
              </div>
              <div className="flex min-w-36 flex-col gap-1.5">
                <label htmlFor="f-to" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                <Input id="f-to" type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
              </div>
            </>
          )}
          <Button variant="outline" onClick={() => setFilters(NO_FILTERS)} disabled={!active}>
            Reset filters
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing {nf.format(metrics.labelledMentions)} of {nf.format(summary.total)} mentions · {label}
          {result.source === "precomputed" ? " · saved AI analysis" : " · AI analysis"}
        </p>
      </section>

      {empty ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No feedback matches these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try removing a filter.</p>
          <Button className="mt-4" variant="outline" onClick={() => setFilters(NO_FILTERS)}>
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <section aria-label="Key numbers" className="kpi-strip">
            <Stat
              label="Total feedback"
              value={nf.format(metrics.labelledMentions)}
              note={active ? `of ${nf.format(summary.total)} in all data` : "All mentions, repeats included"}
              visual={
                <MeterBar
                  value={metrics.labelledMentions / Math.max(1, summary.total)}
                  color="var(--p1)"
                  label={`${pct(metrics.labelledMentions, summary.total)} of all feedback in view`}
                />
              }
            />
            <Stat
              label="Unique reviews"
              value={nf.format(filtered.length)}
              note={`${(metrics.labelledMentions / Math.max(1, filtered.length)).toFixed(1)}× repeats on average`}
              visual={
                <MeterBar
                  value={filtered.length / Math.max(1, metrics.labelledMentions)}
                  color="var(--p2)"
                  label={`${pct(filtered.length, metrics.labelledMentions)} of mentions are unique texts`}
                />
              }
            />
            <Stat
              label="Net sentiment"
              value={`${net > 0 ? "+" : ""}${net.toFixed(1)}`}
              note="Positive share minus negative share"
              visual={<SentimentBar positive={metrics.positive} neutral={metrics.neutral} negative={metrics.negative} />}
            />
            <Stat
              label="Negative share"
              value={pct(metrics.negative, metrics.labelledMentions)}
              note={`${nf.format(metrics.negative)} mentions`}
              visual={
                <MeterBar
                  value={metrics.negative / Math.max(1, metrics.labelledMentions)}
                  label={`${pct(metrics.negative, metrics.labelledMentions)} negative`}
                />
              }
            />
            <Stat
              label="Critical problems"
              value={nf.format(metrics.critical)}
              note="Negative, severity 4 or 5"
              visual={
                <MiniHistogram
                  values={metrics.severity}
                  colors={SEVERITY_SCALE}
                  label={`Negative mentions by severity 1 to 5: ${metrics.severity.map((v) => nf.format(v)).join(", ")}`}
                />
              }
            />
          </section>

          <section aria-label="Summary" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <ChartCard question="Key takeaways" note="The short version for the current filters." className="lg:col-span-3">
              <ul className="flex flex-col gap-2">
                {takeaways.map((t) => (
                  <li key={t.tag} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2.5">
                    <span
                      className={cn(
                        "w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-[0.6875rem] font-bold uppercase tracking-wide",
                        TONE_CLASS[t.tone],
                      )}
                    >
                      {t.tag}
                    </span>
                    <span className="min-w-[12rem] flex-1 text-sm leading-snug">{t.text}</span>
                    {t.visual && <span className="w-full sm:w-36">{t.visual}</span>}
                    {t.theme && (
                      <button
                        type="button"
                        onClick={() => setEvidence(t.theme ?? null)}
                        className="shrink-0 text-xs font-semibold text-brand underline-offset-4 hover:underline"
                      >
                        Examples
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </ChartCard>

            <ChartCard question="Fix these first" note="Priority score: volume × negative share × severity." className="lg:col-span-2">
              {priorities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No problems in this selection.</p>
              ) : (
                <ol className="flex flex-col gap-1">
                  {priorities.slice(0, 5).map((p) => (
                    <li key={p.theme}>
                      <button
                        type="button"
                        onClick={() => setEvidence(p.theme)}
                        className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                        aria-label={`${p.theme}, rank ${p.rank}, priority ${p.score.toFixed(0)} of 100. Show examples.`}
                      >
                        <span className="row-span-2 flex size-7 items-center justify-center rounded-full border-[1.5px] border-edge bg-card text-xs font-bold tabular-nums">
                          {p.rank}
                        </span>
                        <span className="truncate text-sm font-semibold">{p.theme}</span>
                        <span className="text-right text-sm font-bold tabular-nums">{p.score.toFixed(0)}</span>
                        <span className="col-span-2 flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${(p.score / Math.max(1, topScore)) * 100}%`, background: COLORS.negative }}
                            />
                          </span>
                          <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                            {nf.format(p.stat.negative)} neg.
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <Link href="/recommendations" className={cn(buttonVariants({ variant: "outline" }), "mt-auto self-start")}>
                See recommendations
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </ChartCard>
          </section>

          {priorities.length > 0 && (
            <ChartCard
              question="Where should we focus?"
              note="Each bubble is a theme: further right means more feedback, higher means more negative, bigger means more severe. Click a bubble for examples."
            >
              <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)]">
                <PriorityMatrix points={matrixPoints} onSelect={setEvidence} />
                <div className="flex flex-col gap-4 text-sm">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">How to read it</p>
                  <ul className="flex flex-col gap-2.5">
                    <li className="flex items-center gap-2.5">
                      <span className="size-4 shrink-0 rounded-full border-[1.5px] border-edge bg-neg" aria-hidden="true" />
                      Top 3 priorities
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="size-4 shrink-0 rounded-full border-[1.5px] border-edge bg-p2" aria-hidden="true" />
                      Other problems
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="flex shrink-0 items-end gap-0.5" aria-hidden="true">
                        <span className="size-2.5 rounded-full border border-edge bg-muted" />
                        <span className="size-4 rounded-full border border-edge bg-muted" />
                      </span>
                      Bigger bubble: more severe complaints
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-4 w-6 shrink-0 rounded-sm bg-neg/15" aria-hidden="true" />
                      Shaded corner: lots of feedback and mostly negative, fix these first
                    </li>
                  </ul>
                </div>
              </div>
            </ChartCard>
          )}

          <section aria-label="Charts" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard question="How do customers feel?" note="Share of all mentions">
              <SentimentDonut m={metrics} />
            </ChartCard>
            <ChartCard question="What are customers complaining about most?" note="Negative mentions by theme. Click a bar for examples.">
              <ThemeBars m={metrics} onSelect={setEvidence} />
            </ChartCard>
            {heat && (
              <ChartCard
                question="Where does it hurt?"
                note="Each theme inside each category. Click a theme for examples."
                className="lg:col-span-2"
              >
                <Heatmap rows={heat.rows} cols={heat.cols} cell={heat.cell} onSelectRow={setEvidence} />
              </ChartCard>
            )}
            {metrics.byCategory && (
              <ChartCard question="Which area hurts most?" note="Sentiment inside each category">
                <CategoryStack m={metrics} />
              </ChartCard>
            )}
            <ChartCard question="How serious are the problems?" note="Negative mentions by severity, from 1 (minor) to 5 (severe)">
              <SeverityBars m={metrics} />
            </ChartCard>
            <ChartCard question="What kind of feedback is it?" note="Each review labelled as a complaint, praise, suggestion or question">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                <Donut items={kindItems} center={nf.format(metrics.labelledMentions)} sub="mentions" />
                <ul className="flex min-w-40 flex-1 flex-col gap-3">
                  {kindItems.map((k) => (
                    <li key={k.name} className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="size-3 shrink-0 rounded-full" style={{ background: k.color }} aria-hidden="true" />
                        <span className="flex-1 capitalize">{k.name}</span>
                        <span className="font-semibold tabular-nums">{pct(k.value, metrics.labelledMentions)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
            <ChartCard question="Is it getting better or worse?" note={trend.length > 1 ? "Negative share over time" : undefined}>
              {trend.length > 1 ? (
                <TrendLine points={trend} />
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  {summary.hasDates
                    ? "Not enough dates in this selection to show a trend."
                    : "This data has no date column, so there is no trend to show. Upload a file with dates to see how sentiment changes over time."}
                </p>
              )}
            </ChartCard>
            <ChartCard question="How reliable is this data?" note="From the rows in your file to the reviews the AI labelled" className="lg:col-span-2">
              <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center">
                <Funnel
                  steps={[
                    { label: "Rows read", value: stats?.rowsRead ?? result.totalMentions },
                    { label: "Unique reviews after merging repeats", value: result.totalUnique },
                    { label: "Labelled by the AI", value: result.labels.length },
                  ]}
                />
                <div className="flex flex-wrap justify-center gap-6">
                  {stats && (
                    <Gauge
                      value={stats.after.score / 10}
                      display={`${stats.after.grade} · ${stats.after.score.toFixed(1)}`}
                      caption="Instant quality (our check, out of 10)"
                    />
                  )}
                  {adaption?.quality?.scoreAfter != null && (
                    <Gauge
                      value={adaption.quality.scoreAfter / 10}
                      display={`${adaption.quality.gradeAfter ?? ""} · ${adaption.quality.scoreAfter.toFixed(1)}`}
                      caption="Verified by Adaption (out of 10)"
                      color="var(--p2)"
                    />
                  )}
                </div>
              </div>
              {(result.failedTexts > 0 || (stats && stats.emptyRows + stats.junkRows > 0)) && (
                <p className="text-xs text-muted-foreground">
                  {stats && stats.emptyRows + stats.junkRows > 0
                    ? `${nf.format(stats.emptyRows + stats.junkRows)} empty or symbol-only rows were ignored. `
                    : ""}
                  {result.failedTexts > 0 ? `${nf.format(result.failedTexts)} reviews could not be labelled.` : ""}
                </p>
              )}
              <div className="mt-auto">
                <Link href="/adaption" className={buttonVariants({ variant: "outline" })}>Data quality details</Link>
              </div>
            </ChartCard>
          </section>
        </>
      )}

      <EvidenceSheet theme={evidence} rows={filtered} result={result} onClose={() => setEvidence(null)} />
    </div>
  );
}

function ForDataset() {
  const { uid } = useFeedbackData();
  // Filters start fresh for every dataset.
  return <Dashboard key={uid} />;
}

export function DashboardView() {
  return (
    <DataGate>
      <ForDataset />
    </DataGate>
  );
}
