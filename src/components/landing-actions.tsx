"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedbackData } from "@/components/data-provider";
import { useUpload } from "@/components/upload-provider";

// The two ways into the app from the entry page: the built-in sample, or the user's own file.
export function LandingActions({ size = "lg" }: { size?: "default" | "lg" }) {
  const router = useRouter();
  const { status, loadSample } = useFeedbackData();
  const { open } = useUpload();
  const ready = status !== "loading";

  async function trySample() {
    await loadSample(); // opens the sample, putting it back on the shelf first if it was deleted
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button size={size} onClick={() => void trySample()} disabled={!ready}>
        Try the sample data
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
      <Button size={size} variant="outline" onClick={() => open("new")} disabled={!ready}>
        <Upload data-icon="inline-start" aria-hidden="true" />
        Upload your data
      </Button>
    </div>
  );
}

// Once a file has been imported from the entry page, go straight to the dashboard.
export function GoToDashboardAfterImport() {
  const router = useRouter();
  const { importCount } = useFeedbackData();
  const seen = useRef(importCount);
  useEffect(() => {
    if (importCount !== seen.current) router.push("/dashboard");
  }, [importCount, router]);
  return null;
}
