"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataGate } from "@/components/data-gate";
import { useFeedbackData } from "@/components/data-provider";
import { ReportView } from "@/components/report-view";
import { useAnalysis } from "@/components/use-analysis";
import { useIssues } from "@/components/use-issues";
import { rankPriorities } from "@/lib/analysis/priority";
import { buildReport } from "@/lib/report/build";
import { encodeReport } from "@/lib/report/encode";
import type { ReportData } from "@/lib/report/types";

// Saved copies of reports are kept in this browser for now. They move to Supabase once the keys are available.
const STORAGE_KEY = "insightflow:reports:v1";
const MAX_LINK_CHARS = 8000; // longer addresses may be cut off by some apps

type Snapshot = { id: string; savedAt: string; data: ReportData };

function readSnapshots(): Snapshot[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as Snapshot[]).filter((s) => s && typeof s.id === "string" && s.data?.version === 1) : [];
  } catch {
    return [];
  }
}

function Panel() {
  const { uid, label, rows } = useFeedbackData();
  const { result, metrics, loaded } = useAnalysis();
  const { issues } = useIssues();
  const [title, setTitle] = useState("Customer feedback report");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [viewing, setViewing] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const stored = readSnapshots();
      if (!cancelled) setSnapshots(stored);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const live = useMemo(() => {
    if (!result || !metrics) return null;
    return buildReport({
      title,
      datasetLabel: label,
      uniqueReviews: rows.length,
      result,
      metrics,
      priorities: rankPriorities(metrics),
      issues: issues.filter((i) => i.datasetUid === uid),
    });
  }, [result, metrics, title, label, rows.length, issues, uid]);

  if (!loaded && !result) {
    return <p role="status" className="text-sm text-muted-foreground">Loading your analysis...</p>;
  }

  if (!live) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <h2 className="text-base font-medium">Run the AI analysis first</h2>
          <p className="max-w-prose text-sm text-muted-foreground">A report summarises the analysis, so there has to be one.</p>
          <Link href="/analysis" className={buttonVariants()}>
            Go to AI Analysis
          </Link>
        </CardContent>
      </Card>
    );
  }

  const data = viewing ? viewing.data : live;

  function persist(next: Snapshot[]) {
    setSnapshots(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setMessage("Saved reports could not be stored in this browser.");
    }
  }

  function saveSnapshot() {
    if (!live) return;
    const snap: Snapshot = { id: `${Date.now()}`, savedAt: new Date().toISOString(), data: live };
    persist([snap, ...snapshots]);
    setMessage("Report saved. Find it under Saved reports.");
  }

  async function copyLink() {
    const encoded = await encodeReport(data);
    const url = `${window.location.origin}/reports/view#${encoded}`;
    setLink(url);
    if (url.length > MAX_LINK_CHARS) {
      setMessage("This report is very long, so the link may not work in every app. Try fewer issue notes.");
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied. Anyone who has it can read this report.");
    } catch {
      setMessage("Could not copy automatically. Copy the link below.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Report actions" className="flex flex-col gap-3 rounded-xl border p-4 print:hidden">
        {viewing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Viewing a saved report from{" "}
              <span className="font-medium">{new Date(viewing.savedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
            </p>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Back to the live report
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:max-w-md">
            <label htmlFor="report-title" className="text-sm font-medium">
              Report title
            </label>
            <Input id="report-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>Download PDF</Button>
          <Button variant="outline" onClick={() => void copyLink()}>
            Copy share link
          </Button>
          {!viewing && (
            <Button variant="outline" onClick={saveSnapshot}>
              Save this report
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Download PDF opens your browser&apos;s print window: choose &quot;Save as PDF&quot; as the printer. A share link
          contains the report itself (not your raw feedback) and works without an account.
        </p>
        {message && (
          <p role="status" aria-live="polite" className="text-sm">
            {message}
          </p>
        )}
        {link && (
          <input
            readOnly
            aria-label="Share link"
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-8 w-full rounded-lg border border-input bg-muted/40 px-2.5 text-xs"
          />
        )}
      </section>

      <ReportView data={data} />

      {snapshots.length > 0 && (
        <section aria-label="Saved reports" className="flex flex-col gap-3 print:hidden">
          <h2 className="title-bar text-2xl font-semibold">Saved reports</h2>
          <ul className="flex flex-col gap-2">
            {snapshots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  <span className="font-medium">{s.data.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · saved {new Date(s.savedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button variant="outline" onClick={() => setViewing(s)}>
                    Open
                  </Button>
                  <Button variant="ghost" onClick={() => persist(snapshots.filter((x) => x.id !== s.id))}>
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ReportsPanel() {
  return (
    <DataGate>
      <Panel />
    </DataGate>
  );
}
