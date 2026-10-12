// Builds the small, repeatable sample sent to Adaption (each text at most twice, up to 400 rows).
import type { FeedbackRow } from "../feedback-types.ts";
import { MAX_REPEATS_SENT, MAX_ROWS_SENT } from "./types.ts";

export type SentRow = { review: string; category: string | null; occurrences: number };

export type AdaptionSample = {
  rows: SentRow[];
  rowsSent: number;
  textsSent: number;
  sampled: boolean; // true when some texts were left out
};

// A small, repeatable random number generator, so the same data always gives the same sample.
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Decides what to send to Adaption so a run stays short:
// 1. Each text is sent at most MAX_REPEATS_SENT times, so real duplicates still exist to remove.
// 2. If that is still more than MAX_ROWS_SENT rows, take a sample that keeps every category represented.
// Repeat counts in the app are never changed. They always come from our own exact matching.
export function buildAdaptionSample(rows: FeedbackRow[]): AdaptionSample {
  const capped: SentRow[] = rows.map((r) => ({
    review: r.review,
    category: r.category,
    occurrences: Math.min(r.occurrences, MAX_REPEATS_SENT),
  }));
  const total = capped.reduce((sum, r) => sum + r.occurrences, 0);

  if (total <= MAX_ROWS_SENT) {
    return { rows: capped, rowsSent: total, textsSent: capped.length, sampled: false };
  }

  // Group by category, shuffle each group, then take one from each group in turn until the budget is used.
  const random = seededRandom(42);
  const groups = new Map<string, SentRow[]>();
  for (const row of capped) {
    const key = row.category ?? "";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const queues = [...groups.values()].map((g) => shuffle(g, random));

  const picked: SentRow[] = [];
  let used = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      while (queue.length > 0) {
        const next = queue.shift() as SentRow;
        if (used + next.occurrences <= MAX_ROWS_SENT) {
          picked.push(next);
          used += next.occurrences;
          progressed = true;
          break;
        }
      }
    }
  }

  return { rows: picked, rowsSent: used, textsSent: picked.length, sampled: picked.length < capped.length };
}
