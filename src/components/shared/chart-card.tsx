import { Card, CardContent } from "@/components/ui/card";

// A card that answers one question: a serif title with the yellow bar, an optional short note, then the chart.
export function ChartCard({
  question,
  note,
  children,
  className,
}: {
  question: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col gap-4">
        <div>
          <h2 className="title-bar text-xl font-semibold">{question}</h2>
          {note && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{note}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
