import type { FeedbackRow } from "./feedback-types.ts";
import { normalizeText } from "./local/normalize.ts";

export type RawRecord = {
  review: string;
  category?: string | null;
  date?: string | null;
};

// Rows are the same when the normalized text, category and date all match.
// Different dates stay separate so a trend over time is still possible later.
function keyOf(review: string, category: string | null, date: string | null): string {
  return `${category ?? ""}\u0000${date ?? ""}\u0000${normalizeText(review)}`;
}

// Adds new rows to existing ones. Existing rows keep their ids (so earlier AI labels still match),
// repeated feedback has its count increased, and genuinely new feedback gets the next free id.
export function mergeRows(existing: FeedbackRow[], incoming: FeedbackRow[]): FeedbackRow[] {
  const out = existing.map((r) => ({ ...r }));
  const index = new Map<string, number>();
  out.forEach((r, i) => index.set(keyOf(r.review, r.category, r.date), i));
  let nextId = out.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  for (const row of incoming) {
    const key = keyOf(row.review, row.category, row.date);
    const i = index.get(key);
    if (i !== undefined) {
      out[i].occurrences += row.occurrences;
    } else {
      index.set(key, out.length);
      out.push({ ...row, id: nextId++ });
    }
  }
  return out;
}

// Adds one hand-typed record to an existing list without changing the original array.
// If the same feedback is already there (ignoring case and punctuation), its count goes up by one.
// Text with no letters or digits cannot be added and leaves the list unchanged.
export function addRecord(rows: FeedbackRow[], record: RawRecord): FeedbackRow[] {
  const review = record.review.trim();
  const category = record.category?.trim() || null;
  const date = record.date?.trim() || null;
  if (normalizeText(review) === "") return rows;

  const key = keyOf(review, category, date);
  const index = rows.findIndex((r) => keyOf(r.review, r.category, r.date) === key);
  if (index >= 0) {
    return rows.map((r, i) => (i === index ? { ...r, occurrences: r.occurrences + 1 } : r));
  }
  const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  return [...rows, { id: nextId, review, category, date, occurrences: 1 }];
}
