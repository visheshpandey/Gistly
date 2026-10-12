import type { Sentiment } from "../analysis/types.ts";

// "Ask a question" works in three steps so the AI never makes up numbers:
//  1. The AI turns the question into a plan (which feedback to look at).
//  2. Verdict works out the real numbers for that plan from the labelled feedback.
//  3. The AI explains those numbers in plain words, and every figure it quotes is checked against them.

export type AskFocus = "overview" | "problems" | "strengths" | "compare" | "examples" | "trend";
export type CompareBy = "theme" | "category" | "none";

export type AskPlan = {
  inScope: boolean; // false when the question is not about the feedback
  focus: AskFocus;
  sentiment: Sentiment | "any";
  theme: string; // "" when the question does not name a theme
  category: string; // "" when the question does not name a category
  keywords: string[]; // words to look for in the review text, lowercase
  compareBy: CompareBy;
  from: string; // YYYY-MM-DD or ""
  to: string; // YYYY-MM-DD or ""
};

export type AskContext = {
  themes: string[];
  categories: string[];
  hasDates: boolean;
  dateRange: { from: string; to: string } | null;
  today: string; // YYYY-MM-DD, so the AI can read "last month"
};

// Every number the AI is allowed to quote. Built from the labelled feedback, never by the AI.
export type AskFacts = {
  scope: string; // the selection in words, for example: negative feedback about "Delivery And Shipping"
  relaxedNote: string; // "" normally. Says which conditions were dropped because nothing matched all of them
  allMentions: number;
  matchedMentions: number;
  matchedUniqueReviews: number;
  matchedShareOfAll: string; // "25.1%"
  sentiment: { positive: string; neutral: string; negative: string; positiveMentions: number; neutralMentions: number; negativeMentions: number };
  criticalMentions: number;
  topThemes: { theme: string; mentions: number; shareOfSelection: string; negativeShare: string }[];
  topIssues: { issue: string; mentions: number }[];
  comparison: {
    by: string;
    // Worked out by code, so the AI never has to find the biggest or smallest value itself.
    leaders: { mostNegativeMentions: string; highestNegativeShare: string; highestPositiveShare: string };
    rows: { name: string; mentions: number; negativeMentions: number; negativeShare: string; positiveShare: string }[];
  } | null;
  trend: { period: string; mentions: number; negativeShare: string }[] | null;
  quotes: { text: string; receivedTimes: number; sentiment: string }[];
  coverageNote: string;
};

export type AskResult = {
  question: string;
  plan: AskPlan;
  facts: AskFacts | null; // null when the question was not about the feedback
  answer: string;
  unverifiedNumbers: string[]; // figures in the answer that are not in the facts
};

export const MAX_QUESTION_CHARS = 300;
export const SUGGESTED_QUESTIONS = [
  "What are customers most unhappy about?",
  "What do customers like most?",
  "Which category has the most problems?",
  "What should we fix first, and why?",
  "What do customers say about refunds?",
];
