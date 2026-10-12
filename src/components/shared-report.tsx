"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/report-view";
import { decodeReport } from "@/lib/report/encode";
import type { ReportData } from "@/lib/report/types";

// Read-only page for a share link. The report is inside the link itself (after the "#"), so nothing is loaded
// from a server and no account is needed.
export function SharedReport() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; data: ReportData }>({
    status: "loading",
  });

  // Reads the report from the link now, and again if the link changes while the page is open.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await decodeReport(window.location.hash.slice(1));
      if (!cancelled) setState(data ? { status: "ready", data } : { status: "error" });
    }
    void load();
    const onChange = () => void load();
    window.addEventListener("hashchange", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onChange);
    };
  }, []);

  if (state.status === "loading") {
    return <p role="status" className="text-sm text-muted-foreground">Opening report...</p>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">This report link is not valid</p>
        <p className="mt-1 text-muted-foreground">
          The link may have been cut off when it was copied. Ask the sender for a new link.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()}>Download PDF</Button>
      </div>
      <ReportView data={state.data} />
      <p className="text-center text-xs text-muted-foreground print:hidden">Shared from Verdict</p>
    </div>
  );
}
