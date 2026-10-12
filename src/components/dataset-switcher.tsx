"use client";

import { useState } from "react";
import { ChevronsUpDown, Layers, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SAMPLE_UID, useFeedbackData } from "@/components/data-provider";
import { useUpload } from "@/components/upload-provider";
import { useAnalysis } from "@/components/use-analysis";
import { MAX_DATASETS } from "@/lib/storage/library";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");
const SOURCE_LABEL = { sample: "Sample", file: "File", paste: "Pasted text" } as const;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// The header: which dataset is open, a menu to switch, and a one-click way to bring in more data.
export function DatasetSwitcher() {
  const { status, label, datasets } = useFeedbackData();
  const { open: openUpload } = useUpload();
  const [listOpen, setListOpen] = useState(false);
  const ready = status !== "loading" || datasets.length > 0;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      <Button
        variant="outline"
        onClick={() => setListOpen(true)}
        disabled={!ready}
        aria-label={`Datasets. Open: ${label || "none"}`}
        className="min-w-0 shrink max-w-[14rem] sm:max-w-xs"
      >
        <Layers data-icon="inline-start" aria-hidden="true" />
        <span className="truncate">{label || "No dataset"}</span>
        <ChevronsUpDown data-icon="inline-end" aria-hidden="true" />
      </Button>
      <Button onClick={() => openUpload("new")} disabled={!ready} className="shrink-0">
        <Upload data-icon="inline-start" aria-hidden="true" />
        <span className="hidden sm:inline">Upload data</span>
        <span className="sm:hidden">Upload</span>
      </Button>
      <DatasetsSheet open={listOpen} onOpenChange={setListOpen} />
    </div>
  );
}

function DatasetsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { datasets, uid, switchDataset, renameDataset, deleteDataset, loadSample, resetSample, persistence, actionError } =
    useFeedbackData();
  const { open: openUpload } = useUpload();
  const [renaming, setRenaming] = useState<{ uid: string; value: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const hasSample = datasets.some((d) => d.uid === SAMPLE_UID);

  async function open_(target: string) {
    onOpenChange(false);
    await switchDataset(target);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Your datasets</SheetTitle>
          <SheetDescription>
            Each dataset keeps its own AI analysis, issues, reports and questions. Switching never changes the others.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          {persistence === "memory" && (
            <p role="alert" className="notice p-3 text-sm">
              Your browser is blocking storage, so datasets are kept only until you close this page.
            </p>
          )}
          {actionError && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {actionError}
            </p>
          )}

          {datasets.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No datasets yet. Upload a file or load the sample to begin.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Datasets">
              {datasets.map((d) => {
                const isOpen = d.uid === uid;
                const isRenaming = renaming?.uid === d.uid;
                return (
                  <li key={d.uid} className={cn("rounded-lg border p-3", isOpen && "border-primary bg-primary/5")}>
                    {isRenaming ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (renaming.value.trim() !== "") void renameDataset(d.uid, renaming.value);
                          setRenaming(null);
                        }}
                      >
                        <Input
                          autoFocus
                          aria-label={`New name for ${d.name}`}
                          value={renaming.value}
                          maxLength={80}
                          onChange={(e) => setRenaming({ uid: d.uid, value: e.target.value })}
                        />
                        <Button type="submit">Save</Button>
                        <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {nf.format(d.mentions)} mentions · {nf.format(d.uniqueEntries)} unique · {SOURCE_LABEL[d.source]}
                              {d.fileName ? ` (${d.fileName})` : ""} · updated {when(d.updatedAt)}
                            </p>
                          </div>
                          {isOpen && (
                            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Open</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!isOpen && (
                            <Button size="sm" onClick={() => void open_(d.uid)}>
                              Open
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setRenaming({ uid: d.uid, value: d.name })}>
                            Rename
                          </Button>
                          {d.uid === SAMPLE_UID && (
                            <Button size="sm" variant="outline" onClick={() => void resetSample()}>
                              Reset sample
                            </Button>
                          )}
                          {confirming === d.uid ? (
                            <>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setConfirming(null);
                                  void deleteDataset(d.uid);
                                }}
                              >
                                Yes, delete it
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                                Keep it
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setConfirming(d.uid)}>
                              Delete
                            </Button>
                          )}
                        </div>
                        {confirming === d.uid && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            This permanently deletes “{d.name}” with its analysis, issues and saved questions.
                          </p>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onOpenChange(false);
                openUpload("new");
              }}
              disabled={datasets.length >= MAX_DATASETS && uid === ""}
            >
              <Upload data-icon="inline-start" aria-hidden="true" />
              Upload data
            </Button>
            {!hasSample && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  void loadSample();
                }}
              >
                Load sample data
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            You can keep up to {MAX_DATASETS} datasets. Everything is stored in this browser only.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// A short note on the Dashboard and Feedback pages when the built-in sample is open, so nobody mistakes it for their data.
export function SampleBanner() {
  const { uid } = useFeedbackData();
  const { open } = useUpload();
  const { result } = useAnalysis();
  if (uid !== SAMPLE_UID) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        You are looking at the <span className="font-medium">sample dataset</span>
        {result ? "" : " (not analysed yet)"}. Upload your own feedback to analyse it. The sample stays here.
      </p>
      <Button size="sm" onClick={() => open("new")}>
        <Upload data-icon="inline-start" aria-hidden="true" />
        Upload your data
      </Button>
    </div>
  );
}
