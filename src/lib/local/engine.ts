import type { FeedbackRow, LocalStats } from "../feedback-types.ts";
import { findNearDuplicates } from "./minhash.ts";
import { countWords, normalizeText } from "./normalize.ts";
import { scoreQuality } from "./quality.ts";

// Streaming deduplicator. Feed it one row at a time with addRow(), then call finish().
// It never keeps the raw file in memory, only the unique entries and a bounded cache of seen texts.
// This file has no browser or Node specific code, so the worker, the server and the benchmark all use it.

const SHORT_WORDS = 3; // rows under this many words count as "very short"
const LONG_WORDS = 200; // rows over this many words count as "very long"
const GARBAGE_LETTER_SHARE = 0.4; // rows with fewer letters than this share of characters are "garbage"
const RAW_CACHE_LIMIT = 300_000; // most distinct raw texts remembered (bounds memory)

export const DEFAULT_MAX_ENTRIES = 200_000;
export const NEAR_DUP_BUDGET_MS = 20_000;

const SHORT = 1;
const LONG = 2;
const GARBAGE = 4;

type Entry = {
  id: number;
  category: string | null;
  date: string | null;
  norm: string; // normalized text, the comparison key
  text: string; // the most common original wording
  textCount: number; // how often that wording appeared
  count: number; // all rows that merged into this entry
  flags: number; // quality flags of the first wording seen
};

// Remembers what we worked out for an exact raw text, so repeats of it skip the slow normalization.
type RawInfo = { entry: Entry | null; flags: number; n: number };

export type EngineOptions = {
  nearDup: boolean; // also merge near-duplicate wording (MinHash)
  maxEntries?: number; // stop adding new unique entries beyond this (default 200,000)
  nearDupDeadline?: number; // performance.now() value after which the near-duplicate pass gives up
};

export type FinishResult = {
  rows: FeedbackRow[];
  stats: LocalStats; // timings.parseMs is filled in by the caller via withTimings()
  finishMs: number;
};

function flagsFor(raw: string, norm: string): number {
  let flags = 0;
  const words = countWords(norm);
  if (words < SHORT_WORDS) flags |= SHORT;
  if (words > LONG_WORDS) flags |= LONG;
  const visible = raw.replace(/\s/g, "").length;
  const letters = raw.replace(/[^\p{L}]/gu, "").length;
  if (visible > 0 && letters / visible < GARBAGE_LETTER_SHARE) flags |= GARBAGE;
  return flags;
}

export class DedupeEngine {
  private entries = new Map<string, Entry>();
  private raw = new Map<string, RawInfo>();
  private maxEntries: number;
  private nearDup: boolean;
  private nearDupDeadline: number;

  rowsRead = 0;
  private emptyRows = 0;
  private junkRows = 0;
  private overflowRows = 0;
  private shortRows = 0;
  private longRows = 0;
  private garbageRows = 0;

  constructor(options: EngineOptions) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.nearDup = options.nearDup;
    this.nearDupDeadline = options.nearDupDeadline ?? performance.now() + NEAR_DUP_BUDGET_MS;
  }

  addRow(text: string, category: string | null, date: string | null): void {
    this.rowsRead += 1;
    const t = text.trim();
    if (t === "") {
      this.emptyRows += 1;
      return;
    }
    const cat = category === "" ? null : category;
    const rawKey = `${cat ?? ""}\u0000${date ?? ""}\u0000${t}`;

    let info = this.raw.get(rawKey);
    if (!info) {
      const norm = normalizeText(t);
      if (norm === "") {
        info = { entry: null, flags: 0, n: 0 };
      } else {
        const key = `${cat ?? ""}\u0000${date ?? ""}\u0000${norm}`;
        let entry = this.entries.get(key);
        if (!entry) {
          if (this.entries.size >= this.maxEntries) {
            this.overflowRows += 1;
            return;
          }
          entry = {
            id: this.entries.size + 1,
            category: cat,
            date,
            norm,
            text: t,
            textCount: 0,
            count: 0,
            flags: flagsFor(t, norm),
          };
          this.entries.set(key, entry);
        }
        info = { entry, flags: entry.flags, n: 0 };
      }
      if (this.raw.size < RAW_CACHE_LIMIT) this.raw.set(rawKey, info);
    }

    const entry = info.entry;
    if (!entry) {
      this.junkRows += 1;
      return;
    }
    info.n += 1;
    entry.count += 1;
    if (info.n > entry.textCount) {
      entry.textCount = info.n;
      entry.text = t; // keep the most common wording as the display text
    }
    if (info.flags & SHORT) this.shortRows += 1;
    if (info.flags & LONG) this.longRows += 1;
    if (info.flags & GARBAGE) this.garbageRows += 1;
  }

  finish(): FinishResult {
    const started = performance.now();
    let list = [...this.entries.values()];
    const exactUnique = list.length;
    const rowsKept = this.rowsRead - this.emptyRows - this.junkRows - this.overflowRows;
    let nearDupStatus: LocalStats["nearDup"] = "off";

    if (this.nearDup) {
      const merged = this.mergeNearDuplicates(list);
      if (merged) {
        list = merged;
        nearDupStatus = "done";
      } else {
        nearDupStatus = "skipped";
      }
    }
    const dedupeMs = performance.now() - started;

    const scoreStarted = performance.now();
    const rowsConsidered = this.rowsRead - this.overflowRows;
    const before = scoreQuality({
      rows: rowsConsidered,
      duplicates: rowsKept - exactUnique,
      emptyOrJunk: this.emptyRows + this.junkRows,
      short: this.shortRows,
      garbage: this.garbageRows,
      long: this.longRows,
    });
    let short = 0;
    let long = 0;
    let garbage = 0;
    for (const e of list) {
      if (e.flags & SHORT) short += 1;
      if (e.flags & LONG) long += 1;
      if (e.flags & GARBAGE) garbage += 1;
    }
    const after = scoreQuality({ rows: list.length, duplicates: 0, emptyOrJunk: 0, short, garbage, long });
    const scoreMs = performance.now() - scoreStarted;

    const rows: FeedbackRow[] = list.map((e, i) => ({
      id: i + 1,
      review: e.text,
      category: e.category,
      date: e.date,
      occurrences: e.count,
    }));

    const finishMs = performance.now() - started;
    return {
      rows,
      finishMs,
      stats: {
        rowsRead: this.rowsRead,
        rowsKept,
        emptyRows: this.emptyRows,
        junkRows: this.junkRows,
        overflowRows: this.overflowRows,
        uniqueEntries: list.length,
        duplicatesRemoved: rowsKept - list.length,
        nearDupMerged: exactUnique - list.length,
        nearDup: nearDupStatus,
        before,
        after,
        timings: { parseMs: 0, dedupeMs, scoreMs, totalMs: 0 },
      },
    };
  }

  // Merges entries with nearly the same wording, only inside the same category and date.
  // Returns null if it ran out of time, in which case nothing is merged.
  private mergeNearDuplicates(list: Entry[]): Entry[] | null {
    const groups = new Map<string, Entry[]>();
    for (const e of list) {
      const key = `${e.category ?? ""}\u0000${e.date ?? ""}`;
      const g = groups.get(key);
      if (g) g.push(e);
      else groups.set(key, [e]);
    }

    const removed = new Set<Entry>();
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const roots = findNearDuplicates(
        group.map((e) => e.norm),
        this.nearDupDeadline,
      );
      if (!roots) return null;
      const best = new Map<number, Entry>(); // the entry with most rows represents its cluster
      group.forEach((e, i) => {
        const current = best.get(roots[i]);
        if (!current || e.count > current.count) best.set(roots[i], e);
      });
      group.forEach((e, i) => {
        const rep = best.get(roots[i]) as Entry;
        if (rep !== e) {
          rep.count += e.count;
          removed.add(e);
        }
      });
    }
    return list.filter((e) => !removed.has(e));
  }
}

// Fills in the timings once the caller knows how long reading and feeding took.
// readFeedMs = total time spent in the feeder (CSV rows -> engine), totalMs = wall time of the whole import.
export function withTimings(result: FinishResult, feedMs: number, totalMs: number): LocalStats {
  const t = result.stats.timings;
  return {
    ...result.stats,
    timings: {
      parseMs: Math.max(0, totalMs - feedMs - result.finishMs),
      dedupeMs: feedMs + t.dedupeMs,
      scoreMs: t.scoreMs,
      totalMs,
    },
  };
}
