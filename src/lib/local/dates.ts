// Turns a cell into YYYY-MM-DD, or null if it does not look like a date.
export function normalizeDate(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || v.length < 6) return null;
  if (!/\d/.test(v) || !/[-/.:T]|[A-Za-z]{3}/.test(v)) return null;
  const time = Date.parse(v);
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  const year = date.getFullYear();
  if (year < 1990 || year > 2100) return null;
  // ISO dates (2026-03-04) already carry the right day. Other formats are read in local
  // time, so take the local day. Converting those to UTC could shift them by one day.
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
