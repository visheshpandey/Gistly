"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedbackData } from "@/components/data-provider";
import { useUpload } from "@/components/upload-provider";

// On the dark ink band the main button turns yellow so it stands out; the outline button is
// restyled for dark backgrounds by the .nav-dark rule in globals.css.
const ON_DARK_PRIMARY = "border-hl bg-hl text-[#1c1b2e] shadow-none hover:brightness-95";

// The two ways into the app from the entry page: the built-in sample, or the user's own file.
export function LandingActions({ size = "lg", tone = "light" }: { size?: "default" | "lg"; tone?: "light" | "dark" }) {
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
      <Button size={size} onClick={() => void trySample()} disabled={!ready} className={tone === "dark" ? ON_DARK_PRIMARY : undefined}>
        Try the sample data
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
      <Button
        size={size}
        variant="outline"
        onClick={() => open("new")}
        disabled={!ready}
      >
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
