import type { Dataset, DatasetMeta, FeedbackRow, LocalStats } from "../feedback-types.ts";
import { deleteItem, getAll, getItem, putItem, STORE_NAMES } from "./db.ts";

// The user's shelf of datasets. A small "meta" record per dataset loads at once for the switcher; the rows load only
// for the dataset that is opened. Analyses, Adaption results and saved questions live in their own stores, keyed by
// the dataset's uid, so every dataset keeps its own.

export const MAX_DATASETS = 25;

type DatasetRecord = { uid: string; rows: FeedbackRow[]; context: string; stats: LocalStats | null };

export function metaOf(d: Dataset): DatasetMeta {
  let mentions = 0;
  let hasDates = false;
  let hasCategory = false;
  for (const r of d.rows) {
    mentions += r.occurrences;
    if (r.date) hasDates = true;
    if (r.category) hasCategory = true;
  }
  return {
    uid: d.uid,
    name: d.label,
    source: d.source,
    fileName: d.fileName,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    uniqueEntries: d.rows.length,
    mentions,
    hasDates,
    hasCategory,
  };
}

function isMeta(v: unknown): v is DatasetMeta {
  const m = v as Partial<DatasetMeta> | null;
  return !!m && typeof m.uid === "string" && typeof m.name === "string" && typeof m.updatedAt === "string" && typeof m.uniqueEntries === "number";
}

function isRecord(v: unknown): v is DatasetRecord {
  const r = v as Partial<DatasetRecord> | null;
  return !!r && typeof r.uid === "string" && Array.isArray(r.rows);
}

// Most recently changed first.
export async function listMeta(): Promise<DatasetMeta[]> {
  const all = await getAll<unknown>("meta");
  return all.filter(isMeta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveMeta(meta: DatasetMeta): Promise<void> {
  await putItem("meta", meta.uid, meta);
}

// Saves the rows first and the meta second, so the shelf never lists a dataset whose rows are missing.
export async function saveDataset(d: Dataset): Promise<void> {
  const record: DatasetRecord = { uid: d.uid, rows: d.rows, context: d.context, stats: d.stats };
  await putItem("datasets", d.uid, record);
  await saveMeta(metaOf(d));
}

export async function loadDataset(uid: string): Promise<Dataset | null> {
  const [record, meta] = await Promise.all([getItem<unknown>("datasets", uid), getItem<unknown>("meta", uid)]);
  if (!isRecord(record) || !isMeta(meta)) return null;
  return {
    uid,
    rows: record.rows,
    label: meta.name,
    context: typeof record.context === "string" ? record.context : "",
    stats: record.stats ?? null,
    source: meta.source,
    fileName: meta.fileName ?? null,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

// Deletes the dataset and everything that belongs to it.
export async function removeDataset(uid: string): Promise<void> {
  for (const store of STORE_NAMES) await deleteItem(store, uid);
}

// "Reviews" becomes "Reviews (2)" if that name is taken, so two datasets are never confused.
export function uniqueName(wanted: string, existing: string[]): string {
  const base = wanted.trim().replace(/\s+/g, " ").slice(0, 80) || "Untitled dataset";
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})`;
}
