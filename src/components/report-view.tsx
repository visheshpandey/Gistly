import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/issues/types";
import type { ReportData } from "@/lib/report/types";

const nf = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border p-3 break-inside-avoid">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

// A business-friendly report. It only reads the data it is given, so it looks the same live, saved, shared or printed.
export function ReportView({ data }: { data: ReportData }) {
  const k = data.kpis;
  const date = new Date(data.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <article className="flex flex-col gap-8" aria-label={data.title}>
      <header className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
        <p className="text-sm text-muted-foreground">
          Prepared {date} · Source: {data.datasetLabel} · Analysed with AI ({data.model})
        </p>
      </header>

      <section aria-label="Summary" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Summary</h2>
        <p className="max-w-prose text-sm leading-relaxed">{data.summary}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label="Feedback received" value={nf.format(k.totalMentions)} note={`${nf.format(k.uniqueReviews)} unique reviews`} />
          <Kpi label="Positive" value={pct(k.positive)} />
          <Kpi label="Negative" value={pct(k.negative)} />
          <Kpi label="Net sentiment" value={`${k.netSentiment > 0 ? "+" : ""}${k.netSentiment.toFixed(1)}`} note="Positive minus negative, in points" />
          <Kpi label="Serious problems" value={nf.format(k.critical)} note="Negative, rated 4 or 5 of 5" />
        </div>
      </section>

      <section aria-label="Priorities" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">What to fix first</h2>
        {data.priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No problems were found in the feedback.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {data.priorities.map((p) => (
              <li key={p.theme} className="rounded-xl border p-4 break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold">
                    {p.rank}. {p.theme}
                  </h3>
                  <p className="text-sm tabular-nums text-muted-foreground">priority {p.score.toFixed(0)} / 100</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nf.format(p.mentions)} mentions ({pct(p.frequency)} of feedback) · {pct(p.negativeShare)} negative · average severity{" "}
                  {p.avgSeverity.toFixed(1)} of 5
                </p>
                {p.action && (
                  <p className="mt-3 text-sm">
                    <span className="font-medium">Suggested action: </span>
                    {p.action}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Why it ranks here: </span>
                  {p.why}
                </p>
                {p.topIssues.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Most common issues: </span>
                    {p.topIssues.map((i) => `${i.issue} (${nf.format(i.mentions)})`).join("; ")}
                  </p>
                )}
                {p.quote && <p className="mt-2 text-xs italic text-muted-foreground">“{p.quote}”</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {data.strengths.length > 0 && (
        <section aria-label="Strengths" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">What is going well</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {data.strengths.map((s) => (
              <li key={s.theme}>
                <span className="font-medium">{s.theme}</span>: {pct(s.positiveShare)} positive across {nf.format(s.mentions)} mentions
                {s.topPoint ? `. Customers like: ${s.topPoint}.` : "."}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Themes" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">All themes</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Theme</th>
                <th className="p-3 text-right font-medium">Mentions</th>
                <th className="p-3 text-right font-medium">Share</th>
                <th className="p-3 text-right font-medium">Negative</th>
              </tr>
            </thead>
            <tbody>
              {data.themes.map((t) => (
                <tr key={t.theme} className="border-b last:border-0">
                  <td className="p-3">{t.theme}</td>
                  <td className="p-3 text-right tabular-nums">{nf.format(t.mentions)}</td>
                  <td className="p-3 text-right tabular-nums">{pct(t.share)}</td>
                  <td className="p-3 text-right tabular-nums">{pct(t.negativeShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.issues.length > 0 && (
        <section aria-label="Issue tracker" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Issues being tracked</h2>
          <ul className="flex flex-col gap-2">
            {data.issues.map((i) => (
              <li key={`${i.theme}-${i.title}`} className="flex flex-col gap-1 rounded-lg border p-3 text-sm break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{i.title}</span>
                  <Badge variant={i.status === "resolved" ? "secondary" : i.status === "in_progress" ? "default" : "outline"}>
                    {STATUS_LABEL[i.status]}
                  </Badge>
                </div>
                {i.note && <p className="text-xs text-muted-foreground">{i.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        How to read this report: an AI read each unique review and labelled its sentiment, theme and severity. All counts
        and percentages were calculated by InsightFlow from those labels and count every time a review was received. A
        problem&apos;s priority is its share of all feedback × its negative share × its average severity (out of 5),
        shown relative to the top problem.
      </footer>
    </article>
  );
}
