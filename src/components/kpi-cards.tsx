import { Card, CardContent } from "@/components/ui/card";
import type { FeedbackData } from "@/lib/feedback";

export function KpiCards({ data }: { data: FeedbackData }) {
  const nf = new Intl.NumberFormat("en-US");
  const items = [
    { label: "Total feedback", value: nf.format(data.total), note: "All rows in the dataset" },
    {
      label: "Unique reviews",
      value: nf.format(data.uniqueReviews),
      note: "Distinct review texts",
    },
    { label: "Categories", value: nf.format(data.categories.length), note: "Topic groups" },
    {
      label: "Negative feedback",
      value: nf.format(data.negativeEstimate),
      note: "Estimated from keywords. AI sentiment replaces this later.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
