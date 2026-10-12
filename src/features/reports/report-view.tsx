// The report itself: one snapshot of the numbers, used live, saved, shared and printed.
import { Donut, MeterBar, PriorityMatrix } from "@/components/charts/mini-viz";
import { Stat } from "@/components/shared/stat";
import { STATUS_LABEL, type IssueStatus } from "@/lib/issues/types";
import type { ReportData } from "@/lib/report/types";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

const STATUS_PILL: Record<IssueStatus, string> = {
  open: "bg-neg text-on-neg",
  in_progress: "bg-sel text-foreground",
  resolved: "bg-pos-bg text-foreground",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="title-bar text-2xl font-semibold">{children}</h2>;
}

// A business-friendly report. It only reads the data it is given, so it looks the same live, saved, shared or printed.
// print-color-adjust keeps the coloured cards and bars when it is printed to PDF.
export function ReportView({ data }: { data: ReportData }) {
  const k = data.kpis;
  const date = new Date(data.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const top = data.priorities[0];
  const strength = data.strengths[0];
  const tracked = data.issues.length;
  const resolved = data.issues.filter((i) => i.status === "resolved").length;

  return (
    <article className="flex flex-col gap-10 [print-color-adjust:exact]" aria-label={data.title}>
      <header className="flex flex-col gap-4 border-b-[1.5px] border-edge pb-6">
        <div className="flex items-baseline gap-2 text-sm font-semibold text-muted-foreground">
          <span className="wordmark text-xl text-foreground">Verdict</span>
          report
        </div>
        <h1 className="text-3xl font-bold md:text-4xl">{data.title}</h1>
        <p className="text-sm text-muted-foreground">
          Prepared {date} · Dataset: {data.datasetLabel} · Analysed with AI
        </p>
      </header>

      <section aria-label="Key takeaways" className="flex flex-col gap-4 rounded-xl bg-tint-a p-5 break-inside-avoid">
        <SectionTitle>Key takeaways</SectionTitle>
        <ul className="flex flex-col gap-2 text-[0.9375rem] leading-relaxed">
          <li>
            <span className="font-semibold">Overall:</span> {nf.format(k.totalMentions)} pieces of feedback, {pct(k.positive)}{" "}
            positive and {pct(k.negative)} negative.
          </li>
          {top && (
            <li>
              <span className="font-semibold">Fix first:</span> {top.theme}. {nf.format(top.mentions)} mentions,{" "}
              {pct(top.negativeShare)} negative, severity {top.avgSeverity.toFixed(1)} of 5.
            </li>
          )}
          {strength && (
            <li>
              <span className="font-semibold">Doing well:</span> {strength.theme}, {pct(strength.positiveShare)} positive.
            </li>
          )}
          {tracked > 0 && (
            <li>
              <span className="font-semibold">Tracking:</span> {tracked} {tracked === 1 ? "issue" : "issues"}, {resolved} resolved.
            </li>
          )}
        </ul>
        {data.summary && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{data.summary}</p>}
      </section>

      <section aria-label="Summary" className="flex flex-col gap-4">
        <SectionTitle>The numbers</SectionTitle>
        <div className="kpi-strip">
          <Stat tint="a" label="Feedback" value={nf.format(k.totalMentions)} note={`${nf.format(k.uniqueReviews)} unique reviews`} />
          <Stat tint="e" label="Positive" value={pct(k.positive)} note="of all feedback" />
          <Stat tint="b" label="Negative" value={pct(k.negative)} note="of all feedback" />
          <Stat tint="d" label="Net sentiment" value={`${k.netSentiment > 0 ? "+" : ""}${k.netSentiment.toFixed(1)}`} note="Positive minus negative" />
          <Stat tint="c" label="Serious problems" value={nf.format(k.critical)} note="Negative, rated 4 or 5 of 5" />
        </div>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4 break-inside-avoid">
          <Donut
            items={[
              { name: "Positive", value: k.positive, color: "var(--pos)" },
              { name: "Neutral", value: k.neutral, color: "var(--neu)" },
              { name: "Negative", value: k.negative, color: "var(--neg)" },
            ]}
            center={nf.format(k.totalMentions)}
            sub="mentions"
            size={170}
          />
          <ul className="flex min-w-48 flex-1 flex-col gap-3 text-sm">
            {[
              { name: "Positive", value: k.positive, color: "var(--pos)" },
              { name: "Neutral", value: k.neutral, color: "var(--neu)" },
              { name: "Negative", value: k.negative, color: "var(--neg)" },
            ].map((s) => (
              <li key={s.name} className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className="flex-1">{s.name}</span>
                  <span className="font-semibold tabular-nums">{pct(s.value)}</span>
                </span>
                <MeterBar value={s.value} color={s.color} label={`${s.name} ${pct(s.value)}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Priorities" className="flex flex-col gap-4">
        <SectionTitle>What to fix first</SectionTitle>
        {data.priorities.length > 0 && (
          <div className="rounded-xl border-[1.5px] border-edge bg-card p-4 break-inside-avoid">
            <PriorityMatrix
              points={data.priorities.map((p) => ({
                name: p.theme,
                x: p.frequency,
                y: p.negativeShare,
                size: p.avgSeverity / 5,
                rank: p.rank,
              }))}
            />
          </div>
        )}
        {data.priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No problems were found in the feedback.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {data.priorities.map((p) => (
              <li key={p.theme} className="flex gap-4 rounded-xl border bg-card p-5 break-inside-avoid">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {p.rank}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold">{p.theme}</h3>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      priority <b className="text-foreground">{p.score.toFixed(0)}</b> / 100
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Priority ${p.score.toFixed(0)} of 100`}>
                    <div className="h-full rounded-full bg-neg" style={{ width: `${p.score}%` }} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Share of feedback", value: p.frequency / Math.max(0.0001, top?.frequency ?? p.frequency), text: `${pct(p.frequency)} · ${nf.format(p.mentions)}` },
                      { label: "Negative", value: p.negativeShare, text: pct(p.negativeShare) },
                      { label: "Severity", value: p.avgSeverity / 5, text: `${p.avgSeverity.toFixed(1)} / 5` },
                    ].map((part) => (
                      <div key={part.label} className="flex flex-col gap-1">
                        <span className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{part.label}</span>
                          <span className="font-semibold tabular-nums">{part.text}</span>
                        </span>
                        <MeterBar value={part.value} color="var(--p1)" className="h-2" label={`${part.label}: ${part.text}`} />
                      </div>
                    ))}
                  </div>
                  {p.action && (
                    <p className="text-[0.9375rem] leading-relaxed">
                      <span className="font-semibold">Suggested action: </span>
                      {p.action}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">Why it ranks here: </span>
                    {p.why}
                  </p>
                  {p.topIssues.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Most common issues: </span>
                      {p.topIssues.map((i) => `${i.issue} (${nf.format(i.mentions)})`).join("; ")}
                    </p>
                  )}
                  {p.quote && <p className="border-l-2 pl-3 text-sm italic text-muted-foreground">“{p.quote}”</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {data.strengths.length > 0 && (
        <section aria-label="Strengths" className="flex flex-col gap-3 break-inside-avoid">
          <SectionTitle>What is going well</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.strengths.map((s) => (
              <li key={s.theme} className="rounded-xl bg-tint-e p-4 text-sm">
                <p className="font-semibold">{s.theme}</p>
                <p className="mt-1 text-muted-foreground">
                  {pct(s.positiveShare)} positive across {nf.format(s.mentions)} mentions
                  {s.topPoint ? `. Customers like: ${s.topPoint}.` : "."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Themes" className="flex flex-col gap-3">
        <SectionTitle>All themes</SectionTitle>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="p-3">Theme</th>
                <th scope="col" className="p-3 text-right">Mentions</th>
                <th scope="col" className="p-3 text-right">Share</th>
                <th scope="col" className="w-1/3 p-3">Negative</th>
              </tr>
            </thead>
            <tbody>
              {data.themes.map((t) => (
                <tr key={t.theme} className="border-b last:border-0">
                  <td className="p-3 font-medium">{t.theme}</td>
                  <td className="p-3 text-right tabular-nums">{nf.format(t.mentions)}</td>
                  <td className="p-3 text-right tabular-nums">{pct(t.share)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-neg" style={{ width: pct(t.negativeShare) }} />
                      </div>
                      <span className="w-10 text-right tabular-nums">{pct(t.negativeShare)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.issues.length > 0 && (
        <section aria-label="Issue tracker" className="flex flex-col gap-3">
          <SectionTitle>Issues being tracked</SectionTitle>
          <ul className="flex flex-col gap-2">
            {data.issues.map((i) => (
              <li key={`${i.theme}-${i.title}`} className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium first-letter:uppercase">{i.title}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide", STATUS_PILL[i.status])}>
                    {STATUS_LABEL[i.status]}
                  </span>
                </div>
                {i.note && <p className="text-xs text-muted-foreground">{i.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        How to read this report: an AI read each unique review and labelled its sentiment, theme and severity. All counts
        and percentages were calculated by Verdict from those labels and count every time a review was received. A
        problem&apos;s priority is its share of all feedback × its negative share × its average severity (out of 5),
        shown relative to the top problem.
      </footer>
    </article>
  );
}
