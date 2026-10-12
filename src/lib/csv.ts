import type { FilePreview } from "./local/messages.ts";
import { TEXT_FIELD } from "./local/sources.ts";

export type ColumnMapping = {
  text: string; // required: the column that holds the feedback text
  category: string | null;
  date: string | null;
};

const TEXT_NAMES = /review|comment|feedback|text|message|response|description|remark|opinion|testimonial|verbatim/i;
const CATEGORY_NAMES = /categor|type|topic|segment|department|channel|region|product/i;
const DATE_NAMES = /date|time|created|timestamp|when|posted/i;

// Suggests a mapping from column names and what is in the columns. The user can change every choice.
export function guessMapping(preview: Pick<FilePreview, "fields" | "rows" | "format">): ColumnMapping {
  const { fields, rows } = preview;
  if (preview.format === "lines") return { text: TEXT_FIELD, category: null, date: null };

  let text = fields.find((f) => TEXT_NAMES.test(f));
  if (!text) {
    // Otherwise pick the column with the longest values on average, which is usually the text.
    let best = -1;
    fields.forEach((field, i) => {
      const total = rows.reduce((sum, r) => sum + (r[i]?.length ?? 0), 0);
      const avg = rows.length > 0 ? total / rows.length : 0;
      if (avg > best) {
        best = avg;
        text = field;
      }
    });
  }
  text = text ?? fields[0];

  const category = fields.find((f) => f !== text && CATEGORY_NAMES.test(f)) ?? null;
  const date = fields.find((f) => f !== text && f !== category && DATE_NAMES.test(f)) ?? null;
  return { text, category, date };
}
