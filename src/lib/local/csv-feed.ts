import type { ColumnMapping } from "../csv.ts";
import { normalizeDate } from "./dates.ts";
import type { DedupeEngine } from "./engine.ts";

// Feeds CSV rows (as arrays of cells) into the engine. The first row it sees must be the header.
// Used by the worker (browser), the server (sample file) and the benchmark, so all three behave the same.
export class CsvFeeder {
  private engine: DedupeEngine;
  private mapping: ColumnMapping;
  private textIdx = -1;
  private categoryIdx = -1;
  private dateIdx = -1;
  private ready = false;

  feedMs = 0; // time spent turning rows into engine calls (not file reading)
  invalidDates = 0;

  constructor(mapping: ColumnMapping, engine: DedupeEngine) {
    this.mapping = mapping;
    this.engine = engine;
  }

  feed(rows: string[][]): void {
    const started = performance.now();
    let start = 0;

    if (!this.ready) {
      const header = (rows[0] ?? []).map((h) => h.trim());
      this.textIdx = header.indexOf(this.mapping.text);
      this.categoryIdx = this.mapping.category ? header.indexOf(this.mapping.category) : -1;
      this.dateIdx = this.mapping.date ? header.indexOf(this.mapping.date) : -1;
      if (this.textIdx < 0) {
        throw new Error(`The column "${this.mapping.text}" was not found in the file.`);
      }
      this.ready = true;
      start = 1;
    }

    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      let date: string | null = null;
      if (this.dateIdx >= 0) {
        const cell = row[this.dateIdx];
        date = normalizeDate(cell);
        if (cell && cell.trim() && !date) this.invalidDates += 1;
      }
      this.engine.addRow(
        row[this.textIdx] ?? "",
        this.categoryIdx >= 0 ? (row[this.categoryIdx] ?? "").trim() || null : null,
        date,
      );
    }
    this.feedMs += performance.now() - started;
  }
}
