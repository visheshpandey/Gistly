
// One unique piece of feedback. Identical rows are merged and counted in `occurrences`.
export type FeedbackRow = {
  id: number;
  review: string;
  category: string | null; // null when the dataset has no category column
  date: string | null; // YYYY-MM-DD, null when the dataset has no usable date
  occurrences: number;
};

export type Grade = "A" | "B" | "C" | "D" | "E" | "F";

// Our own instant score. It measures data hygiene (duplicates, empty rows, very short rows, garbage),
// not how good the content is. It is not comparable to Adaption's score.
export type QualityScore = { score: number; grade: Grade };

// What the local engine learned while importing. Shown on the Adaption page as "Instant".
export type LocalStats = {
  rowsRead: number; // every data row in the file
  rowsKept: number; // rows that had usable text
  emptyRows: number; // rows with no text
  junkRows: number; // rows with only symbols, emoji or links
  overflowRows: number; // rows ignored because the unique-entry limit was reached
  uniqueEntries: number; // entries left after merging duplicates
  duplicatesRemoved: number; // rowsKept - uniqueEntries
  nearDupMerged: number; // entries merged by the optional near-duplicate pass
  nearDup: "off" | "done" | "skipped"; // skipped = it would have taken too long
  before: QualityScore; // raw data
  after: QualityScore; // after removing duplicates and junk
  timings: { parseMs: number; dedupeMs: number; scoreMs: number; totalMs: number };
};

// Where a dataset came from.
export type SourceKind = "sample" | "file" | "paste";

// One dataset on the user's shelf. The list of these is small and loads at once, without the (large) rows.
export type DatasetMeta = {
  uid: string;
  name: string; // shown everywhere, and the user can rename it
  source: SourceKind;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
  uniqueEntries: number;
  mentions: number; // all rows, repeats included
  hasDates: boolean;
  hasCategory: boolean;
};

// The dataset that is open right now.
export type Dataset = {
  uid: string; // identifies this dataset for good. Kept when data is added to it
  rows: FeedbackRow[];
  label: string; // the dataset's name
  context: string; // optional one-line description, e.g. "food delivery app"
  stats: LocalStats | null; // null for data we have no import details for
  source: SourceKind;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DatasetSummary = {
  total: number; // all mentions (sum of occurrences)
  uniqueReviews: number; // distinct review texts
  categories: string[];
  hasCategory: boolean;
  hasDates: boolean;
};

export function summarize(rows: FeedbackRow[]): DatasetSummary {
  let total = 0;
  let hasDates = false;
  const texts = new Set<string>();
  const categories = new Set<string>();

  for (const row of rows) {
    total += row.occurrences;
    texts.add(row.review);
    if (row.category) categories.add(row.category);
    if (row.date) hasDates = true;
  }

  return {
    total,
    uniqueReviews: texts.size,
    categories: [...categories].sort(),
    hasCategory: categories.size > 0,
    hasDates,
  };
}
