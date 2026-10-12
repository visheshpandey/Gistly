"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { NativeSelect } from "@/components/native-select";
import { useAnalysis } from "@/components/use-analysis";
import { useIssues } from "@/components/use-issues";
import { STATUSES, STATUS_LABEL, type Issue, type IssueStatus } from "@/lib/issues/types";

const nf = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

type Filter = IssueStatus | "all";

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
            <h2 className="text-base font-semibold tracking-tight">{issue.title}</h2>
            <p className="text-xs text-muted-foreground">Saved {date(issue.createdAt)} · updated {date(issue.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={issue.status === "resolved" ? "secondary" : issue.status === "in_progress" ? "default" : "outline"}>
              {STATUS_LABEL[issue.status]}
            </Badge>
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

        <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">Priority when saved</dt>
            <dd className="text-lg font-semibold tabular-nums">{issue.snapshot.priorityScore.toFixed(0)}/100</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">Mentions when saved</dt>
            <dd className="text-lg font-semibold tabular-nums">{nf.format(issue.snapshot.mentions)}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">Negative / severity</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {pct(issue.snapshot.negativeShare)} · {issue.snapshot.avgSeverity.toFixed(1)}
            </dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">Mentions now</dt>
            <dd className="text-lg font-semibold tabular-nums">{nowMentions === null ? "—" : nf.format(nowMentions)}</dd>
            {delta !== null && (
              <dd className="text-xs tabular-nums text-muted-foreground">
                {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${nf.format(delta)} since saved`}
              </dd>
            )}
          </div>
        </dl>

        {issue.action && (
          <div>
            <h3 className="text-sm font-medium">Suggested action</h3>
            <p className="mt-1 text-sm text-muted-foreground">{issue.action}</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`note-${issue.id}`} className="text-sm font-medium">
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
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter issues by status">
        {(["all", ...STATUSES] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${filter === f ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
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
