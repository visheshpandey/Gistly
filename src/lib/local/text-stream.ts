// Reads a big text file in pieces without ever holding all of it, and without breaking characters or rows.
//
// Two problems this solves:
//  1. A byte chunk can end in the middle of a character (a Hindi letter takes 3 bytes). Decoding each chunk on its own
//     would corrupt it. Here one TextDecoder lives for the whole file and carries partial characters over.
//  2. A chunk can end in the middle of a row, and in CSV a quoted cell may even contain a line break. Here a piece is
//     only cut at a line break that is OUTSIDE quotes, so every piece holds whole rows.
//
// No browser-only or library code, so tests can run it in Node.

export type TextMode = "csv" | "lines";

const BATCH_CHARS = 2_000_000; // roughly 2 to 4 MB of text per piece
const MAX_PENDING_CHARS = 32_000_000; // safety valve for files with a stray quote mark

// Tells which text encoding a file uses, from its first bytes.
// Windows-1252 is what Excel writes when you pick plain "CSV" on Windows, and it is not valid UTF-8.
export function chooseEncoding(head: Uint8Array): string {
  if (head.length >= 2 && head[0] === 0xff && head[1] === 0xfe) return "utf-16le";
  if (head.length >= 2 && head[0] === 0xfe && head[1] === 0xff) return "utf-16be";
  try {
    // stream: true lets the sample end in the middle of a character without counting that as an error.
    new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

// The position just after the last line break that is not inside quotes, or 0 if there is none.
export function safeCut(text: string, mode: TextMode): number {
  if (mode === "lines") {
    return Math.max(text.lastIndexOf("\n"), text.lastIndexOf("\r")) + 1;
  }
  let inQuotes = false;
  let cut = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 34) inQuotes = !inQuotes;
    else if (c === 10 && !inQuotes) cut = i + 1;
  }
  return cut;
}

export type BatchHandler = (text: string, bytesRead: number) => void | Promise<void>;

// Feeds the file to `onBatch` as pieces of text, each ending at a safe line break.
// `stream` is a byte stream (file.stream() in a browser). Returns early if `shouldStop()` becomes true.
export async function readTextBatches(
  stream: ReadableStream<Uint8Array>,
  encoding: string,
  mode: TextMode,
  onBatch: BatchHandler,
  shouldStop: () => boolean = () => false,
  batchChars: number = BATCH_CHARS, // only tests change this
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder(encoding);
  let pending = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    pending += decoder.decode(value, { stream: true });
    if (pending.length >= batchChars) {
      let cut = safeCut(pending, mode);
      if (cut === 0 && pending.length > MAX_PENDING_CHARS) cut = safeCut(pending, "lines");
      if (cut > 0) {
        const batch = pending.slice(0, cut);
        pending = pending.slice(cut);
        await onBatch(batch, bytes);
      }
    }
    if (shouldStop()) {
      await reader.cancel();
      return;
    }
  }
  pending += decoder.decode();
  if (pending.length > 0) await onBatch(pending, bytes);
}

// Decodes the start of a file for previewing. If the file is longer than the sample, the text is cut at a safe line
// break so the last row is never half a row.
export function decodeHead(head: Uint8Array, encoding: string, fileIsLonger: boolean, mode: TextMode): string {
  let text = new TextDecoder(encoding).decode(head, { stream: fileIsLonger });
  if (fileIsLonger) {
    const cut = safeCut(text, mode);
    if (cut > 0) text = text.slice(0, cut);
  }
  return text;
}
