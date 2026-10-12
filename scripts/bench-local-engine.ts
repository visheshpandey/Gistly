// Times the local deduplicator on a CSV file and checks the answers.
//
// Usage (PowerShell, from the insightflow folder):
//   node scripts/bench-local-engine.ts "$env:TEMP\syn-1m.csv"            (exact + normalized dedup)
//   node scripts/bench-local-engine.ts "$env:TEMP\syn-1m.csv" --near-dup (also the near-duplicate pass)
//
// It runs the same engine and CSV feeder the browser worker uses, so the timings are a fair estimate
// of the worker's engine speed. It does not measure browser responsiveness, because it runs in Node.
// If <file>.expected.json exists (made by make-synthetic-csv.ts), the counts are checked against it.
import fs from "node:fs";
import Papa from "papaparse";
import { CsvFeeder } from "../src/lib/local/csv-feed.ts";
import { DedupeEngine, withTimings } from "../src/lib/local/engine.ts";

const file = process.argv[2];
const nearDup = process.argv.includes("--near-dup");
if (!file) {
  console.error("Give the CSV file path as the first argument.");
  process.exit(1);
}

const sizeMb = fs.statSync(file).size / 1024 / 1024;
const engine = new DedupeEngine({ nearDup });
const feeder = new CsvFeeder({ text: "review", category: "category", date: null }, engine);
let peakRssMb = 0;
const started = performance.now();

const stream = fs.createReadStream(file, { encoding: "utf8", highWaterMark: 4 * 1024 * 1024 });
Papa.parse(stream as unknown as File, {
  skipEmptyLines: true,
  chunk: (results: { data: string[][] }) => {
    feeder.feed(results.data);
    peakRssMb = Math.max(peakRssMb, process.memoryUsage().rss / 1024 / 1024);
  },
  complete: () => {
    const result = engine.finish();
    const stats = withTimings(result, feeder.feedMs, performance.now() - started);
    const t = stats.timings;
    const sec = (ms: number) => (ms / 1000).toFixed(2) + " s";
    const rowsPerSec = Math.round(stats.rowsRead / (t.totalMs / 1000)).toLocaleString("en-US");

    console.log(`File: ${file} (${sizeMb.toFixed(1)} MB)  near-duplicate pass: ${nearDup ? "on" : "off"}`);
    console.log(`Rows read      ${stats.rowsRead.toLocaleString("en-US")}`);
    console.log(`Rows kept      ${stats.rowsKept.toLocaleString("en-US")}  (empty ${stats.emptyRows}, junk ${stats.junkRows}, over limit ${stats.overflowRows})`);
    console.log(`Unique entries ${stats.uniqueEntries.toLocaleString("en-US")}  (duplicates removed ${stats.duplicatesRemoved.toLocaleString("en-US")}, near-duplicate merges ${stats.nearDupMerged}, pass: ${stats.nearDup})`);
    console.log(`Quality        before ${stats.before.grade} ${stats.before.score}/10  ->  after ${stats.after.grade} ${stats.after.score}/10`);
    console.log(`Timings        parse ${sec(t.parseMs)} | dedupe ${sec(t.dedupeMs)} | score ${sec(t.scoreMs)} | total ${sec(t.totalMs)}  (${rowsPerSec} rows/s)`);
    console.log(`Peak memory    ${peakRssMb.toFixed(0)} MB (process RSS)`);

    const expectedPath = `${file}.expected.json`;
    if (fs.existsSync(expectedPath)) {
      const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8")) as {
        rows: number;
        expectedUnique: number;
        emptyRows: number;
        junkRows: number;
      };
      const checks: [string, boolean][] = [
        ["rows read matches", stats.rowsRead === expected.rows],
        ["empty rows match", stats.emptyRows === expected.emptyRows],
        ["junk rows match", stats.junkRows === expected.junkRows],
        ["unique entries match", stats.uniqueEntries === expected.expectedUnique],
        ["no row lost (kept = entries + duplicates)", stats.rowsKept === stats.uniqueEntries + stats.duplicatesRemoved],
        ["occurrences add up to rows kept", result.rows.reduce((sum, r) => sum + r.occurrences, 0) === stats.rowsKept],
      ];
      for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
      console.log(`(expected unique ${expected.expectedUnique}, got ${stats.uniqueEntries})`);
    }
  },
});
