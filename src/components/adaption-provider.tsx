"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_UID, useFeedbackData } from "@/components/data-provider";
import { useToast } from "@/components/toast";
import { fingerprint } from "@/lib/adaption/hash";
import { buildAdaptionSample } from "@/lib/adaption/sampling";
import type { AdaptionReport, EstimateResponse, ResultResponse, StatusResponse } from "@/lib/adaption/types";
import { getItem, putItem } from "@/lib/storage/db";

// One manager for Adaption verification, living above every page. A run keeps going while you move around the app
// (even to another dataset), and the rest of InsightFlow never waits for it. It can start by itself after an upload,
// but only if the user turned that on, and only when the server's own cost estimate is within the credit limit the
// user set. Every dataset keeps its own result.
const JOB_KEY = "insightflow:adaption-job:v3";
const CACHE_KEY = "insightflow:adaption-cache:v1";
const CONSENT_KEY = "insightflow:adaption-consent:v1";
const CACHE_LIMIT = 20;
const MAX_RUN_WAIT_MS = 2 * 60 * 60 * 1000;
const HIGHLIGHT_MS = 4000;
export const DEFAULT_CAP = 10;

export type Consent = { enabled: boolean; cap: number };
type SentInfo = { rowsSent: number; textsSent: number; sampled: boolean };
type CoreReport = Omit<AdaptionReport, "datasetUid" | "fromCache">;

// The dataset a check is about, captured when it starts, so it is saved to the right place even if the user moves on.
type Snap = { uid: string; label: string; totalMentions: number; totalUnique: number };

export type AdaptionJob =
  | { phase: "idle" }
  | { phase: "preparing"; message: string; snap: Snap }
  | ({ phase: "estimated"; datasetId: string; credits: number; minutes: number; hash: string; overCap: boolean; snap: Snap } & SentInfo)
  | { phase: "running"; percent: number | null; statusText: string; startedAt: number; snap: Snap }
  | { phase: "error"; message: string; code: string; snap: Snap | null };

// Remembered so a run can be picked up again after the page is reloaded.
type StoredJob = SentInfo & {
  datasetId: string;
  credits: number;
  hash: string;
  uid: string;
  label: string;
  totalMentions: number;
  totalUnique: number;
  startedAt: number;
};

type AdaptionContextValue = {
  report: AdaptionReport | null; // the open dataset's result
  job: AdaptionJob; // what is going on for the open dataset
  runningElsewhere: Snap | null; // a check that is running for a different dataset
  consent: Consent;
  setConsent: (c: Consent) => void;
  highlight: boolean; // true for a few seconds after a result arrives
  verify: () => void; // check the cost (and run, if automatic running is allowed and affordable)
  confirmRun: () => void; // run after the user has seen the cost
  dismiss: () => void;
};

const AdaptionContext = createContext<AdaptionContextValue | null>(null);

class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      url,
      body === undefined
        ? undefined
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", "network");
  }
  const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) throw new ApiError(data?.error ?? "The request failed.", data?.code ?? "api");
  return data as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wait 5 seconds at first, then a little longer each time, up to 15 seconds. A run takes minutes, so this saves requests.
function pollDelay(attempt: number): number {
  return Math.min(15_000, 5_000 + Math.floor(attempt / 3) * 2_500);
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked. Everything still works for this visit.
  }
}

function errorJob(e: unknown, snap: Snap | null): AdaptionJob {
  if (e instanceof ApiError) return { phase: "error", message: e.message, code: e.code, snap };
  return { phase: "error", message: "Something went wrong. Please try again.", code: "api", snap };
}

export function qualityLine(r: AdaptionReport): string | null {
  const q = r.quality;
  if (!q || !q.gradeAfter || q.scoreAfter === null) return null;
  const before = q.gradeBefore && q.scoreBefore !== null ? `before ${q.gradeBefore} · ${q.scoreBefore.toFixed(1)}` : "";
  const gain =
    q.scoreBefore !== null && q.scoreBefore > 0 ? `, ${q.scoreAfter >= q.scoreBefore ? "+" : ""}${(((q.scoreAfter - q.scoreBefore) / q.scoreBefore) * 100).toFixed(0)}%` : "";
  return `${q.gradeAfter} · ${q.scoreAfter.toFixed(1)}/10${before ? ` (${before}${gain})` : ""}`;
}

export function AdaptionProvider({ children }: { children: React.ReactNode }) {
  const { rows, uid, label, summary, importCount, datasets } = useFeedbackData();
  const { notify } = useToast();
  const [saved, setSaved] = useState<AdaptionReport | null>(null);
  const [precomputed, setPrecomputed] = useState<AdaptionReport | null>(null);
  const [job, setJob] = useState<AdaptionJob>({ phase: "idle" });
  const [consent, setConsentState] = useState<Consent>({ enabled: false, cap: DEFAULT_CAP });
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [highlight, setHighlight] = useState(false);

  // Each polling loop gets a ticket, so a newer loop cancels an older one.
  const ticket = useRef(0);
  const preparing = useRef(false);
  const jobPhase = useRef<AdaptionJob["phase"]>("idle");
  const uidRef = useRef(uid);
  const knownRef = useRef<Set<string>>(new Set());

  const setJobSafe = (next: AdaptionJob) => {
    jobPhase.current = next.phase;
    setJob(next);
  };

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    knownRef.current = new Set(datasets.map((m) => m.uid));
  }, [datasets]);

  // Load what was saved: the user's choice about automatic runs, and the saved sample result.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!cancelled) {
        const c = readJson<Consent>(CONSENT_KEY);
        if (c && typeof c.enabled === "boolean" && typeof c.cap === "number") setConsentState(c);
        setConsentLoaded(true);
      }
      try {
        const res = await fetch("/api/adaption/precomputed");
        if (res.ok && !cancelled) setPrecomputed((await res.json()) as AdaptionReport);
      } catch {
        // No saved sample result is fine.
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // The saved result of the open dataset, whenever a different dataset is opened.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let stored: AdaptionReport | null = null;
      if (uid) {
        try {
          stored = (await getItem<AdaptionReport>("adaption", uid)) ?? null;
        } catch {
          stored = null;
        }
      }
      if (!cancelled) setSaved(stored);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const report = useMemo(() => {
    if (saved && saved.datasetUid === uid) return saved;
    if (uid === SAMPLE_UID && precomputed) return { ...precomputed, datasetUid: SAMPLE_UID };
    return null;
  }, [saved, precomputed, uid]);

  const setConsent = (c: Consent) => {
    const cap = Math.max(1, Math.min(1000, Math.round(Number.isFinite(c.cap) ? c.cap : DEFAULT_CAP)));
    const next = { enabled: c.enabled, cap };
    setConsentState(next);
    writeJson(CONSENT_KEY, next);
  };

  function remember(hash: string, core: CoreReport) {
    const cache = readJson<Record<string, CoreReport>>(CACHE_KEY) ?? {};
    delete cache[hash];
    cache[hash] = core;
    const keys = Object.keys(cache);
    for (const k of keys.slice(0, Math.max(0, keys.length - CACHE_LIMIT))) delete cache[k];
    writeJson(CACHE_KEY, cache);
  }

  // Briefly outline the verified section, so the user sees what just changed.
  function flash() {
    setHighlight(true);
    window.setTimeout(() => setHighlight(false), HIGHLIGHT_MS);
  }

  // Saves a result for the dataset the check was about, and shows it if that dataset is open.
  // Returns true if the dataset is the one open right now.
  function store(snap: Snap, full: AdaptionReport): boolean {
    if (!knownRef.current.has(snap.uid)) return false; // the dataset was deleted meanwhile
    putItem("adaption", snap.uid, full).catch(() => {
      notify("The Adaption result could not be saved in your browser, so it will be lost when you close the page.", "error");
    });
    const here = uidRef.current === snap.uid;
    if (here) {
      setSaved(full);
      flash();
    }
    return here;
  }

  function finish(stored: StoredJob, core: CoreReport) {
    remember(stored.hash, core);
    writeJson(JOB_KEY, null);
    setJobSafe({ phase: "idle" });
    const snap: Snap = { uid: stored.uid, label: stored.label, totalMentions: stored.totalMentions, totalUnique: stored.totalUnique };
    const here = store(snap, { ...core, datasetUid: stored.uid });
    const q = core.quality;
    notify(
      `Adaption finished${here ? "" : ` for “${stored.label}”`}: ${core.duplicatesRemoved} duplicates removed${
        q && q.scoreBefore !== null && q.scoreAfter !== null ? `, quality ${q.scoreBefore.toFixed(1)} → ${q.scoreAfter.toFixed(1)}` : ""
      }.`,
      "success",
    );
  }

  async function pollRun(stored: StoredJob) {
    const my = ++ticket.current;
    const cancelled = () => ticket.current !== my;
    const snap: Snap = { uid: stored.uid, label: stored.label, totalMentions: stored.totalMentions, totalUnique: stored.totalUnique };
    setJobSafe({ phase: "running", percent: null, statusText: "Starting", startedAt: stored.startedAt, snap });
    try {
      for (let attempt = 0; !cancelled(); attempt++) {
        if (Date.now() - stored.startedAt > MAX_RUN_WAIT_MS) {
          throw new ApiError("Adaption is taking much longer than expected. Check back later.", "timeout");
        }
        const s = await request<StatusResponse>(`/api/adaption/status?id=${encodeURIComponent(stored.datasetId)}`);
        if (cancelled()) return;
        if (s.status === "failed") throw new ApiError(s.error ?? "The Adaption run failed.", "api");
        setJobSafe({ phase: "running", percent: s.percent, statusText: s.status, startedAt: stored.startedAt, snap });
        if (s.status === "succeeded" || s.status === "ready") break;
        await sleep(pollDelay(attempt));
      }
      // The run is done. The quality evaluation can take a little longer to appear.
      for (let attempt = 0; !cancelled(); attempt++) {
        const r = await request<ResultResponse>("/api/adaption/result", { datasetId: stored.datasetId, rowsSent: stored.rowsSent });
        if (cancelled()) return;
        if (r.state === "ready") {
          finish(stored, {
            source: "adaption",
            datasetLabel: stored.label,
            datasetId: stored.datasetId,
            totalMentions: stored.totalMentions,
            totalUnique: stored.totalUnique,
            rowsSent: r.result.rowsSent,
            textsSent: stored.textsSent,
            sampled: stored.sampled,
            rowsAfter: r.result.rowsAfter,
            duplicatesRemoved: r.result.rowsSent - r.result.rowsAfter,
            quality: r.result.quality,
            creditsEstimated: stored.credits,
            generatedAt: r.result.generatedAt,
          });
          return;
        }
        setJobSafe({ phase: "running", percent: 100, statusText: "Scoring quality", startedAt: stored.startedAt, snap });
        await sleep(pollDelay(attempt));
      }
    } catch (e) {
      if (cancelled()) return;
      writeJson(JOB_KEY, null);
      setJobSafe(errorJob(e, snap));
      notify(`Adaption could not finish for “${snap.label}”: ${e instanceof Error ? e.message : "unknown problem"}`, "error");
    }
  }

  async function startRun(info: SentInfo & { datasetId: string; credits: number; hash: string }, snap: Snap) {
    setJobSafe({ phase: "running", percent: null, statusText: "Starting", startedAt: Date.now(), snap });
    try {
      // The server checks the cost again and refuses unless it is still within what was confirmed.
      await request("/api/adaption/run", { datasetId: info.datasetId, confirmedCredits: info.credits });
    } catch (e) {
      setJobSafe(errorJob(e, snap));
      return;
    }
    const stored: StoredJob = {
      rowsSent: info.rowsSent,
      textsSent: info.textsSent,
      sampled: info.sampled,
      datasetId: info.datasetId,
      credits: info.credits,
      hash: info.hash,
      uid: snap.uid,
      label: snap.label,
      totalMentions: snap.totalMentions,
      totalUnique: snap.totalUnique,
      startedAt: Date.now(),
    };
    writeJson(JOB_KEY, stored);
    void pollRun(stored);
  }

  async function waitUntilReady(datasetId: string) {
    for (let i = 0; i < 20; i++) {
      const s = await request<StatusResponse>(`/api/adaption/status?id=${encodeURIComponent(datasetId)}`);
      if (s.status === "awaiting_input") return;
      if (s.status === "failed") throw new ApiError(s.error ?? "Adaption could not read the file.", "api");
      await sleep(3000);
    }
    throw new ApiError("Adaption is taking longer than usual to read the file. Try again in a minute.", "not_ready");
  }

  // Checks for a cached result, otherwise prepares the file and asks for the cost. Runs by itself only when
  // `auto` is true, the user allowed it, and the cost is within their limit.
  async function verifyData(auto: boolean) {
    if (!uid) return;
    if (preparing.current || jobPhase.current === "running") {
      if (!auto) notify("An Adaption check is already running. It finishes in the background.", "info");
      return;
    }
    const snap: Snap = { uid, label, totalMentions: summary.total, totalUnique: rows.length };
    // A check the user started by hand is only useful while they are still looking at this dataset.
    const abandoned = () => !auto && uidRef.current !== snap.uid;
    preparing.current = true;
    try {
      const sample = buildAdaptionSample(rows);
      const hash = await fingerprint(sample.rows);

      const cached = readJson<Record<string, CoreReport>>(CACHE_KEY)?.[hash];
      if (cached) {
        store(snap, {
          ...cached,
          datasetLabel: snap.label,
          totalMentions: snap.totalMentions,
          totalUnique: snap.totalUnique,
          datasetUid: snap.uid,
          fromCache: true,
        });
        setJobSafe({ phase: "idle" });
        notify("This data was already checked with Adaption, so the earlier result is shown. No credits used.", "info");
        return;
      }

      setJobSafe({ phase: "preparing", message: "Sending a small sample of your feedback to Adaption...", snap });
      const prep = await request<{ datasetId: string }>("/api/adaption/prepare", { rows: sample.rows });
      if (abandoned()) {
        setJobSafe({ phase: "idle" });
        return;
      }
      setJobSafe({ phase: "preparing", message: "Adaption is reading the file...", snap });
      await waitUntilReady(prep.datasetId);
      if (abandoned()) {
        setJobSafe({ phase: "idle" });
        return;
      }
      setJobSafe({ phase: "preparing", message: "Asking Adaption what this would cost...", snap });
      const est = await request<EstimateResponse>("/api/adaption/estimate", { datasetId: prep.datasetId });
      if (abandoned()) {
        setJobSafe({ phase: "idle" });
        return;
      }
      const info = { ...est, hash, rowsSent: sample.rowsSent, textsSent: sample.textsSent, sampled: sample.sampled };
      const overCap = est.credits > consent.cap;

      if (auto && consent.enabled && !overCap) {
        await startRun(info, snap);
      } else {
        setJobSafe({ phase: "estimated", ...info, overCap, snap });
        if (auto) {
          notify(
            overCap
              ? `Adaption would use ${est.credits} credits for “${snap.label}”, more than your limit of ${consent.cap}. Open the Adaption page to decide.`
              : `“${snap.label}” is ready for an Adaption check. Open the Adaption page to see the cost.`,
            "info",
          );
        }
      }
    } catch (e) {
      setJobSafe(errorJob(e, snap));
      if (auto) notify(`Adaption check could not start for “${snap.label}”: ${e instanceof Error ? e.message : "unknown problem"}`, "error");
    } finally {
      preparing.current = false;
    }
  }

  // A new upload: start verifying by itself, if the user allowed that.
  // The start is deferred by one tick so it never changes state in the middle of rendering.
  const lastImport = useRef(0);
  useEffect(() => {
    if (!consentLoaded || importCount === 0 || importCount === lastImport.current) return;
    lastImport.current = importCount;
    if (!consent.enabled) return;
    const id = window.setTimeout(() => void verifyData(true), 0);
    return () => window.clearTimeout(id);
    // Only a new import should start this. The other values are read fresh from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importCount, consentLoaded]);

  // After a reload, pick a run that was in progress back up. It belongs to whichever dataset started it.
  useEffect(() => {
    const pending = readJson<StoredJob>(JOB_KEY);
    const id = pending && jobPhase.current !== "running" ? window.setTimeout(() => void pollRun(pending), 0) : null;
    return () => {
      if (id !== null) window.clearTimeout(id);
    };
    // Once, when the app opens. pollRun is recreated each render but only reads current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only show what belongs to the open dataset. A running check for another dataset is reported separately.
  const visibleJob: AdaptionJob =
    job.phase === "idle" ? job : job.snap && job.snap.uid === uid ? job : { phase: "idle" };
  const runningElsewhere = job.phase === "running" && job.snap.uid !== uid ? job.snap : null;

  const value: AdaptionContextValue = {
    report,
    job: visibleJob,
    runningElsewhere,
    consent,
    setConsent,
    highlight,
    verify: () => void verifyData(false),
    confirmRun: () => {
      if (job.phase === "estimated" && job.snap.uid === uid) void startRun(job, job.snap);
    },
    dismiss: () => setJobSafe({ phase: "idle" }),
  };

  return <AdaptionContext.Provider value={value}>{children}</AdaptionContext.Provider>;
}

export function useAdaption(): AdaptionContextValue {
  const ctx = useContext(AdaptionContext);
  if (!ctx) throw new Error("useAdaption must be used inside AdaptionProvider");
  return ctx;
}
