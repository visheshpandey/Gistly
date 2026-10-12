import type { ColumnMapping } from "../csv.ts";
import type { FeedbackRow, LocalStats } from "../feedback-types.ts";
import type { FilePreview, SourceOptions, WorkerRequest, WorkerResponse } from "./messages.ts";

// Talks to the background file worker. Each call starts its own worker and stops it when done.
// Call cancel() to stop early (for example when the panel is closed).

export type ImportProgress = { phase: "reading" | "finishing"; rowsRead: number; percent: number | null };
export type ImportResult = { rows: FeedbackRow[]; stats: LocalStats };
export type ImportHandle = { promise: Promise<ImportResult>; cancel: () => void };
export type PreviewHandle = { promise: Promise<FilePreview>; cancel: () => void };

export const CANCELLED = "cancelled";

function startWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("./file.worker.ts", import.meta.url), { type: "module" });
}

const NO_WORKER = "This browser cannot read files in the background. Please try a current version of Chrome, Edge, Firefox or Safari.";

// Reads the start of a file so the user can choose which column is which.
export function startPreview(file: File, options: SourceOptions): PreviewHandle {
  const worker = startWorker();
  if (!worker) return { promise: Promise.reject(new Error(NO_WORKER)), cancel: () => {} };
  let cancel = () => {};
  const promise = new Promise<FilePreview>((resolve, reject) => {
    cancel = () => {
      worker.terminate();
      reject(new Error(CANCELLED));
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      worker.terminate();
      if (msg.type === "preview") resolve(msg.preview);
      else if (msg.type === "error") reject(new Error(msg.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(`This file could not be read${event.message ? ` (${event.message})` : ""}.`));
    };
    const request: WorkerRequest = { type: "preview", file, ...options };
    worker.postMessage(request);
  });
  return { promise, cancel };
}

// Reads the whole file, deduplicates it and scores it.
export function startLocalImport(
  file: File,
  options: SourceOptions,
  mapping: ColumnMapping,
  nearDup: boolean,
  onProgress: (progress: ImportProgress) => void,
): ImportHandle {
  const worker = startWorker();
  if (!worker) return { promise: Promise.reject(new Error(NO_WORKER)), cancel: () => {} };
  let cancel = () => {};
  const promise = new Promise<ImportResult>((resolve, reject) => {
    cancel = () => {
      worker.terminate();
      reject(new Error(CANCELLED));
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        onProgress({ phase: msg.phase, rowsRead: msg.rowsRead, percent: msg.percent });
      } else if (msg.type === "done") {
        worker.terminate();
        resolve({ rows: msg.rows, stats: msg.stats });
      } else if (msg.type === "error") {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      const detail = event.message ? ` (${event.message})` : "";
      reject(new Error(`The background import stopped unexpectedly${detail}. Please try again.`));
    };
    const request: WorkerRequest = { type: "import", file, mapping, nearDup, ...options };
    worker.postMessage(request);
  });
  return { promise, cancel };
}
