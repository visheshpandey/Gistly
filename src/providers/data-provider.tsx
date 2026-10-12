"use client";

// Shared state: the shelf of datasets in IndexedDB and the one that is open.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addRecord, mergeRows } from "@/lib/dedupe";
import {
  summarize,
  type Dataset,
  type DatasetMeta,
  type DatasetSummary,
  type FeedbackRow,
  type LocalStats,
  type SourceKind,
} from "@/lib/feedback-types";
import { persistenceMode, type Persistence } from "@/lib/storage/db";
import { MAX_DATASETS, listMeta, loadDataset, metaOf, removeDataset, saveDataset, saveMeta, uniqueName } from "@/lib/storage/library";
import { ACTIVE_KEY, SEEDED_KEY, migrateLegacy } from "@/lib/storage/migrate";

// Verdict keeps a shelf of datasets in the browser's database (IndexedDB). One is open at a time.
// Everything else in the app reads the open dataset from here, so switching datasets switches every page.
export const SAMPLE_LABEL = "Sample dataset";
export const SAMPLE_UID = "sample";

const SAVE_WARNING =
  "This dataset could not be saved in your browser (its storage may be full). It will be lost when you close the page.";

type State = {
  status: "loading" | "ready" | "error";
  error: string | null; // blocking error: nothing can be shown
  actionError: string | null; // a failed action while the app is still usable
  datasets: DatasetMeta[]; // the shelf, most recently changed first
  dataset: Dataset | null; // the open dataset (null when the shelf is empty)
  saveWarning: string | null;
  persistence: Persistence;
};

export type NewDatasetInput = {
  name: string;
  rows: FeedbackRow[];
  context: string;
  stats: LocalStats | null;
  source: SourceKind;
  fileName: string | null;
};

type DataContextValue = {
  status: State["status"];
  error: string | null;
  actionError: string | null;
  saveWarning: string | null;
  persistence: Persistence;
  // the open dataset
  uid: string;
  label: string;
  context: string;
  stats: LocalStats | null;
  rows: FeedbackRow[];
  summary: DatasetSummary;
  source: SourceKind | null;
  importCount: number; // goes up by one after every file import (not after a hand-typed review)
  // the shelf
  datasets: DatasetMeta[];
  switchDataset: (uid: string) => Promise<void>;
  createDataset: (input: NewDatasetInput) => string | null; // returns the new dataset's uid, or null if the shelf is full
  renameDataset: (uid: string, name: string) => Promise<void>;
  deleteDataset: (uid: string) => Promise<void>;
  loadSample: () => Promise<void>;
  resetSample: () => Promise<void>;
  // changing the open dataset
  mergeDataset: (rows: FeedbackRow[], stats: LocalStats | null) => void;
  addFeedback: (review: string, category: string) => void;
};

const DataContext = createContext<DataContextValue | null>(null);

function newUid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readActive(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActive(uid: string | null) {
  try {
    if (uid) window.localStorage.setItem(ACTIVE_KEY, uid);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Storage can be blocked. The app still works for this visit.
  }
}

function flag(key: string, set?: boolean): boolean {
  try {
    if (set) window.localStorage.setItem(key, "1");
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function upsertMeta(list: DatasetMeta[], meta: DatasetMeta): DatasetMeta[] {
  return [...list.filter((m) => m.uid !== meta.uid), meta].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isStats(value: unknown): value is LocalStats {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<LocalStats>;
  return typeof s.rowsRead === "number" && typeof s.uniqueEntries === "number" && !!s.before && !!s.after && !!s.timings;
}

async function fetchSample(): Promise<Dataset> {
  let res: Response;
  try {
    res = await fetch("/api/sample");
  } catch {
    throw new Error("Could not reach the server to load the sample dataset.");
  }
  const body = (await res.json().catch(() => null)) as
    | { rows?: FeedbackRow[]; stats?: LocalStats; error?: string }
    | null;
  if (!res.ok || !body || !Array.isArray(body.rows)) {
    throw new Error(body?.error ?? "Could not load the sample dataset.");
  }
  const now = new Date().toISOString();
  return {
    uid: SAMPLE_UID,
    rows: body.rows,
    label: SAMPLE_LABEL,
    context: "",
    stats: isStats(body.stats) ? body.stats : null,
    source: "sample",
    fileName: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Combines the numbers of two imports. The quality scores describe the latest file added.
function mergeStats(prev: LocalStats | null, next: LocalStats | null, rows: FeedbackRow[]): LocalStats | null {
  if (!next) return prev;
  if (!prev) return next;
  const rowsKept = prev.rowsKept + next.rowsKept;
  return {
    ...next,
    rowsRead: prev.rowsRead + next.rowsRead,
    rowsKept,
    emptyRows: prev.emptyRows + next.emptyRows,
    junkRows: prev.junkRows + next.junkRows,
    overflowRows: prev.overflowRows + next.overflowRows,
    uniqueEntries: rows.length,
    duplicatesRemoved: rowsKept - rows.length,
    nearDupMerged: prev.nearDupMerged + next.nearDupMerged,
  };
}

type Boot = { datasets: DatasetMeta[]; dataset: Dataset | null; persistence: Persistence; problem: string | null };

// Starting up: move any data from an older version, read the shelf, and open a dataset. It runs once per page load,
// even when React starts the provider twice in development.
async function doBoot(): Promise<Boot> {
  let problem: string | null = null;
  try {
    await migrateLegacy(window.localStorage);
  } catch {
    // Migration is best effort and never blocks the app.
  }
  let datasets = await listMeta();
  let seeded: Dataset | null = null;

  // The very first visit: put the sample on the shelf so the app is useful straight away.
  if (datasets.length === 0 && !flag(SEEDED_KEY)) {
    try {
      seeded = await fetchSample();
      try {
        await saveDataset(seeded);
      } catch {
        // It stays in memory for this visit.
      }
      datasets = [metaOf(seeded)];
      flag(SEEDED_KEY, true);
    } catch (e) {
      problem = messageOf(e);
    }
  }

  // Open the dataset that was open last time, otherwise the most recent one. Skip any that cannot be read.
  const wanted = readActive();
  const order = [...datasets].sort((a, b) => (a.uid === wanted ? -1 : b.uid === wanted ? 1 : 0));
  let dataset: Dataset | null = null;
  for (const meta of order) {
    dataset = seeded && seeded.uid === meta.uid ? seeded : await loadDataset(meta.uid).catch(() => null);
    if (dataset) break;
    datasets = datasets.filter((m) => m.uid !== meta.uid);
    void removeDataset(meta.uid).catch(() => {});
  }
  writeActive(dataset ? dataset.uid : null);
  return { datasets, dataset, persistence: await persistenceMode(), problem };
}

let bootPromise: Promise<Boot> | null = null;
function bootOnce(): Promise<Boot> {
  bootPromise ??= doBoot();
  return bootPromise;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({
    status: "loading",
    error: null,
    actionError: null,
    datasets: [],
    dataset: null,
    saveWarning: null,
    persistence: "indexeddb",
  });
  const [importCount, setImportCount] = useState(0);
  const switchTicket = useRef(0);

  useEffect(() => {
    let cancelled = false;
    bootOnce().then(
      (b) => {
        if (cancelled) return;
        setState({
          status: "ready",
          error: null,
          actionError: b.problem,
          datasets: b.datasets,
          dataset: b.dataset,
          saveWarning: null,
          persistence: b.persistence,
        });
      },
      (e) => {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: messageOf(e) }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Saves in the background. If the browser refuses (storage full), the user is told, and the app keeps working.
  const persist = (d: Dataset) => {
    saveDataset(d).then(
      () => setState((s) => (s.saveWarning ? { ...s, saveWarning: null } : s)),
      () => setState((s) => ({ ...s, saveWarning: SAVE_WARNING })),
    );
  };

  // Shows a changed dataset straight away, then saves it.
  const commit = (next: Dataset) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setState((s) => ({
      ...s,
      status: "ready",
      error: null,
      actionError: null,
      dataset: stamped,
      datasets: upsertMeta(s.datasets, metaOf(stamped)),
    }));
    persist(stamped);
  };

  const switchDataset = async (uid: string) => {
    if (uid === state.dataset?.uid) return;
    const ticket = ++switchTicket.current;
    setState((s) => ({ ...s, status: "loading", actionError: null }));
    let next: Dataset | null = null;
    try {
      next = await loadDataset(uid);
    } catch {
      next = null;
    }
    if (ticket !== switchTicket.current) return; // the user picked something else meanwhile
    if (!next) {
      setState((s) => ({
        ...s,
        status: "ready",
        datasets: s.datasets.filter((m) => m.uid !== uid),
        actionError: "That dataset could not be opened, so it was removed from your list.",
      }));
      void removeDataset(uid).catch(() => {});
      return;
    }
    writeActive(uid);
    setState((s) => ({ ...s, status: "ready", dataset: next, saveWarning: null }));
  };

  // Puts a brand-new dataset on the shelf and opens it. Nothing that is already there is touched.
  const createDataset = (input: NewDatasetInput): string | null => {
    if (state.datasets.length >= MAX_DATASETS) {
      setState((s) => ({ ...s, actionError: `You can keep up to ${MAX_DATASETS} datasets. Delete one you no longer need first.` }));
      return null;
    }
    const now = new Date().toISOString();
    const dataset: Dataset = {
      uid: newUid(),
      rows: input.rows,
      label: uniqueName(input.name, state.datasets.map((m) => m.name)),
      context: input.context,
      stats: input.stats,
      source: input.source,
      fileName: input.fileName,
      createdAt: now,
      updatedAt: now,
    };
    commit(dataset);
    writeActive(dataset.uid);
    setImportCount((n) => n + 1);
    return dataset.uid;
  };

  // Adding data keeps the dataset and the ids of its rows, so earlier AI labels still apply.
  const mergeDataset = (incoming: FeedbackRow[], incomingStats: LocalStats | null) => {
    const current = state.dataset;
    if (!current) return;
    const rows = mergeRows(current.rows, incoming);
    commit({ ...current, rows, stats: mergeStats(current.stats, incomingStats, rows) });
    setImportCount((n) => n + 1);
  };

  const addFeedback = (review: string, category: string) => {
    const current = state.dataset;
    if (!current) return;
    const rows = addRecord(current.rows, { review, category });
    // Keep the import numbers in step with the new row. The quality scores describe the original import.
    const stats = current.stats
      ? {
          ...current.stats,
          rowsRead: current.stats.rowsRead + 1,
          rowsKept: current.stats.rowsKept + 1,
          uniqueEntries: rows.length,
          duplicatesRemoved: current.stats.rowsKept + 1 - rows.length,
        }
      : null;
    commit({ ...current, rows, stats });
  };

  const renameDataset = async (uid: string, name: string) => {
    const meta = state.datasets.find((m) => m.uid === uid);
    if (!meta) return;
    const finalName = uniqueName(name, state.datasets.filter((m) => m.uid !== uid).map((m) => m.name));
    const next = { ...meta, name: finalName };
    try {
      await saveMeta(next);
    } catch {
      setState((s) => ({ ...s, actionError: "The new name could not be saved." }));
      return;
    }
    setState((s) => ({
      ...s,
      datasets: upsertMeta(s.datasets, next),
      dataset: s.dataset && s.dataset.uid === uid ? { ...s.dataset, label: finalName } : s.dataset,
    }));
  };

  // Deletes a dataset and everything that belongs to it (analysis, Adaption result, saved questions).
  const deleteDataset = async (uid: string) => {
    try {
      await removeDataset(uid);
    } catch {
      setState((s) => ({ ...s, actionError: "That dataset could not be deleted. Please try again." }));
      return;
    }
    const remaining = state.datasets.filter((m) => m.uid !== uid);
    if (state.dataset?.uid !== uid) {
      setState((s) => ({ ...s, datasets: remaining }));
      return;
    }
    // The open dataset was deleted: open the most recent one that is left, or show the empty state.
    let next: Dataset | null = null;
    let usable = remaining;
    for (const meta of remaining) {
      next = await loadDataset(meta.uid).catch(() => null);
      if (next) break;
      usable = usable.filter((m) => m.uid !== meta.uid);
    }
    writeActive(next ? next.uid : null);
    setState((s) => ({ ...s, status: "ready", datasets: usable, dataset: next, actionError: null }));
  };

  // Opens the built-in sample, putting it back on the shelf first if it was deleted.
  const loadSample = async () => {
    if (state.datasets.some((m) => m.uid === SAMPLE_UID)) {
      await switchDataset(SAMPLE_UID);
      return;
    }
    const hadData = state.dataset !== null;
    if (!hadData) setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const sample = await fetchSample();
      commit(sample);
      writeActive(sample.uid);
      flag(SEEDED_KEY, true);
    } catch (e) {
      setState((s) => ({ ...s, status: "ready", actionError: messageOf(e) }));
    }
  };

  // Puts the sample back exactly as it came, throwing away anything that was added to it.
  const resetSample = async () => {
    try {
      const sample = await fetchSample();
      const existing = state.datasets.find((m) => m.uid === SAMPLE_UID);
      await removeDataset(SAMPLE_UID);
      commit({ ...sample, label: existing?.name ?? SAMPLE_LABEL });
      writeActive(SAMPLE_UID);
    } catch (e) {
      setState((s) => ({ ...s, actionError: messageOf(e) }));
    }
  };

  const rows = state.dataset?.rows;
  const summary = useMemo(() => summarize(rows ?? []), [rows]);

  const value: DataContextValue = {
    status: state.status,
    error: state.error,
    actionError: state.actionError,
    saveWarning: state.saveWarning,
    persistence: state.persistence,
    uid: state.dataset?.uid ?? "",
    label: state.dataset?.label ?? "",
    context: state.dataset?.context ?? "",
    stats: state.dataset?.stats ?? null,
    rows: rows ?? [],
    summary,
    source: state.dataset?.source ?? null,
    importCount,
    datasets: state.datasets,
    switchDataset,
    createDataset,
    renameDataset,
    deleteDataset,
    loadSample,
    resetSample,
    mergeDataset,
    addFeedback,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useFeedbackData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useFeedbackData must be used inside DataProvider");
  return ctx;
}
