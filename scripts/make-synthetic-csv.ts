// Makes a large fake feedback CSV with a KNOWN answer, to test the local deduplicator.
//
// Usage (PowerShell, from the insightflow folder):
//   node scripts/make-synthetic-csv.ts 1000000 "$env:TEMP\syn-1m.csv" 30000
//
// The file has the columns id, review, category. About 35% of rows are noisy copies of a base text
// ("GREAT APP!!!", extra spaces, a link, an emoji, stretched letters). They all normalize back to the
// base text, so the correct number of unique entries is known. A sidecar file (<out>.expected.json)
// stores the right answers for the benchmark to check.
import fs from "node:fs";
import { once } from "node:events";

const [rowsArg, outArg, uniqueArg] = process.argv.slice(2);
const ROWS = Number(rowsArg ?? 100000);
const OUT = outArg ?? "synthetic.csv";
const UNIQUE_TEXTS = Number(uniqueArg ?? 30000);

// Small seeded random generator, so every run produces the same file.
let seed = 123456789;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

const CATEGORIES = ["Operational Issues", "Fraud and Scam", "Product Feedback", "Customer Service"];
const SYLLABLES = ["ba", "ko", "ri", "tu", "me", "sa", "no", "li", "pa", "do", "ve", "ha", "ju", "ce", "wi"];
const VOCAB: string[] = ["good", "great", "really", "service", "happy", "support", "delivery", "refund", "slow", "helpful"];
for (let i = 0; i < 400; i++) {
  VOCAB.push(pick(SYLLABLES) + pick(SYLLABLES) + (random() < 0.5 ? pick(SYLLABLES) : ""));
}

function baseText(id: number): string {
  const length = 8 + Math.floor(random() * 13);
  const words: string[] = [];
  for (let i = 0; i < length; i++) words.push(pick(VOCAB));
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  const middle = random() < 0.3 ? Math.floor(length / 2) : -1;
  if (middle > 0) words[middle] = words[middle] + ",";
  return `${words.join(" ")} ref${id}.`; // the ref number keeps every base text unique after normalizing
}

const BASES: string[] = [];
for (let id = 0; id < UNIQUE_TEXTS; id++) BASES.push(baseText(id));

function noisy(text: string): string {
  switch (Math.floor(random() * 7)) {
    case 0:
      return text.toUpperCase();
    case 1:
      return text.toLowerCase();
    case 2:
      return text + "!!!";
    case 3:
      return `  ${text}  `;
    case 4:
      return `${text} https://short.example/${Math.floor(random() * 9999)}`;
    case 5:
      return `${text} 😀`;
    default:
      // stretch a double letter ("good" -> "goood"); normalizing shrinks it back
      return text.replace(/(\p{L})\1/u, "$1$1$1");
  }
}

const JUNK = ["!!!", "😀😀", "http://spam.example/x", "...", "???"];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
  const stream = fs.createWriteStream(OUT, { encoding: "utf8" });
  stream.write("id,review,category\n");
  const seen = new Set<number>();
  let empty = 0;
  let junk = 0;
  let batch: string[] = [];

  for (let row = 1; row <= ROWS; row++) {
    const roll = random();
    let review: string;
    let category = pick(CATEGORIES);
    if (roll < 0.01) {
      review = "";
      empty += 1;
    } else if (roll < 0.015) {
      review = pick(JUNK);
      junk += 1;
    } else {
      // Skewed choice: a few texts repeat a lot, most appear rarely.
      const id = Math.floor(UNIQUE_TEXTS * Math.pow(random(), 3));
      category = CATEGORIES[id % CATEGORIES.length];
      seen.add(id);
      review = random() < 0.35 ? noisy(BASES[id]) : BASES[id];
    }
    batch.push(`${row},${csvCell(review)},${csvCell(category)}`);
    if (batch.length >= 20000) {
      if (!stream.write(batch.join("\n") + "\n")) await once(stream, "drain");
      batch = [];
    }
  }
  if (batch.length > 0) stream.write(batch.join("\n") + "\n");
  await new Promise<void>((resolve) => stream.end(resolve));

  const expected = { rows: ROWS, expectedUnique: seen.size, emptyRows: empty, junkRows: junk, baseTexts: UNIQUE_TEXTS };
  fs.writeFileSync(`${OUT}.expected.json`, JSON.stringify(expected, null, 2));
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`Wrote ${ROWS.toLocaleString("en-US")} rows (${mb} MB) to ${OUT}`);
  console.log(`Expected: ${seen.size} unique entries, ${empty} empty rows, ${junk} junk rows`);
}

void main();
