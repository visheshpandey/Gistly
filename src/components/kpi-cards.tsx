import { Stat, type Tint } from "@/components/stat";
import type { AnalysisMetrics } from "@/lib/analysis/metrics";
import type { DatasetSummary } from "@/lib/feedback-types";

// With an AI analysis, "Negative feedback" uses real sentiment. Without one it falls back to a keyword guess.
export function KpiCards({ summary, analysis }: { summary: DatasetSummary; analysis?: AnalysisMetrics | null }) {
  const nf = new Intl.NumberFormat("en-US");
  const items: { label: string; value: string; note: string; tint: Tint }[] = [
    { label: "Total feedback", value: nf.format(summary.total), note: "All mentions, repeats included", tint: "a" },
    {
      label: "Unique reviews",
      value: nf.format(summary.uniqueReviews),
      note: "Distinct review texts",
      tint: "d",
    },
    {
      label: "Categories",
      value: summary.hasCategory ? nf.format(summary.categories.length) : "None",
      note: summary.hasCategory ? "Topic groups" : "This dataset has no category column",
      tint: "c",
    },
    analysis
      ? {
          label: "Negative feedback",
          value: nf.format(analysis.negative),
          note: `AI sentiment: ${((analysis.negative / Math.max(1, analysis.labelledMentions)) * 100).toFixed(1)}% of labelled mentions`,
          tint: "b",
        }
      : {
          label: "Negative feedback",
          value: nf.format(summary.negativeEstimate),
          note: "Estimated from keywords. Run the AI analysis for real sentiment.",
          tint: "b",
        },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Stat key={item.label} {...item} />
      ))}
    </div>
  );
}
