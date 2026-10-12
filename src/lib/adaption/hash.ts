import type { SentRow } from "./sampling.ts";

// A fingerprint of exactly what we would send to Adaption. The same file always gives the same sample, so the same
// fingerprint, which lets us reuse an earlier result instead of running (and paying) again.
// It hashes the sample, not the whole file: browsers cannot hash a 100 MB file in pieces, and the sample is all that matters.
export async function fingerprint(rows: SentRow[]): Promise<string> {
  const text = JSON.stringify(rows.map((r) => [r.review, r.category, r.occurrences]));
  const bytes = new TextEncoder().encode(text);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Very old or non-secure contexts: a simple hash is good enough to recognise the same data.
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return `fnv-${(h >>> 0).toString(16)}-${bytes.length}`;
}
