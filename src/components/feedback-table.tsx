"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FeedbackRow } from "@/lib/feedback";

const PAGE_SIZE = 20;

export function FeedbackTable({
  rows,
  categories,
}: {
  rows: FeedbackRow[];
  categories: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (category === "all" || row.category === category) &&
        (q === "" || row.review.toLowerCase().includes(q)),
    );
  }, [rows, query, category]);

  const visible = filtered.slice(0, PAGE_SIZE);

  return (
    <section aria-label="Feedback table" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="feedback-search" className="text-sm font-medium">
            Search reviews
          </label>
          <Input
            id="feedback-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. refund, delivery, support"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor="feedback-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {visible.length} of {filtered.length} unique reviews
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No feedback matches these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear the search or choose All categories.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Review</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Occurrences</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-xl whitespace-normal">{row.review}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.occurrences}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
