"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STATUSES, type Issue, type IssueStatus } from "@/lib/issues/types";

// The saved issues (problems the team decided to act on), shared by every page. Kept in this browser's
// localStorage. One shared copy means a change on one page (for example "Track this issue" on Recommendations)
// shows on every other page straight away.
const STORAGE_KEY = "insightflow:issues:v1";
const SAVE_FAILED = "Your issues could not be saved in this browser. They will be lost when you close the page.";

export type NewIssue = Omit<Issue, "id" | "createdAt" | "updatedAt" | "status" | "note"> & { note?: string };

type IssuesContextValue = {
  issues: Issue[];
  loaded: boolean;
  saveError: string | null;
  add: (input: NewIssue) => void;
  update: (id: string, patch: Partial<Pick<Issue, "status" | "note" | "title">>) => void;
  remove: (id: string) => void;
};

const IssuesContext = createContext<IssuesContextValue | null>(null);

function isIssue(v: unknown): v is Issue {
  const i = v as Partial<Issue> | null;
  return (
    !!i &&
    typeof i.id === "string" &&
    typeof i.theme === "string" &&
    typeof i.title === "string" &&
    STATUSES.includes(i.status as IssueStatus) &&
    !!i.snapshot
  );
}

function readStored(): Issue[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isIssue) : [];
  } catch {
    return []; // damaged or blocked storage: start with an empty list rather than crash
  }
}

function writeStored(issues: Issue[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function IssuesProvider({ children }: { children: React.ReactNode }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load once. Done in a timeout so the first render matches the server (which has no localStorage).
  useEffect(() => {
    const id = window.setTimeout(() => {
      setIssues(readStored());
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Every change goes through here: update the shared list, then save it.
  const change = useCallback((next: (current: Issue[]) => Issue[]) => {
    setIssues((current) => {
      const updated = next(current);
      setSaveError(writeStored(updated) ? null : SAVE_FAILED);
      return updated;
    });
  }, []);

  const value = useMemo<IssuesContextValue>(
    () => ({
      issues,
      loaded,
      saveError,
      add: (input) => {
        const now = new Date().toISOString();
        change((list) => [{ ...input, note: input.note ?? "", id: newId(), status: "open", createdAt: now, updatedAt: now }, ...list]);
      },
      update: (id, patch) => {
        const now = new Date().toISOString();
        change((list) => list.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now } : i)));
      },
      remove: (id) => change((list) => list.filter((i) => i.id !== id)),
    }),
    [issues, loaded, saveError, change],
  );

  return <IssuesContext.Provider value={value}>{children}</IssuesContext.Provider>;
}

export function useIssues(): IssuesContextValue {
  const ctx = useContext(IssuesContext);
  if (!ctx) throw new Error("useIssues must be used inside IssuesProvider");
  return ctx;
}
