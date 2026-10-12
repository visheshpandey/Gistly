"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import type { ReviewLabel, Sentiment } from "@/lib/analysis/types";
import type { FeedbackRow } from "@/lib/feedback-types";
import { cn } from "@/lib/utils";

const PILL: Record<Sentiment, string> = {
  positive: "bg-pos-bg text-foreground",
  neutral: "bg-neu-bg text-muted-foreground",
  negative: "bg-neg text-on-neg",
};

// Sentiment as a coloured pill: green, grey or red, with the word written out too.
export function SentimentPill({ sentiment }: { sentiment: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        PILL[sentiment as Sentiment] ?? PILL.neutral,
      )}
    >
      {sentiment}
    </span>
  );
}

const PAGE_SIZE = 20;

type SortKey = "review" | "category" | "date" | "occurrences";
type SortDir = "asc" | "desc";

function compare(a: FeedbackRow, b: FeedbackRow, key: SortKey): number {
  if (key === "occurrences") return a.occurrences - b.occurrences;
  const av = a[key];
  const bv = b[key];
  // Empty values always sort last.
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return av.localeCompare(bv);
}

function SortHeader({
  label,
  column,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  className?: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

// A small bar chart where every bar is also a filter button. Clicking the selected bar clears the filter.
function BarFilter({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { key: string; label: string; value: number; color: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="rounded-xl border-[1.5px] border-edge bg-card p-4 shadow-[3px_3px_0_var(--edge)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title} · click to filter</p>
      <ul className="flex flex-col gap-1">
        {items.map((i) => {
          const active = selected === i.key;
          return (
            <li key={i.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? "all" : i.key)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-md px-2 py-1 text-left text-sm transition-colors",
                  active ? "bg-sel font-semibold" : "hover:bg-muted",
                )}
              >
                <span className="truncate capitalize">{i.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
                </span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                  {total > 0 ? `${Math.round((i.value / total) * 100)}%` : "0%"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FeedbackTable({
  rows,
  categories,
  showCategory,
  showDate,
  labels,
  themes,
}: {
  rows: FeedbackRow[];
  categories: string[];
  showCategory: boolean;
  showDate: boolean;
  labels?: Map<number, ReviewLabel> | null; // AI labels, when an analysis exists
  themes?: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [theme, setTheme] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("occurrences");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = rows.filter(
      (row) =>
        (category === "all" || row.category === category) &&
        (q === "" || row.review.toLowerCase().includes(q)) &&
        (sentiment === "all" || labels?.get(row.id)?.sentiment === sentiment) &&
        (theme === "all" || labels?.get(row.id)?.theme === theme),
    );
    const sign = sortDir === "asc" ? 1 : -1;
    // Null values stay last in both directions, so they are handled before the sign flip.
    return [...matches].sort((a, b) => {
      const aEmpty = sortKey !== "occurrences" && a[sortKey] === null;
      const bEmpty = sortKey !== "occurrences" && b[sortKey] === null;
      if (aEmpty || bEmpty) return compare(a, b, sortKey);
      return sign * compare(a, b, sortKey);
    });
  }, [rows, query, category, sentiment, theme, labels, sortKey, sortDir]);

  // Mentions per sentiment and per theme, for the clickable bars above the table. They follow the search and
  // category filters but not their own, so every bar stays visible while one is selected.
  const breakdown = useMemo(() => {
    if (!labels) return null;
    const q = query.trim().toLowerCase();
    const bySentiment: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    const byTheme = new Map<string, number>();
    for (const row of rows) {
      if (category !== "all" && row.category !== category) continue;
      if (q !== "" && !row.review.toLowerCase().includes(q)) continue;
      const l = labels.get(row.id);
      if (!l) continue;
      bySentiment[l.sentiment] += row.occurrences;
      byTheme.set(l.theme, (byTheme.get(l.theme) ?? 0) + row.occurrences);
    }
    const themesSorted = [...byTheme.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { bySentiment, themesSorted };
  }, [rows, labels, query, category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "occurrences" ? "desc" : "asc");
    }
    setPage(1);
  }

  const headerProps = { sortKey, sortDir, onSort: toggleSort };

  return (
    <section aria-label="Feedback table" className="flex flex-col gap-4">
      {breakdown && (
        <div className="grid gap-4 md:grid-cols-2">
          <BarFilter
            title="Sentiment"
            items={(["positive", "neutral", "negative"] as const).map((s) => ({
              key: s,
              label: s,
              value: breakdown.bySentiment[s],
              color: s === "positive" ? "var(--pos)" : s === "neutral" ? "var(--neu)" : "var(--neg)",
            }))}
            selected={sentiment}
            onSelect={(v) => {
              setSentiment(v);
              setPage(1);
            }}
          />
          <BarFilter
            title="Top themes"
            items={breakdown.themesSorted.map(([t, v]) => ({ key: t, label: t, value: v, color: "var(--p2)" }))}
            selected={theme}
            onSelect={(v) => {
              setTheme(v);
              setPage(1);
            }}
          />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="feedback-search" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Search reviews
          </label>
          <Input
            id="feedback-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. refund, delivery, support"
          />
        </div>
        {showCategory && (
          <div className="flex flex-col gap-1.5 sm:w-56">
            <label htmlFor="feedback-category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <NativeSelect
              id="feedback-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {labels && (
          <>
            <div className="flex flex-col gap-1.5 sm:w-40">
              <label htmlFor="feedback-sentiment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sentiment
              </label>
              <NativeSelect
                id="feedback-sentiment"
                value={sentiment}
                onChange={(e) => {
                  setSentiment(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5 sm:w-56">
              <label htmlFor="feedback-theme" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Theme
              </label>
              <NativeSelect
                id="feedback-theme"
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All themes</option>
                {(themes ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </>
        )}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length === 0
          ? "No matching reviews"
          : `Showing ${start + 1} to ${start + visible.length} of ${filtered.length} unique reviews`}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No feedback matches these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear the search{showCategory || labels ? " or reset the filters" : ""}.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Review" column="review" {...headerProps} />
                  {showCategory && <SortHeader label="Category" column="category" {...headerProps} />}
                  {showDate && <SortHeader label="Date" column="date" {...headerProps} />}
                  {labels && <TableHead>Sentiment</TableHead>}
                  {labels && <TableHead>Theme</TableHead>}
                  <SortHeader
                    label="Occurrences"
                    column="occurrences"
                    className="text-right"
                    {...headerProps}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xl whitespace-normal">{row.review}</TableCell>
                    {showCategory && (
                      <TableCell>
                        {row.category ? (
                          <Badge variant="secondary">{row.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {showDate && (
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {row.date ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {labels && (
                      <TableCell>
                        {labels.get(row.id) ? (
                          <SentimentPill sentiment={labels.get(row.id)!.sentiment} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Not analysed</span>
                        )}
                      </TableCell>
                    )}
                    {labels && (
                      <TableCell className="whitespace-normal text-sm">
                        {labels.get(row.id)?.theme ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-semibold tabular-nums">{row.occurrences}×</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {current} of {pageCount}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
