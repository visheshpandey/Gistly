import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

export type FeedbackRow = {
  id: number;
  review: string;
  category: string;
  occurrences: number;
};

export type FeedbackData = {
  rows: FeedbackRow[];
  categories: string[];
  total: number;
  uniqueReviews: number;
  negativeEstimate: number;
  error: string | null;
};

const CSV_PATH = path.join(process.cwd(), "data", "feedback.csv");

// Phase 0 only: a rough keyword match, labeled "estimated" in the UI.
// Replaced by AI sentiment in a later phase. Never derived from `category`.
const NEGATIVE_WORDS = [
  "disappoint",
  "unresponsive",
  "delay",
  "defect",
  "fraud",
  "scam",
  "victim",
  "poor",
  "terrible",
  "worst",
  "broken",
  "damaged",
  "refund",
  "never arrived",
  "rude",
  "unacceptable",
  "frustrat",
  "complain",
  "bad",
  "issue",
  "problem",
  "fake",
  "stolen",
  "overcharged",
];

export function looksNegative(review: string): boolean {
  const text = review.toLowerCase();
  return NEGATIVE_WORDS.some((word) => text.includes(word));
}

const EMPTY: FeedbackData = {
  rows: [],
  categories: [],
  total: 0,
  uniqueReviews: 0,
  negativeEstimate: 0,
  error: null,
};

export async function loadFeedback(): Promise<FeedbackData> {
  let raw: string;
  try {
    raw = await fs.readFile(CSV_PATH, "utf8");
  } catch {
    return {
      ...EMPTY,
      error:
        "data/feedback.csv was not found. Copy the dataset into the data folder (see data/README.md).",
    };
  }

  const parsed = Papa.parse<{ review?: string; category?: string }>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  const grouped = new Map<string, FeedbackRow>();
  let total = 0;
  for (const record of parsed.data) {
    const review = record.review?.trim();
    const category = record.category?.trim();
    if (!review || !category) continue;
    total += 1;
    const key = `${category}\u0000${review}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.occurrences += 1;
    } else {
      grouped.set(key, { id: grouped.size + 1, review, category, occurrences: 1 });
    }
  }

  if (total === 0) {
    return {
      ...EMPTY,
      error:
        "data/feedback.csv has no usable rows. It needs the columns: review, category.",
    };
  }

  const rows = [...grouped.values()];
  const uniqueReviews = new Set(rows.map((r) => r.review)).size;
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  const negativeEstimate = rows
    .filter((r) => looksNegative(r.review))
    .reduce((sum, r) => sum + r.occurrences, 0);

  return { rows, categories, total, uniqueReviews, negativeEstimate, error: null };
}
