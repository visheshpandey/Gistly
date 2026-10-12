// Optional near-duplicate finder (MinHash + locality-sensitive hashing), for UNIQUE texts only.
//
// Idea: describe each text by its set of 3-word phrases. Two texts with mostly the same phrases are
// near-duplicates. Comparing every pair is too slow, so each text gets a 64-number signature, and
// texts that share a band of 4 signature numbers become candidates. A candidate is merged only if at
// least 80% of the signature numbers agree (an estimate of how much the phrase sets overlap).
//
// Returns, for each text, the index of its group's first text. Returns null if the deadline passed,
// so the caller can skip the merge instead of making the user wait.
const HASHES = 64;
const BAND_ROWS = 4;
const BANDS = HASHES / BAND_ROWS;
const THRESHOLD = 0.8;

// Fixed numbers, so the same data always gives the same result.
const MULT = new Uint32Array(HASHES);
const ADD = new Uint32Array(HASHES);
(function seed() {
  let s = 0x2545f491;
  for (let i = 0; i < HASHES; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    MULT[i] = s | 1; // odd, so the multiplication stays well mixed
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    ADD[i] = s;
  }
})();

function hashWord(word: string): number {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function signature(normalized: string): Uint32Array {
  const words = normalized.split(" ");
  const hashes = words.map(hashWord);
  const sig = new Uint32Array(HASHES).fill(0xffffffff);
  // Texts under 3 words use their single words as phrases.
  const count = hashes.length >= 3 ? hashes.length - 2 : hashes.length;
  for (let p = 0; p < count; p++) {
    const phrase =
      hashes.length >= 3
        ? (Math.imul(hashes[p], 0x9e3779b1) ^ Math.imul(hashes[p + 1], 0x85ebca6b) ^ Math.imul(hashes[p + 2], 0xc2b2ae35)) >>> 0
        : hashes[p];
    for (let i = 0; i < HASHES; i++) {
      const v = (Math.imul(MULT[i], phrase) + ADD[i]) >>> 0;
      if (v < sig[i]) sig[i] = v;
    }
  }
  return sig;
}

export function findNearDuplicates(texts: string[], deadline: number): number[] | null {
  const parent = texts.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  const sigs: Uint32Array[] = new Array(texts.length);
  const bands: Map<number, number>[] = Array.from({ length: BANDS }, () => new Map());

  for (let i = 0; i < texts.length; i++) {
    if (i % 256 === 0 && performance.now() > deadline) return null;
    const sig = signature(texts[i]);
    sigs[i] = sig;
    for (let b = 0; b < BANDS; b++) {
      let key = b;
      for (let r = 0; r < BAND_ROWS; r++) key = (Math.imul(key, 31) + sig[b * BAND_ROWS + r]) >>> 0;
      const first = bands[b].get(key);
      if (first === undefined) {
        bands[b].set(key, i);
        continue;
      }
      let same = 0;
      const other = sigs[first];
      for (let k = 0; k < HASHES; k++) if (sig[k] === other[k]) same++;
      if (same / HASHES >= THRESHOLD) {
        const a = find(i);
        const c = find(first);
        if (a !== c) parent[Math.max(a, c)] = Math.min(a, c);
      }
    }
  }
  return texts.map((_, i) => find(i));
}
