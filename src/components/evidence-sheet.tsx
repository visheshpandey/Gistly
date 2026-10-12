"use client";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FeedbackRow } from "@/lib/feedback-types";
import type { AnalysisResult, ReviewLabel } from "@/lib/analysis/types";

const nf = new Intl.NumberFormat("en-US");
const MAX_EXAMPLES = 10;

// Real reviews behind a number. Opens from the dashboard cards and charts.
export function EvidenceSheet({
  theme,
  rows,
  result,
  onClose,
}: {
  theme: string | null;
  rows: FeedbackRow[];
  result: AnalysisResult;
  onClose: () => void;
}) {
  const labelOf = new Map<number, ReviewLabel>(result.labels.map((l) => [l.id, l]));
  const entries = theme
    ? rows
        .filter((r) => labelOf.get(r.id)?.theme === theme)
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, MAX_EXAMPLES)
    : [];
  const total = theme ? rows.filter((r) => labelOf.get(r.id)?.theme === theme).length : 0;

  return (
    <Sheet open={theme !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{theme}</SheetTitle>
          <SheetDescription>
            The {entries.length} most repeated reviews about this theme
            {total > entries.length ? ` (of ${nf.format(total)} unique reviews)` : ""}, using your current filters.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-3 px-4 pb-4">
          {entries.map((r) => {
            const label = labelOf.get(r.id);
            return (
              <li key={r.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <p className="text-sm">“{r.review}”</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {label && (
                    <Badge variant={label.sentiment === "negative" ? "destructive" : "secondary"}>{label.sentiment}</Badge>
                  )}
                  <span className="tabular-nums">received {nf.format(r.occurrences)}×</span>
                  {label?.keyIssue && <span className="first-letter:uppercase">{label.keyIssue}</span>}
                </div>
              </li>
            );
          })}
          {entries.length === 0 && <li className="text-sm text-muted-foreground">No reviews match your filters.</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
