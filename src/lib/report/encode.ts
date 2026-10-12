import type { ReportData } from "./types.ts";

// Turns a report into text that fits in a web address, and back. A share link carries the whole report after
// the "#", so it needs no database and the data never goes to a server. The text is compressed first, because
// a report is a few kilobytes and addresses have limits. "z." marks compressed text and "j." marks plain text.

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function run(stream: CompressionStream | DecompressionStream, input: Uint8Array): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // If the data is damaged, writing fails too. The failure is reported when we read the result below,
  // so the write itself must not raise a second, unhandled error.
  writer.write(input as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeReport(report: ReportData): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(report));
  if (typeof CompressionStream !== "undefined") {
    return `z.${toBase64Url(await run(new CompressionStream("deflate-raw"), bytes))}`;
  }
  return `j.${toBase64Url(bytes)}`;
}

function isReport(value: unknown): value is ReportData {
  const r = value as Partial<ReportData> | null;
  return (
    !!r &&
    r.version === 1 &&
    typeof r.title === "string" &&
    typeof r.summary === "string" &&
    !!r.kpis &&
    Array.isArray(r.priorities) &&
    Array.isArray(r.themes) &&
    Array.isArray(r.issues) &&
    Array.isArray(r.strengths)
  );
}

// Returns null if the text is not a valid report (a damaged or hand-edited link).
export async function decodeReport(text: string): Promise<ReportData | null> {
  try {
    const kind = text.slice(0, 2);
    const bytes = fromBase64Url(text.slice(2));
    let json: string;
    if (kind === "z.") {
      if (typeof DecompressionStream === "undefined") return null;
      json = new TextDecoder().decode(await run(new DecompressionStream("deflate-raw"), bytes));
    } else if (kind === "j.") {
      json = new TextDecoder().decode(bytes);
    } else {
      return null;
    }
    const parsed: unknown = JSON.parse(json);
    return isReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
