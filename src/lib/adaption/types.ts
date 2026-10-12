// Shared by the server routes and the browser. Contains no secrets.

// Where a report came from. "precomputed" is a saved real Adaption run (used for the sample dataset).
// The instant local result is a different thing (see LocalStats) and is never labelled as Adaption.
export type ReportSource = "adaption" | "precomputed";

export type AdaptionQuality = {
  gradeBefore: string | null;
  gradeAfter: string | null;
  scoreBefore: number | null; // 0 to 10
  scoreAfter: number | null; // 0 to 10
  percentileAfter: number | null; // 0 to 100
};

export type AdaptionReport = {
  source: ReportSource;
  datasetUid?: string; // which dataset this report belongs to (set when it is saved in the browser)
  fromCache?: boolean; // true when an earlier run was reused instead of running again
  datasetLabel: string; // which dataset this report describes
  datasetId: string | null; // Adaption dataset id, null for the fallback
  totalMentions: number; // every row in the user's data, repeats included
  totalUnique: number; // unique entries in the user's data
  rowsSent: number; // rows sent to Adaption (repeats capped, big files sampled)
  textsSent: number; // distinct texts sent
  sampled: boolean; // true when some texts were left out to keep the run short
  rowsAfter: number; // rows left after deduplication
  duplicatesRemoved: number; // rowsSent - rowsAfter
  quality: AdaptionQuality | null; // null when Adaption skipped or failed the evaluation
  creditsEstimated: number | null;
  generatedAt: string;
};

export type EstimateResponse = {
  datasetId: string;
  credits: number;
  minutes: number;
};

export type StatusResponse = {
  status: string;
  percent: number | null;
  error: string | null;
};

// What the server can tell us about a finished run. The browser adds the rest of the report.
export type AdaptionRunResult = {
  datasetId: string;
  rowsSent: number;
  rowsAfter: number;
  quality: AdaptionQuality | null;
  generatedAt: string;
};

export type ResultResponse =
  | { state: "pending" }
  | { state: "ready"; result: AdaptionRunResult; outputColumns: string[] };

// Adaption has a fixed cost of about 11 minutes per run plus about 0.7 seconds per row,
// so we keep what we send small. These two limits keep a run near 15 minutes at any file size.
export const MAX_REPEATS_SENT = 2; // each text is sent at most this many times
export const MAX_ROWS_SENT = 400; // most rows sent in one run
