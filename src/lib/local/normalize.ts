// Turns review text into a comparison key, so "Great app!!!" and "great app" count as the same feedback.
// Steps, in order:
//  1. lowercase
//  2. remove links
//  3. remove apostrophes ("don't" becomes "dont", so it matches "dont")
//  4. replace punctuation, symbols and emoji with spaces. Letters, combining marks and digits are kept,
//     so Hindi, Arabic and other scripts keep their meaning
//  5. shrink a letter repeated 3 or more times to 2 ("sooooo" becomes "soo", "goood" becomes "good").
//     Digits are never shrunk, so 1000 stays 1000
//  6. collapse spaces and trim
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const APOSTROPHE_RE = /['’`]/g;
const NON_TEXT_RE = /[^\p{L}\p{M}\p{N}\s]/gu;
const REPEAT_RE = /(\p{L})\1{2,}/gu;
const SPACE_RE = /\s+/g;

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(URL_RE, " ")
    .replace(APOSTROPHE_RE, "")
    .replace(NON_TEXT_RE, " ")
    .replace(REPEAT_RE, "$1$1")
    .replace(SPACE_RE, " ")
    .trim();
}

// Words in an already normalized string.
export function countWords(normalized: string): number {
  if (normalized === "") return 0;
  let words = 1;
  for (let i = 0; i < normalized.length; i++) {
    if (normalized.charCodeAt(i) === 32) words += 1;
  }
  return words;
}
