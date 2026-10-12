import { Stat, type Tint } from "@/components/shared/stat";
import type { AnalysisMetrics } from "@/lib/analysis/metrics";
import type { DatasetSummary } from "@/lib/feedback-types";

// Sentiment only appears once the AI has labelled the reviews. Before that the card says so instead of guessing.
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
          value: "Not yet",
          note: "Run the AI analysis to see sentiment.",
          tint: "b",
        },
  ];

  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <Stat key={item.label} {...item} />
      ))}
    </div>
  );
}
