"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeedbackData } from "@/components/data-provider";
import { ErrorState } from "@/components/page-header";
import { useUpload } from "@/components/upload-provider";

// Shows loading, error and empty states, and renders `children` once data is ready.
export function DataGate({ children }: { children: React.ReactNode }) {
  const { status, error, actionError, rows, loadSample } = useFeedbackData();
  const { open: openUpload } = useUpload();

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading feedback">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-start gap-4">
        <ErrorState message={error ?? "Something went wrong."} />
        <Button variant="outline" onClick={() => void loadSample()}>
          Try again
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
        <h2 className="text-base font-medium">No feedback yet</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Upload your own feedback (CSV, Excel, JSON, text or pasted), or load the sample dataset to explore Verdict.
        </p>
        {actionError && (
          <p role="alert" className="mt-3 max-w-md text-sm text-destructive">
            {actionError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={() => openUpload("new")}>Upload data</Button>
          <Button variant="outline" onClick={() => void loadSample()}>
            Load sample data
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
