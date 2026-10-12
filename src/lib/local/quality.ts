import type { Grade, QualityScore } from "../feedback-types.ts";

// Instant data-hygiene score, 0 to 10. It answers "how clean is this file?", not "how good is the feedback?".
//
// For each problem we take its share of all rows. A problem counts as fully bad once its share reaches
// the "worst" value, and it can take away at most its "weight" share of the 10 points:
//
//   problem                         weight   fully bad at
//   repeated rows                    0.30     90% of rows
//   empty or symbol/link-only rows   0.30     30% of rows
//   very short rows (under 3 words)  0.20     50% of rows
//   mostly non-letters (garbage)     0.10     30% of rows
//   very long rows (over 200 words)  0.10     20% of rows
//
//   score = 10 x (1 - sum of weight x min(1, share / worst))
//
// Grades: A 9+, B 8+, C 7+, D 6+, E 5+, otherwise F. The weights are our own judgement.
// Language mix is not scored because it cannot be checked cheaply and reliably.
export type QualitySignals = {
  rows: number; // all rows being judged
  duplicates: number; // rows that repeat an earlier row
  emptyOrJunk: number; // rows with no text, or only symbols, emoji or links
  short: number; // rows under 3 words
  garbage: number; // rows where letters are under 40% of the characters
  long: number; // rows over 200 words
};

const PROBLEMS = [
  ["duplicates", 0.3, 0.9],
  ["emptyOrJunk", 0.3, 0.3],
  ["short", 0.2, 0.5],
  ["garbage", 0.1, 0.3],
  ["long", 0.1, 0.2],
] as const;

function gradeFor(score: number): Grade {
  if (score >= 9) return "A";
  if (score >= 8) return "B";
  if (score >= 7) return "C";
  if (score >= 6) return "D";
  if (score >= 5) return "E";
  return "F";
}

export function scoreQuality(signals: QualitySignals): QualityScore {
  if (signals.rows <= 0) return { score: 0, grade: "F" };
  let penalty = 0;
  for (const [problem, weight, worst] of PROBLEMS) {
    penalty += weight * Math.min(1, signals[problem] / signals.rows / worst);
  }
  const score = Math.round((10 - 10 * penalty) * 10) / 10;
  return { score, grade: gradeFor(score) };
}
