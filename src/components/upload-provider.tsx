"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NativeSelect } from "@/components/native-select";
import { useFeedbackData } from "@/components/data-provider";
import { useToast } from "@/components/toast";
import { guessMapping, type ColumnMapping } from "@/lib/csv";
import type { FilePreview } from "@/lib/local/messages";
import {
  CANCELLED,
  startLocalImport,
  startPreview,
  type ImportHandle,
  type ImportProgress,
  type PreviewHandle,
} from "@/lib/local/run-import";
import { ACCEPT_FILES, FORMAT_LABEL, SUPPORTED_TEXT, detectFormat, looksNumeric } from "@/lib/local/sources";
import { MAX_DATASETS } from "@/lib/storage/library";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");

export type UploadMode = "new" | "add";
type UploadContextValue = { open: (mode?: UploadMode) => void };
const UploadContext = createContext<UploadContextValue | null>(null);

// One upload panel for the whole app. Any page (or the header) can open it, so bringing in new data is always one click.
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; mode: UploadMode; opens: number }>({ open: false, mode: "new", opens: 0 });
  return (
    <UploadContext.Provider value={{ open: (mode = "new") => setState((s) => ({ open: true, mode, opens: s.opens + 1 })) }}>
      {children}
      {/* A new key every time it opens gives a fresh, empty panel. */}
      <UploadSheet
        key={state.opens}
        open={state.open}
        initialMode={state.mode}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    </UploadContext.Provider>
  );
}

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside UploadProvider");
  return ctx;
}

type Phase = "idle" | "previewing" | "mapping" | "importing";

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function UploadSheet({
  open,
  initialMode,
  onOpenChange,
}: {
  open: boolean;
  initialMode: UploadMode;
  onOpenChange: (open: boolean) => void;
}) {
  const { createDataset, mergeDataset, uid: currentUid, label: currentName, datasets } = useFeedbackData();
  const { notify } = useToast();
  const hasCurrent = currentUid !== "";
  const shelfFull = datasets.length >= MAX_DATASETS;

  const [mode, setMode] = useState<UploadMode>(initialMode);
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [name, setName] = useState<string | null>(null); // null = the user has not typed a name
  const [context, setContext] = useState("");
  const [nearDup, setNearDup] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const previewRef = useRef<PreviewHandle | null>(null);
  const importRef = useRef<ImportHandle | null>(null);
  const startedAt = useRef(0);

  // With nothing open there is nothing to add to; with a full shelf the only option is to add.
  const effectiveMode: UploadMode = !hasCurrent ? "new" : shelfFull ? "add" : mode;
  const importing = phase === "importing";
  const defaultName = tab === "paste" || !file ? "Pasted text" : file.name.replace(/\.[^.]+$/, "");
  const effectiveName = name ?? defaultName;

  // Tick the clock while importing, so the user can see it is working.
  useEffect(() => {
    if (!importing) return;
    const timer = window.setInterval(() => setElapsed(Math.round((performance.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [importing]);

  // Closing the panel stops anything still running in the background.
  useEffect(
    () => () => {
      previewRef.current?.cancel();
      importRef.current?.cancel();
    },
    [],
  );

  async function loadPreview(f: File, options: { sheet?: string | null; hasHeader?: boolean } = {}) {
    const detected = detectFormat(f.name);
    if (!detected.ok) {
      setError(detected.reason);
      return;
    }
    previewRef.current?.cancel();
    setError(null);
    setPhase("previewing");
    const header = options.hasHeader ?? hasHeader;
    const handle = startPreview(f, { format: detected.format, sheet: options.sheet ?? null, hasHeader: header });
    previewRef.current = handle;
    try {
      const p = await handle.promise;
      setFile(f);
      setPreview(p);
      setMapping(guessMapping(p));
      setPhase("mapping");
    } catch (e) {
      if (e instanceof Error && e.message === CANCELLED) return;
      setError(e instanceof Error ? e.message : "This file could not be read.");
      setPhase(preview ? "mapping" : "idle");
    }
  }

  function chooseFile(f: File | undefined) {
    if (!f) return;
    setName(null);
    setHasHeader(true);
    void loadPreview(f, { hasHeader: true });
  }

  function usePastedText() {
    if (pasted.trim() === "") {
      setError("Paste some feedback first, one review per line.");
      return;
    }
    setName(null);
    void loadPreview(new File([pasted], "pasted-text.txt", { type: "text/plain" }));
  }

  async function handleImport() {
    if (!file || !preview || !mapping) return;
    setError(null);
    setProgress(null);
    setElapsed(0);
    startedAt.current = performance.now();
    setPhase("importing");
    const handle = startLocalImport(file, { format: preview.format, sheet: preview.sheet, hasHeader }, mapping, nearDup, setProgress);
    importRef.current = handle;
    try {
      const result = await handle.promise;
      importRef.current = null;
      if (effectiveMode === "add") {
        mergeDataset(result.rows, result.stats);
        notify(`Added ${nf.format(result.rows.length)} entries from ${nf.format(result.stats.rowsRead)} rows to “${currentName}”.`, "success");
      } else {
        const created = createDataset({
          name: effectiveName,
          rows: result.rows,
          context: context.trim(),
          stats: result.stats,
          source: tab === "paste" ? "paste" : "file",
          fileName: tab === "paste" ? null : file.name,
        });
        if (!created) {
          setError(`You can keep up to ${MAX_DATASETS} datasets. Delete one you no longer need, or add this to an existing dataset.`);
          setPhase("mapping");
          return;
        }
        notify(`“${effectiveName}” is ready: ${nf.format(result.rows.length)} unique entries from ${nf.format(result.stats.rowsRead)} rows.`, "success");
      }
      onOpenChange(false);
    } catch (e) {
      importRef.current = null;
      if (e instanceof Error && e.message === CANCELLED) return;
      setError(e instanceof Error ? e.message : "Something went wrong while reading the file.");
      setPhase("mapping");
    }
  }

  function cancelImport() {
    importRef.current?.cancel();
    importRef.current = null;
    setPhase("mapping");
    setProgress(null);
  }

  function update(patch: Partial<ColumnMapping>) {
    setMapping((m) => (m ? { ...m, ...patch } : m));
    setError(null);
  }

  const textIndex = preview && mapping ? preview.fields.indexOf(mapping.text) : -1;
  const textValues = preview && textIndex >= 0 ? preview.rows.map((r) => r[textIndex] ?? "").filter((v) => v.trim() !== "") : [];
  const examples = textValues.slice(0, 3);
  const numericWarning = preview?.format !== "lines" && textValues.length > 0 && looksNumeric(textValues);
  const isTable = preview?.format === "csv" || preview?.format === "xlsx";
  const percent = progress?.percent ?? null;

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Upload data</SheetTitle>
          <SheetDescription>
            Files are read in your browser and never leave your computer. {SUPPORTED_TEXT} are supported, or paste text.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          {hasCurrent && (
            <fieldset className="flex flex-col gap-2" disabled={importing}>
              <legend className="mb-1 text-sm font-medium">Where should this data go?</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="upload-mode"
                  checked={effectiveMode === "new"}
                  disabled={shelfFull}
                  onChange={() => setMode("new")}
                  className="mt-0.5 size-4"
                />
                <span>
                  A new dataset
                  <span className="block text-xs text-muted-foreground">
                    Keeps everything you have. It gets its own analysis, issues and reports.
                    {shelfFull ? ` You already have ${MAX_DATASETS} datasets, the most you can keep.` : ""}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="upload-mode"
                  checked={effectiveMode === "add"}
                  onChange={() => setMode("add")}
                  className="mt-0.5 size-4"
                />
                <span>
                  Add to “{currentName}”
                  <span className="block text-xs text-muted-foreground">
                    Counts it together with the data already there, and only the new feedback needs analysing. Adding the
                    same file twice counts it twice.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <div className="flex flex-col gap-3">
            <div role="tablist" aria-label="Where the data comes from" className="inline-flex w-fit rounded-lg border p-0.5 text-sm">
              {(["file", "paste"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  disabled={importing}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-3 py-1 transition-colors",
                    tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "file" ? "Upload a file" : "Paste text"}
                </button>
              ))}
            </div>

            {tab === "file" ? (
              <label
                htmlFor="upload-file"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!importing) chooseFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50",
                  dragging ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                  importing && "pointer-events-none opacity-60",
                )}
              >
                <span className="text-sm font-medium">{file ? `${file.name} (${fileSize(file.size)})` : "Drop a file here, or click to choose one"}</span>
                <span className="text-xs text-muted-foreground">{SUPPORTED_TEXT}</span>
                <input
                  id="upload-file"
                  type="file"
                  accept={ACCEPT_FILES}
                  disabled={importing}
                  className="sr-only"
                  onChange={(e) => {
                    chooseFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="paste-text" className="text-sm font-medium">
                  Paste your feedback, one review per line
                </label>
                <textarea
                  id="paste-text"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={7}
                  disabled={importing}
                  placeholder={"The delivery was late again\nGreat support team\nThe app keeps crashing"}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                />
                <div>
                  <Button variant="outline" onClick={usePastedText} disabled={importing || phase === "previewing"}>
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>

          {phase === "previewing" && (
            <p role="status" className="text-sm text-muted-foreground">
              Reading the start of the file...
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {preview && mapping && (phase === "mapping" || importing) && (
            <>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{FORMAT_LABEL[preview.format]}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.fields.length} {preview.fields.length === 1 ? "column" : "columns"}
                  {preview.moreRows ? ". Showing the start of the file; all of it is read when you import." : "."}
                  {preview.encoding !== "utf-8" && preview.encoding !== "xlsx" ? ` Text encoding: ${preview.encoding}.` : ""}
                </p>
                {preview.note && <p className="mt-1 text-xs text-muted-foreground">{preview.note}</p>}
              </div>

              {preview.format === "xlsx" && preview.sheets.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="map-sheet" className="text-sm font-medium">
                    Sheet
                  </label>
                  <NativeSelect
                    id="map-sheet"
                    value={preview.sheet ?? ""}
                    disabled={importing}
                    onChange={(e) => file && void loadPreview(file, { sheet: e.target.value })}
                  >
                    {preview.sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              {isTable && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    disabled={importing}
                    onChange={(e) => {
                      setHasHeader(e.target.checked);
                      if (file) void loadPreview(file, { sheet: preview.sheet, hasHeader: e.target.checked });
                    }}
                    className="size-4"
                  />
                  The first row has column names
                </label>
              )}

              {preview.format !== "lines" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="map-text" className="text-sm font-medium">
                      Feedback text
                    </label>
                    <NativeSelect id="map-text" value={mapping.text} disabled={importing} onChange={(e) => update({ text: e.target.value })}>
                      {preview.fields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </NativeSelect>
                    {numericWarning && (
                      <p role="alert" className="text-xs font-semibold text-foreground">
                        This column looks like numbers, not feedback text. Pick the column that holds what people wrote.
                      </p>
                    )}
                    {examples.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                        {examples.map((t, i) => (
                          <li key={i} className="line-clamp-1">
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="map-category" className="text-sm font-medium">
                        Category <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <NativeSelect
                        id="map-category"
                        value={mapping.category ?? ""}
                        disabled={importing}
                        onChange={(e) => update({ category: e.target.value || null })}
                      >
                        <option value="">None</option>
                        {preview.fields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="map-date" className="text-sm font-medium">
                        Date <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <NativeSelect
                        id="map-date"
                        value={mapping.date ?? ""}
                        disabled={importing}
                        onChange={(e) => update({ date: e.target.value || null })}
                      >
                        <option value="">None</option>
                        {preview.fields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                </>
              )}

              {effectiveMode === "new" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="dataset-name" className="text-sm font-medium">
                      Name this dataset
                    </label>
                    <Input
                      id="dataset-name"
                      value={effectiveName}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      disabled={importing}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="map-context" className="text-sm font-medium">
                      What is this feedback about? <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="map-context"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      maxLength={200}
                      disabled={importing}
                      placeholder="e.g. a food delivery app"
                    />
                    <p className="text-xs text-muted-foreground">Helps the AI name topics correctly.</p>
                  </div>
                </>
              )}

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={nearDup}
                  onChange={(e) => setNearDup(e.target.checked)}
                  disabled={importing}
                  className="mt-0.5 size-4"
                />
                <span>
                  Also merge near-duplicate wording
                  <span className="block text-xs text-muted-foreground">
                    Slower. Merges long texts that differ by only a word or two. Skipped automatically if it would take more
                    than about 20 seconds.
                  </span>
                </span>
              </label>

              {importing ? (
                <div className="flex flex-col gap-2" role="status" aria-live="polite">
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label="Import progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent ?? undefined}
                  >
                    <div
                      className={percent === null ? "h-full w-1/3 animate-pulse bg-primary" : "h-full bg-primary transition-all"}
                      style={percent === null ? undefined : { width: `${percent}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {progress?.phase === "finishing" ? "Finishing up" : "Reading"}
                    {progress ? `: ${nf.format(progress.rowsRead)} rows` : ""}
                    {percent !== null ? ` (${percent}%)` : ""} · {elapsed}s
                  </p>
                  <div>
                    <Button variant="outline" onClick={cancelImport}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => void handleImport()}>
                  {effectiveMode === "add" ? "Add to this dataset" : "Create dataset"}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
