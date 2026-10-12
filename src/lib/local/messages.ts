import type { ColumnMapping } from "../csv.ts";
import type { FeedbackRow, LocalStats } from "../feedback-types.ts";
import type { SourceFormat } from "./sources.ts";

// Messages between the page and the background file worker.

// How to read the file. `sheet` only matters for Excel; `hasHeader` only for tables (CSV, TSV, Excel).
export type SourceOptions = {
  format: SourceFormat;
  sheet: string | null;
  hasHeader: boolean;
};

// A look at the start of a file, so the user can say which column is which before the whole file is read.
export type FilePreview = {
  format: SourceFormat;
  fields: string[]; // column names
  rows: string[][]; // up to 200 rows, each as wide as `fields`
  sheets: string[]; // Excel sheet names (empty for other formats)
  sheet: string | null; // the Excel sheet shown
  hasHeader: boolean;
  encoding: string;
  note: string | null; // something worth telling the user, for example "5 lines could not be read"
  moreRows: boolean; // true when the file has more rows than shown
};

export type WorkerRequest =
  | ({ type: "preview"; file: File } & SourceOptions)
  | ({ type: "import"; file: File; mapping: ColumnMapping; nearDup: boolean } & SourceOptions);

export type WorkerResponse =
  | { type: "preview"; preview: FilePreview }
  | { type: "progress"; phase: "reading" | "finishing"; rowsRead: number; percent: number | null }
  | { type: "done"; rows: FeedbackRow[]; stats: LocalStats }
  | { type: "error"; message: string };
