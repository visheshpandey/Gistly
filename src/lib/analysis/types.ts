// Shared by the server routes and the browser. Contains no secrets.

export type Sentiment = "positive" | "neutral" | "negative";
export type Kind = "complaint" | "praise" | "suggestion" | "question";

export const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];
export const KINDS: Kind[] = ["complaint", "praise", "suggestion", "question"];

// Used when a review fits none of the proposed themes.
export const OTHER_THEME = "Other";

// What the AI decided about one unique review. Counts and percentages are never written by the AI:
// they are worked out from these labels in metrics.ts.
export type ReviewLabel = {
  id: number; // matches FeedbackRow.id
  sentiment: Sentiment; // judged from the text only, never from the category
  theme: string; // one of AnalysisResult.themes, or "Other"
  severity: number; // 1 (praise or trivial) to 5 (serious harm)
  keyIssue: string; // 3 to 6 words
  kind: Kind;
};

export type AnalysisResult = {
  source: "gemini" | "precomputed";
  model: string;
  datasetUid?: string; // which dataset this analysis belongs to (set when it is saved in the browser)
  datasetLabel: string; // which dataset this describes
  context: string; // the "what is this feedback about" line used
  totalMentions: number; // all rows in the dataset, repeats included
  totalUnique: number; // unique entries in the dataset
  analysedTexts: number; // unique entries sent to the AI
  truncated: boolean; // true when the dataset had more entries than we analyse
  failedTexts: number; // entries the AI could not label
  themes: string[];
  labels: ReviewLabel[];
  // One suggested action per top problem theme, written by the AI from the numbers. Missing if that step failed.
  actions?: Record<string, string>;
  generatedAt: string;
};

export type ThemesResponse = { themes: string[]; model: string };
export type LabelResponse = { labels: ReviewLabel[]; model: string };

// What we tell the AI about one problem theme when asking for an action. All numbers come from metrics.ts.
export type ActionRequestItem = {
  theme: string;
  mentions: number;
  negativeShare: number;
  avgSeverity: number;
  topIssues: string[];
  quotes: string[];
};
export type ActionsResponse = { actions: Record<string, string>; model: string };
export const MAX_ACTION_THEMES = 6;

// The AI call is one request per batch, so each request stays short on any host.
export const MAX_ANALYSED = 2000; // most unique entries we label in one analysis
export const BATCH_SIZE = 30;
export const THEME_SAMPLE_SIZE = 100;
export const MAX_TEXT_CHARS = 600;
