"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

// Shown inside the normal page frame when a page crashes, instead of a blank screen.
// Saved datasets and analyses are not affected: they live in the browser, not in this page.
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[page] crashed", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border-[1.5px] border-edge bg-card p-8 text-center shadow-[3px_3px_0_var(--edge)]">
      <h1 className="title-bar text-2xl font-semibold">Something went wrong on this page</h1>
      <p className="text-sm text-muted-foreground">
        Your data is safe. Try again, or go back to the dashboard.
        {error.digest ? ` (Reference: ${error.digest})` : ""}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Go to the dashboard
        </Link>
      </div>
    </div>
  );
}
