import type { IssueStatus } from "../issues/types.ts";

// Everything a report needs, in one small object. A report never reads live data, so a saved copy or a
// shared link always shows exactly what was true when it was made.
export type ReportPriority = {
  rank: number;
  theme: string;
  score: number; // 0 to 100
  mentions: number;
  frequency: number; // 0 to 1
  negativeShare: number; // 0 to 1
  avgSeverity: number; // 1 to 5
  why: string;
  action: string; // may be empty
  topIssues: { issue: string; mentions: number }[];
  quote: string; // may be empty
};

export type ReportData = {
  version: 1;
  title: string;
  generatedAt: string;
  datasetLabel: string;
  model: string;
  kpis: {
    totalMentions: number;
    uniqueReviews: number;
    positive: number; // shares, 0 to 1
    neutral: number;
    negative: number;
    netSentiment: number; // points, -100 to 100
    critical: number; // mentions
  };
  summary: string;
  priorities: ReportPriority[];
  strengths: { theme: string; positiveShare: number; mentions: number; topPoint: string }[];
  themes: { theme: string; mentions: number; share: number; negativeShare: number }[];
  issues: { title: string; theme: string; status: IssueStatus; note: string }[];
};
