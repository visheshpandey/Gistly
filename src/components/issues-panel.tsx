"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { NativeSelect } from "@/components/native-select";
import { Stat } from "@/components/stat";
import { cn } from "@/lib/utils";
import { useAnalysis } from "@/components/use-analysis";
import { useIssues } from "@/components/use-issues";
import { STATUSES, STATUS_LABEL, type Issue, type IssueStatus } from "@/lib/issues/types";

const nf = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

type Filter = IssueStatus | "all";

// Status colours: red-ish for open, yellow for in progress, green for resolved.
const STATUS_PILL: Record<IssueStatus, string> = {
  open: "bg-neg text-on-neg",
  in_progress: "bg-sel text-foreground",
  resolved: "bg-pos-bg text-foreground",
};

function Cell({ label, value, sub, subClass }: { label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
      {sub && <dd className={cn("text-xs tabular-nums", subClass ?? "text-muted-foreground")}>{sub}</dd>}
    </div>
  );
}

function IssueCard({
  issue,
  nowMentions,
  onStatus,
  onNote,
  onRemove,
}: {
  issue: Issue;
  nowMentions: number | null;
  onStatus: (s: IssueStatus) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  const [note, setNote] = useState(issue.note);
  const [confirming, setConfirming] = useState(false);
  const delta = nowMentions === null ? null : nowMentions - issue.snapshot.mentions;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={cn("rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide", STATUS_PILL[issue.status])}>
              {STATUS_LABEL[issue.status]}
            </span>
            <h2 className="mt-2 text-lg font-semibold tracking-tight first-letter:uppercase">{issue.title}</h2>
            <p className="text-xs text-muted-foreground">Saved {date(issue.createdAt)} · updated {date(issue.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`status-${issue.id}`}>
              Status of {issue.title}
            </label>
            <NativeSelect
              id={`status-${issue.id}`}
              value={issue.status}
              onChange={(e) => onStatus(e.target.value as IssueStatus)}
              className="w-36"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cell label="Priority when saved" value={`${issue.snapshot.priorityScore.toFixed(0)}/100`} />
          <Cell label="Mentions when saved" value={nf.format(issue.snapshot.mentions)} />
          <Cell
            label="Negative · severity"
            value={`${pct(issue.snapshot.negativeShare)} · ${issue.snapshot.avgSeverity.toFixed(1)}`}
          />
          <Cell
            label="Mentions now"
            value={nowMentions === null ? "—" : nf.format(nowMentions)}
            sub={delta === null ? undefined : delta === 0 ? "no change" : `${delta > 0 ? "▲ +" : "▼ "}${nf.format(delta)} since saved`}
            // More mentions of a problem is bad news, fewer is good news.
            subClass={delta === null || delta === 0 ? undefined : delta > 0 ? "font-semibold text-neg" : "font-semibold text-pos"}
          />
        </dl>

        {nowMentions !== null && (
          <div className="flex flex-col gap-1.5" role="img" aria-label={`Mentions when saved ${nf.format(issue.snapshot.mentions)}, now ${nf.format(nowMentions)}`}>
            {[
              { label: "When saved", value: issue.snapshot.mentions, color: "var(--neu)" },
              { label: "Now", value: nowMentions, color: delta !== null && delta > 0 ? "var(--neg)" : "var(--pos)" },
            ].map((b) => (
              <div key={b.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem] items-center gap-3 text-xs">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(b.value / Math.max(1, issue.snapshot.mentions, nowMentions)) * 100}%`,
                      background: b.color,
                    }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums">{nf.format(b.value)}</span>
              </div>
            ))}
          </div>
        )}

        {issue.action && (
          <div>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested action</h3>
            <p className="mt-1.5 text-sm leading-relaxed">{issue.action}</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`note-${issue.id}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team notes
          </label>
          <textarea
            id={`note-${issue.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== issue.note && onNote(note)}
            rows={2}
            maxLength={1000}
            placeholder="Who owns this? What was decided?"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
        </div>

        <div className="flex justify-end">
          {confirming ? (
            <div className="flex items-center gap-2 text-sm">
              <span>Delete this issue?</span>
              <Button variant="destructive" onClick={onRemove}>
                Delete
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Panel() {
  const { uid } = useFeedbackData();
  const { metrics } = useAnalysis();
  const { issues, loaded, saveError, update, remove } = useIssues();
  const [filter, setFilter] = useState<Filter>("all");

  const mine = useMemo(() => issues.filter((i) => i.datasetUid === uid), [issues, uid]);
  const counts = useMemo(
    () => ({
      all: mine.length,
      open: mine.filter((i) => i.status === "open").length,
      in_progress: mine.filter((i) => i.status === "in_progress").length,
      resolved: mine.filter((i) => i.status === "resolved").length,
    }),
    [mine],
  );
  const shown = filter === "all" ? mine : mine.filter((i) => i.status === filter);
  const nowOf = (theme: string): number | null => (metrics ? (metrics.themes.find((t) => t.theme === theme)?.mentions ?? 0) : null);

  if (!loaded) return <p role="status" className="text-sm text-muted-foreground">Loading your issues...</p>;

  if (mine.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No issues saved yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Save a problem from the Recommendations page to track it here and mark it open, in progress or resolved.
          {issues.length > 0 ? " You have issues saved for a different dataset." : ""}
        </p>
        <Link href="/recommendations" className={buttonVariants()}>
          Go to Recommendations
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {saveError && (
        <p role="alert" className="notice p-3 text-sm">
          {saveError}
        </p>
      )}
      <section aria-label="Issue counts" className="kpi-strip">
        <Stat tint="a" label="Tracked" value={nf.format(counts.all)} note="Issues saved for this dataset" />
        <Stat tint="b" label="Open" value={nf.format(counts.open)} note="Not started yet" />
        <Stat tint="c" label="In progress" value={nf.format(counts.in_progress)} note="Someone is on it" />
        <Stat tint="e" label="Resolved" value={nf.format(counts.resolved)} note="Fixed and closed" />
      </section>

      <div className="flex flex-col gap-2">
        <div
          className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full border-[1.5px] border-edge bg-muted"
          role="img"
          aria-label={`${counts.open} open, ${counts.in_progress} in progress, ${counts.resolved} resolved`}
        >
          <span className="bg-neg" style={{ width: `${(counts.open / Math.max(1, counts.all)) * 100}%` }} />
          <span className="bg-hl" style={{ width: `${(counts.in_progress / Math.max(1, counts.all)) * 100}%` }} />
          <span className="bg-pos" style={{ width: `${(counts.resolved / Math.max(1, counts.all)) * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round((counts.resolved / Math.max(1, counts.all)) * 100)}% resolved · red open, yellow in progress, green
          resolved
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter issues by status">
        {(["all", ...STATUSES] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border-[1.5px] px-3 py-1 text-[0.8125rem] font-medium transition-colors",
              filter === f ? "border-edge bg-hl font-bold text-[#1c1b2e]" : "border-edge bg-card hover:bg-muted",
            )}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]} <span className="tabular-nums">({counts[f]})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : STATUS_LABEL[filter as IssueStatus].toLowerCase() + " "}issues.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((issue) => (
            <li key={issue.id}>
              <IssueCard
                issue={issue}
                nowMentions={nowOf(issue.theme)}
                onStatus={(status) => update(issue.id, { status })}
                onNote={(note) => update(issue.id, { note })}
                onRemove={() => remove(issue.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IssuesPanel() {
  return (
    <DataGate>
      <Panel />
    </DataGate>
  );
}
