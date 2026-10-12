// The AI words the same problem slightly differently each time ("unhelpful customer service unresolved issue" and
// "unhelpful service issue remains unresolved"). Counting them as separate issues splits one problem into
// pieces. This groups phrases that share most of their meaningful words and adds their counts together.

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "with", "in", "on", "at", "by", "from", "is", "are", "was", "were", "it", "its", "this", "that", "as", "be", "been"]);
const SIMILARITY = 0.6; // phrases sharing at least 60% of their words (Jaccard) are treated as one issue

function words(phrase: string): Set<string> {
  const out = new Set<string>();
  for (const raw of phrase.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    // Light stemming: "features" and "feature", "remains" and "remain" count as the same word.
    out.add(raw.length > 3 && raw.endsWith("s") ? raw.slice(0, -1) : raw);
  }
  return out;
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// Takes issue phrases with their mention counts. Returns the biggest groups. Each group is named by its most common phrase.
export function groupIssues(counts: Map<string, number>, limit: number): { issue: string; mentions: number }[] {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const groups: { label: string; words: Set<string>; mentions: number }[] = [];
  for (const [phrase, mentions] of entries) {
    const w = words(phrase);
    let best = -1;
    let bestScore = 0;
    groups.forEach((g, i) => {
      const s = similarity(w, g.words);
      if (s >= SIMILARITY && s > bestScore) {
        best = i;
        bestScore = s;
      }
    });
    if (best >= 0) groups[best].mentions += mentions;
    else groups.push({ label: phrase, words: w, mentions });
  }
  return groups
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit)
    .map((g) => ({ issue: g.label, mentions: g.mentions }));
}
