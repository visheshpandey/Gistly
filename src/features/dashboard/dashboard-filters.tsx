"use client";

// Dashboard filter bar: sentiment and category pills, theme and date pickers, reset.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SENTIMENT_COLOR } from "@/components/charts/palette";
import { FilterChip } from "@/components/shared/filter-chip";
import { NativeSelect } from "@/components/shared/native-select";
import { NO_FILTERS, filtersActive, type Filters } from "@/lib/analysis/filters";
import { SENTIMENTS } from "@/lib/analysis/types";
import type { DatasetSummary } from "@/lib/feedback-types";

const nf = new Intl.NumberFormat("en-US");
const MAX_CATEGORY_CHIPS = 8; // more categories than this get a dropdown instead of chips
const LABEL = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

// The dashboard's filter bar: one-click pills for sentiment and category, dropdowns for theme and dates.
export function DashboardFilters({
  filters,
  onChange,
  summary,
  themes,
  shownMentions,
  datasetLabel,
  savedAnalysis,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  summary: DatasetSummary;
  themes: string[];
  shownMentions: number;
  datasetLabel: string;
  savedAnalysis: boolean;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const categoryChips = summary.hasCategory && summary.categories.length <= MAX_CATEGORY_CHIPS;

  return (
    <section aria-label="Filters" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sentiment">
          <span className={`w-20 ${LABEL}`}>Sentiment</span>
          <FilterChip pressed={filters.sentiment === "all"} onClick={() => set("sentiment", "all")}>
            All
          </FilterChip>
          {SENTIMENTS.map((s) => (
            <FilterChip
              key={s}
              pressed={filters.sentiment === s}
              dot={SENTIMENT_COLOR[s]}
              onClick={() => set("sentiment", filters.sentiment === s ? "all" : s)}
            >
              <span className="capitalize">{s}</span>
            </FilterChip>
          ))}
        </div>
        {categoryChips && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category">
            <span className={`w-20 ${LABEL}`}>Category</span>
            <FilterChip pressed={filters.category === "all"} onClick={() => set("category", "all")}>
              All
            </FilterChip>
            {summary.categories.map((c) => (
              <FilterChip key={c} pressed={filters.category === c} onClick={() => set("category", filters.category === c ? "all" : c)}>
                {c}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {summary.hasCategory && !categoryChips && (
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <label htmlFor="f-category" className={LABEL}>Category</label>
            <NativeSelect id="f-category" value={filters.category} onChange={(e) => set("category", e.target.value)}>
              <option value="all">All categories</option>
              {summary.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="f-theme" className={LABEL}>Theme</label>
          <NativeSelect id="f-theme" value={filters.theme} onChange={(e) => set("theme", e.target.value)}>
            <option value="all">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </NativeSelect>
        </div>
        {summary.hasDates && (
          <>
            <div className="flex min-w-36 flex-col gap-1.5">
              <label htmlFor="f-from" className={LABEL}>From</label>
              <Input id="f-from" type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
            </div>
            <div className="flex min-w-36 flex-col gap-1.5">
              <label htmlFor="f-to" className={LABEL}>To</label>
              <Input id="f-to" type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
            </div>
          </>
        )}
        <Button variant="outline" onClick={() => onChange(NO_FILTERS)} disabled={!filtersActive(filters)}>
          Reset filters
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {nf.format(shownMentions)} of {nf.format(summary.total)} mentions · {datasetLabel}
        {savedAnalysis ? " · saved AI analysis" : " · AI analysis"}
      </p>
    </section>
  );
}
