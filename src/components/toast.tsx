"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; text: string; tone: Tone };

const ToastContext = createContext<{ notify: (text: string, tone?: Tone) => void } | null>(null);

const SHOW_MS = 9000;
const TONE_CLASS: Record<Tone, string> = {
  success: "border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
  error: "border-destructive/40 bg-destructive/5 text-foreground",
  info: "border-border bg-card text-foreground",
};

// Small pop-up messages in the corner, for things that finish in the background (like an Adaption run).
// No outside library: it is a few lines, and it is announced to screen readers.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (text: string, tone: Tone = "info") => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all, { id, text, tone }]);
      window.setTimeout(() => dismiss(id), SHOW_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 print:hidden"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 text-sm shadow-lg ${TONE_CLASS[t.tone]}`}
          >
            <p className="flex-1">{t.text}</p>
            <button type="button" aria-label="Dismiss message" onClick={() => dismiss(t.id)} className="rounded p-0.5 hover:bg-muted">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
