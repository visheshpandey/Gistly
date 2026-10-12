import type { Dataset, FeedbackRow, LocalStats } from "../feedback-types.ts";
import { putItem } from "./db.ts";
import { saveDataset } from "./library.ts";

// Earlier versions of InsightFlow kept ONE dataset (plus its analysis and Adaption result) in localStorage.
// This moves that into the new shelf once, so nobody loses what they had. It never throws: if something is odd
// it simply skips it.

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DONE_KEY = "insightflow:migrated:v2";
const OLD_DATASET = "insightflow:dataset:v2";
const OLD_ANALYSIS = "insightflow:analysis:v2";
const OLD_ADAPTION = "insightflow:adaption-report:v3";
export const ACTIVE_KEY = "insightflow:active:v1";
export const SEEDED_KEY = "insightflow:seeded:v1";

function readJson(store: Store, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function isRow(v: unknown): v is FeedbackRow {
  const r = v as Partial<FeedbackRow> | null;
  return !!r && typeof r.id === "number" && typeof r.review === "string" && typeof r.occurrences === "number";
}

export async function migrateLegacy(store: Store): Promise<{ moved: boolean }> {
  try {
    if (store.getItem(DONE_KEY)) return { moved: false };
    const old = readJson(store, OLD_DATASET) as
      | { uid?: string; rows?: unknown[]; label?: string; context?: string; stats?: LocalStats | null }
      | null;
    if (!old || typeof old.uid !== "string" || !Array.isArray(old.rows) || old.rows.length === 0 || !old.rows.every(isRow)) {
      store.setItem(DONE_KEY, "1");
      return { moved: false };
    }
    const now = new Date().toISOString();
    const isSample = old.uid === "sample";
    const dataset: Dataset = {
      uid: old.uid,
      rows: old.rows as FeedbackRow[],
      label: typeof old.label === "string" && old.label ? old.label : isSample ? "Sample dataset" : "My dataset",
      context: typeof old.context === "string" ? old.context : "",
      stats: old.stats ?? null,
      source: isSample ? "sample" : "file",
      fileName: null,
      createdAt: now,
      updatedAt: now,
    };
    await saveDataset(dataset);

    const analysis = readJson(store, OLD_ANALYSIS) as { datasetUid?: string } | null;
    if (analysis && analysis.datasetUid === old.uid) await putItem("analyses", old.uid, analysis);
    const adaption = readJson(store, OLD_ADAPTION) as { datasetUid?: string } | null;
    if (adaption && adaption.datasetUid === old.uid) await putItem("adaption", old.uid, adaption);

    // The old data is safely in the new place, so free the space and remember that this has been done.
    if (!store.getItem(ACTIVE_KEY)) store.setItem(ACTIVE_KEY, old.uid);
    store.setItem(SEEDED_KEY, "1");
    store.setItem(DONE_KEY, "1");
    store.removeItem(OLD_DATASET);
    store.removeItem(OLD_ANALYSIS);
    store.removeItem(OLD_ADAPTION);
    return { moved: true };
  } catch {
    return { moved: false };
  }
}
