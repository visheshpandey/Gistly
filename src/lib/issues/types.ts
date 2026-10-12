// Tracked issue types and statuses.
export type IssueStatus = "open" | "in_progress" | "resolved";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const STATUSES: IssueStatus[] = ["open", "in_progress", "resolved"];

// A problem the team decided to work on. The numbers are a snapshot from the day it was saved,
// so you can compare them with today's numbers and see whether the fix worked.
export type Issue = {
  id: string;
  datasetUid: string; // which dataset it was saved from
  theme: string;
  title: string;
  action: string; // the suggested action at the time (may be empty)
  note: string; // free text the team writes
  status: IssueStatus;
  snapshot: { priorityScore: number; mentions: number; negativeShare: number; avgSeverity: number };
  createdAt: string;
  updatedAt: string;
};
