// Automated checks for reading different kinds of files, and for the storage that keeps several datasets.
// Plain Node, no test library.
//
// Usage (PowerShell, from the insightflow folder):
//   node scripts/test-data-sources.ts
import assert from "node:assert/strict";
import Papa from "papaparse";
import { deleteItem, getAll, getItem, getKeys, putItem, resetMemoryForTests } from "../src/lib/storage/db.ts";
import { listMeta, loadDataset, metaOf, removeDataset, saveDataset, uniqueName } from "../src/lib/storage/library.ts";
import { migrateLegacy } from "../src/lib/storage/migrate.ts";
import {
  LineSplitter,
  cellToString,
  cleanHeader,
  detectFormat,
  fieldOf,
  fieldsOf,
  findRecords,
  looksNumeric,
  recordsToTable,
  syntheticHeader,
} from "../src/lib/local/sources.ts";
import { chooseEncoding, decodeHead, readTextBatches, safeCut } from "../src/lib/local/text-stream.ts";
import type { Dataset } from "../src/lib/feedback-types.ts";

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}\n      ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

const bytes = (s: string) => new TextEncoder().encode(s);

// A stream that hands out the bytes in tiny pieces, to prove nothing breaks at the seams.
function stream(data: Uint8Array, pieceSize: number): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= data.length) return controller.close();
      controller.enqueue(data.slice(at, at + pieceSize));
      at += pieceSize;
    },
  });
}

await check("format: known types are recognised and unsupported ones explain what to do", () => {
  assert.deepEqual(detectFormat("Reviews Q1.CSV"), { ok: true, format: "csv" });
  assert.deepEqual(detectFormat("a.tsv"), { ok: true, format: "csv" });
  assert.deepEqual(detectFormat("notes.txt"), { ok: true, format: "lines" });
  assert.deepEqual(detectFormat("d.json"), { ok: true, format: "json" });
  assert.deepEqual(detectFormat("d.ndjson"), { ok: true, format: "jsonl" });
  assert.deepEqual(detectFormat("book.xlsx"), { ok: true, format: "xlsx" });
  const xls = detectFormat("old.xls");
  assert.equal(xls.ok, false);
  assert.match(xls.ok ? "" : xls.reason, /Save As/);
  const pdf = detectFormat("report.pdf");
  assert.equal(pdf.ok, false);
  assert.equal(detectFormat("noextension").ok, false);
});

await check("lines: a line split across two chunks is put back together", () => {
  const s = new LineSplitter();
  const out = [...s.push("first li"), ...s.push("ne\r\nsecond\nthi"), ...s.push("rd"), ...s.flush()];
  assert.deepEqual(out, ["first line", "second", "third"]);
});

await check("values: dates become ISO text, empty values become empty text", () => {
  assert.equal(cellToString(new Date("2026-03-04T00:00:00.000Z")), "2026-03-04T00:00:00.000Z");
  assert.equal(cellToString(null), "");
  assert.equal(cellToString(12.5), "12.5");
  assert.equal(cellToString(true), "true");
  assert.equal(cellToString({ a: 1 }), '{"a":1}');
});

await check("headers: blanks are named, repeats are numbered, no header gives Column 1, Column 2", () => {
  assert.deepEqual(cleanHeader([" Comment ", "", "comment", "Date"]), ["Comment", "Column 2", "comment (2)", "Date"]);
  assert.deepEqual(syntheticHeader([["a", "b"], ["c", "d", "e"]]), ["Column 1", "Column 2", "Column 3"]);
});

await check("json: the list of records is found at the top, inside a property, or deeper", () => {
  assert.equal(findRecords([{ a: 1 }])?.length, 1);
  assert.equal(findRecords({ reviews: [{ a: 1 }, { a: 2 }] })?.length, 2);
  assert.equal(findRecords({ meta: { page: 1 }, data: { items: ["x", "y", "z"] } })?.length, 3);
  assert.equal(findRecords({ a: 1, b: "text" }), null);
});

await check("json: columns come from every record, strings become a text column", () => {
  const records = [{ comment: "a", region: "N" }, { comment: "b", when: "2026-01-01" }];
  assert.deepEqual(fieldsOf(records), ["comment", "region", "when"]);
  assert.equal(fieldOf(records[1], "region"), "");
  assert.deepEqual(recordsToTable(["one", "two"], 10), { fields: ["text"], rows: [["one"], ["two"]] });
});

await check("numbers: a column of numbers is not feedback text, a column of sentences is", () => {
  assert.equal(looksNumeric(["12", "3.5", "1,200", "7", "8%"]), true);
  assert.equal(looksNumeric(["Great app", "Too slow", "ok", "love it"]), false);
  assert.equal(looksNumeric(["1", "2"]), false); // too few values to say
});

await check("encoding: UTF-8, UTF-16 and Windows-1252 are told apart", () => {
  assert.equal(chooseEncoding(bytes("Plain ascii, and Hindi: बहुत अच्छा")), "utf-8");
  assert.equal(chooseEncoding(Uint8Array.from([0xff, 0xfe, 0x41, 0x00])), "utf-16le");
  assert.equal(chooseEncoding(Uint8Array.from([0x49, 0x74, 0x92, 0x73])), "windows-1252"); // 0x92 is a curly apostrophe there
  const cutInTheMiddleOfAChar = bytes("बहुत").slice(0, 4); // ends part-way through a 3-byte letter
  assert.equal(chooseEncoding(cutInTheMiddleOfAChar), "utf-8");
});

await check("csv cutting: only a line break outside quotes is a safe place to cut", () => {
  const text = 'id,review\n1,"line one\nline two"\n2,plain\n3,"has ""quotes"" and\nbreak"\n4,end';
  const cut = safeCut(text, "csv");
  assert.equal(text.slice(0, cut).endsWith('break"\n'), true);
  assert.equal(safeCut('a,"open\nstill open', "csv"), 0); // everything is inside quotes
});

await check("streaming: characters and quoted line breaks survive being cut into one-byte pieces", async () => {
  const rows = ["id,review", ...Array.from({ length: 60 }, (_, i) => `${i},"बहुत अच्छा ${i}, says ""Ravi""\nsecond line ${i}"`)];
  const text = rows.join("\r\n") + "\r\n";
  const batches: string[] = [];
  await readTextBatches(stream(bytes(text), 1), "utf-8", "csv", (b) => void batches.push(b), () => false, 120);
  assert.equal(batches.join(""), text); // nothing lost, nothing changed
  assert.ok(batches.length > 3, "it should really have been cut into several pieces");
  const wholeFile = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
  const perBatch = batches.flatMap((b) => Papa.parse<string[]>(b, { skipEmptyLines: true }).data);
  assert.deepEqual(perBatch, wholeFile); // every piece holds whole rows
});

await check("streaming: a Windows-1252 file is decoded properly", async () => {
  const win = Uint8Array.from([0x49, 0x74, 0x92, 0x73, 0x20, 0x67, 0x72, 0x65, 0x61, 0x74]); // It’s great
  const out: string[] = [];
  await readTextBatches(stream(win, 3), chooseEncoding(win), "lines", (b) => void out.push(b));
  assert.equal(out.join(""), "It’s great");
});

await check("preview: the start of a long file is cut at a safe place", () => {
  const head = bytes('id,review\n1,"a\nb"\n2,c\n3,"partial');
  const text = decodeHead(head, "utf-8", true, "csv");
  assert.equal(text, 'id,review\n1,"a\nb"\n2,c\n');
});

const dataset = (uid: string, name: string, n = 3): Dataset => ({
  uid,
  label: name,
  context: "",
  stats: null,
  source: "file",
  fileName: `${name}.csv`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  rows: Array.from({ length: n }, (_, i) => ({ id: i + 1, review: `review ${i}`, category: i === 0 ? "A" : null, date: i === 1 ? "2026-01-01" : null, occurrences: i + 1 })),
});

await check("storage: put, get, list and delete work (memory fallback in Node)", async () => {
  resetMemoryForTests();
  await putItem("analyses", "u1", { a: 1 });
  await putItem("analyses", "u2", { a: 2 });
  assert.deepEqual(await getItem("analyses", "u1"), { a: 1 });
  assert.deepEqual((await getKeys("analyses")).sort(), ["u1", "u2"]);
  assert.equal((await getAll("analyses")).length, 2);
  await deleteItem("analyses", "u1");
  assert.equal(await getItem("analyses", "u1"), undefined);
});

await check("shelf: several datasets are kept apart, newest change first, and meta counts are right", async () => {
  resetMemoryForTests();
  await saveDataset(dataset("a", "Alpha"));
  await saveDataset({ ...dataset("b", "Beta", 5), updatedAt: "2026-03-01T00:00:00.000Z" });
  const list = await listMeta();
  assert.deepEqual(list.map((m) => m.name), ["Beta", "Alpha"]);
  const meta = metaOf(dataset("a", "Alpha"));
  assert.equal(meta.mentions, 1 + 2 + 3);
  assert.equal(meta.uniqueEntries, 3);
  assert.equal(meta.hasDates, true);
  assert.equal(meta.hasCategory, true);
  const loaded = await loadDataset("b");
  assert.equal(loaded?.rows.length, 5);
  assert.equal(loaded?.label, "Beta");
  assert.equal(await loadDataset("nope"), null);
});

await check("shelf: deleting a dataset also deletes its analysis, Adaption result and questions", async () => {
  resetMemoryForTests();
  await saveDataset(dataset("a", "Alpha"));
  await saveDataset(dataset("b", "Beta"));
  for (const store of ["analyses", "adaption", "ask"] as const) {
    await putItem(store, "a", { for: "a" });
    await putItem(store, "b", { for: "b" });
  }
  await removeDataset("a");
  assert.deepEqual((await listMeta()).map((m) => m.uid), ["b"]);
  for (const store of ["analyses", "adaption", "ask", "datasets", "meta"] as const) {
    assert.equal(await getItem(store, "a"), undefined, `${store} still has it`);
  }
  assert.deepEqual(await getItem("analyses", "b"), { for: "b" }); // the other dataset is untouched
});

await check("names: a taken name gets a number, blank names get a default", () => {
  assert.equal(uniqueName("Reviews", ["Other"]), "Reviews");
  assert.equal(uniqueName("reviews", ["Reviews"]), "reviews (2)");
  assert.equal(uniqueName("Reviews", ["Reviews", "Reviews (2)"]), "Reviews (3)");
  assert.equal(uniqueName("   ", []), "Untitled dataset");
});

// A stand-in for localStorage.
function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

await check("migration: the single dataset of the old version moves to the shelf, with its analysis", async () => {
  resetMemoryForTests();
  const rows = dataset("old-uid", "x").rows;
  const store = fakeStore({
    "insightflow:dataset:v2": JSON.stringify({ uid: "old-uid", rows, label: "My old upload", context: "an app", stats: null }),
    "insightflow:analysis:v2": JSON.stringify({ datasetUid: "old-uid", labels: [] }),
    "insightflow:adaption-report:v3": JSON.stringify({ datasetUid: "old-uid", rowsSent: 5 }),
  });
  const result = await migrateLegacy(store);
  assert.equal(result.moved, true);
  const list = await listMeta();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "My old upload");
  assert.deepEqual(await getItem("analyses", "old-uid"), { datasetUid: "old-uid", labels: [] });
  assert.deepEqual(await getItem("adaption", "old-uid"), { datasetUid: "old-uid", rowsSent: 5 });
  assert.equal(store.map.has("insightflow:dataset:v2"), false); // freed up
  assert.equal(store.getItem("insightflow:active:v1"), "old-uid");
  assert.equal((await migrateLegacy(store)).moved, false); // never twice
});

await check("migration: an analysis that belongs to a different dataset is not attached", async () => {
  resetMemoryForTests();
  const store = fakeStore({
    "insightflow:dataset:v2": JSON.stringify({ uid: "u1", rows: dataset("u1", "x").rows, label: "One", context: "", stats: null }),
    "insightflow:analysis:v2": JSON.stringify({ datasetUid: "someone-else", labels: [] }),
  });
  await migrateLegacy(store);
  assert.equal(await getItem("analyses", "u1"), undefined);
});

await check("migration: nothing to move, or damaged data, is handled quietly", async () => {
  resetMemoryForTests();
  assert.equal((await migrateLegacy(fakeStore())).moved, false);
  const damaged = fakeStore({ "insightflow:dataset:v2": "{not json" });
  assert.equal((await migrateLegacy(damaged)).moved, false);
  assert.equal((await listMeta()).length, 0);
});

console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}.`);
