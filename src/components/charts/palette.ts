import type { Kind, Sentiment } from "@/lib/analysis/types";

// The colours that carry meaning in every chart, in one place. They are CSS variables from globals.css,
// so they follow the light and dark theme by themselves.

export const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "var(--pos)",
  neutral: "var(--neu)",
  negative: "var(--neg)",
};

// Severity 1 (minor) to 5 (severe): sand, mustard, rose, red, ink.
export const SEVERITY_SCALE = ["var(--neu)", "var(--p3)", "var(--p4)", "var(--neg)", "var(--p1)"];

export const KIND_COLOR: Record<Kind, string> = {
  complaint: "var(--neg)",
  praise: "var(--pos)",
  suggestion: "var(--p2)",
  question: "var(--p3)",
};
