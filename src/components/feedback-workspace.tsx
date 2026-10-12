"use client";

import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddFeedbackSheet } from "@/components/add-feedback-sheet";
import { DataGate } from "@/components/data-gate";
import { SampleBanner } from "@/components/dataset-switcher";
import { useFeedbackData } from "@/components/data-provider";
import { FeedbackTable } from "@/components/feedback-table";
import { KpiCards } from "@/components/kpi-cards";
import { useUpload } from "@/components/upload-provider";
import { useAnalysis } from "@/components/use-analysis";

const nf = new Intl.NumberFormat("en-US");

function Workspace() {
  const { rows, uid, label, context, stats, summary, saveWarning, actionError } = useFeedbackData();
  const { metrics, result } = useAnalysis();
  const { open } = useUpload();
  const labels = useMemo(() => (result ? new Map(result.labels.map((l) => [l.id, l])) : null), [result]);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <SampleBanner />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <p>
            Dataset: <span className="font-medium text-foreground">{label}</span>
            {context ? ` · ${context}` : ""}
          </p>
          {stats && (
            <p className="mt-0.5 text-xs">
              {nf.format(stats.rowsRead)} rows read, {nf.format(stats.duplicatesRemoved)} duplicates merged
              {stats.emptyRows + stats.junkRows > 0
                ? `, ${nf.format(stats.emptyRows + stats.junkRows)} empty or symbol-only rows ignored`
                : ""}
              .
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => open("new")}>
            <Upload data-icon="inline-start" aria-hidden="true" />
            Upload new dataset
          </Button>
          <Button variant="outline" onClick={() => open("add")}>
            <Upload data-icon="inline-start" aria-hidden="true" />
            Add to this dataset
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add one review
          </Button>
        </div>
      </div>

      {saveWarning && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {saveWarning}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <KpiCards summary={summary} analysis={metrics} />
      <FeedbackTable
        // Each dataset starts with fresh search, sort and page state.
        key={uid}
        rows={rows}
        categories={summary.categories}
        showCategory={summary.hasCategory}
        showDate={summary.hasDates}
        labels={labels}
        themes={result ? [...result.themes, "Other"] : undefined}
      />

      <AddFeedbackSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}

export function FeedbackWorkspace() {
  return (
    <DataGate>
      <Workspace />
    </DataGate>
  );
}
