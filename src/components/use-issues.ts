"use client";

import { useEffect, useState } from "react";
import { STATUSES, type Issue, type IssueStatus } from "@/lib/issues/types";

// Issues are kept in this browser for now. They move to Supabase once the keys are available.
const STORAGE_KEY = "insightflow:issues:v1";

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

function read(): Issue[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isIssue) : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

// Saved issues, with add, update and remove. Every page that uses it sees the same list on load.
export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const stored = read();
      if (!cancelled) {
        setIssues(stored);
        setLoaded(true);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  function commit(next: Issue[]) {
    setIssues(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveError(null);
    } catch {
      setSaveError("Your issues could not be saved in this browser. They will be lost when you close the page.");
    }
  }

  const add = (input: Omit<Issue, "id" | "createdAt" | "updatedAt" | "status" | "note"> & { note?: string }) => {
    const now = new Date().toISOString();
    commit([{ ...input, note: input.note ?? "", id: newId(), status: "open", createdAt: now, updatedAt: now }, ...issues]);
  };

  const update = (id: string, patch: Partial<Pick<Issue, "status" | "note" | "title">>) => {
    const now = new Date().toISOString();
    commit(issues.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now } : i)));
  };

  const remove = (id: string) => commit(issues.filter((i) => i.id !== id));

  return { issues, loaded, saveError, add, update, remove };
}
