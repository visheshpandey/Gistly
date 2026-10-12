// Rough keyword match, labeled "estimated" in the UI.
// Replaced by AI sentiment in a later milestone. Never derived from `category`.
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
