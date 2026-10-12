// Cleans up and checks the theme names the AI proposes.
const SMALL_WORDS = new Set(["a", "an", "and", "or", "of", "the", "for", "to", "in", "on", "at", "by", "with", "&"]);

// "Fraud And Security" becomes "Fraud and Security": small words in the middle of a name stay lowercase.
export function tidyThemeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word))
    .join(" ");
}
