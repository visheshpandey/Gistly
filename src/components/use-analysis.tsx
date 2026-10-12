"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_UID, useFeedbackData } from "@/components/data-provider";
import { useToast } from "@/components/toast";
import { computeMetrics, type AnalysisMetrics } from "@/lib/analysis/metrics";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { FeedbackRow } from "@/lib/feedback-types";
import { getItem, putItem } from "@/lib/storage/db";

type AnalysisContextValue = {
  result: AnalysisResult | null;
  metrics: AnalysisMetrics | null;
  pending: FeedbackRow[];
  loaded: boolean;
  // Saves an analysis for a dataset. Pass the dataset the analysis was made for: the open dataset may have changed since.
  save: (result: AnalysisResult, forUid?: string) => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// One shared copy of the AI analysis of the OPEN dataset, for the whole app. Every dataset keeps its own analysis in
// the browser's database, so switching datasets never loses or mixes them. The sample also has a saved analysis that
// ships with the app, used until the user makes their own.
// An analysis belongs to a dataset by its identity, not by its size, so it keeps applying when new data is added.
// Reviews added since then have no label yet: they are listed in `pending`.
export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const { rows, uid, datasets } = useFeedbackData();
  const { notify } = useToast();
  const [saved, setSaved] = useState<AnalysisResult | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [precomputed, setPrecomputed] = useState<AnalysisResult | null>(null);
  const [precomputedDone, setPrecomputedDone] = useState(false);
  const uidRef = useRef(uid);
  const knownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    knownRef.current = new Set(datasets.map((m) => m.uid));
  }, [datasets]);

  // The analysis that ships with the sample. Fetched once.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/analysis/precomputed");
        if (res.ok && !cancelled) setPrecomputed((await res.json()) as AnalysisResult);
      } catch {
        // No saved analysis is fine. The page offers to run one.
      }
      if (!cancelled) setPrecomputedDone(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // The analysis of the open dataset, whenever a different dataset is opened.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let stored: AnalysisResult | null = null;
      if (uid) {
        try {
          stored = (await getItem<AnalysisResult>("analyses", uid)) ?? null;
        } catch {
          stored = null;
        }
      }
      if (cancelled) return;
      setSaved(stored);
      setLoadedFor(uid);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const loaded = loadedFor === uid && (uid !== SAMPLE_UID || precomputedDone);

  const result = useMemo(() => {
    if (saved && saved.datasetUid === uid) return saved;
    if (uid === SAMPLE_UID && precomputed) {
      // Only trust the saved sample analysis if every label points at a row that exists.
      const ids = new Set(rows.map((r) => r.id));
      if (precomputed.labels.every((l) => ids.has(l.id))) return { ...precomputed, datasetUid: SAMPLE_UID };
    }
    return null;
  }, [saved, precomputed, uid, rows]);

  const metrics = useMemo(() => (result ? computeMetrics(rows, result) : null), [rows, result]);
  const pending = useMemo(() => {
    if (!result) return [];
    const labelled = new Set(result.labels.map((l) => l.id));
    return rows.filter((r) => !labelled.has(r.id));
  }, [rows, result]);

  const save = (next: AnalysisResult, forUid: string = uid) => {
    // If the dataset was deleted while the analysis ran, there is nowhere to keep it.
    if (!forUid || !knownRef.current.has(forUid)) return;
    const stamped = { ...next, datasetUid: forUid };
    putItem("analyses", forUid, stamped).catch(() => {
      notify("The analysis could not be saved in your browser, so it will be lost when you close the page.", "error");
    });
    if (uidRef.current === forUid) setSaved(stamped);
  };

  return <AnalysisContext.Provider value={{ result, metrics, pending, loaded, save }}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return ctx;
}
