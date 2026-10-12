// One headline number card (label, value, optional small chart, note).
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Tint = "a" | "b" | "c" | "d" | "e";

// Soft background colours for the number cards. They carry no meaning on their own, they just make the row easy to scan.
export const TINT_CLASS: Record<Tint, string> = {
  a: "bg-tint-a ring-0",
  b: "bg-tint-b ring-0",
  c: "bg-tint-c ring-0",
  d: "bg-tint-d ring-0",
  e: "bg-tint-e ring-0",
};

// One headline number with a label, an optional small chart, and a short note.
export function Stat({
  label,
  value,
  note,
  tint,
  visual,
}: {
  label: string;
  value: string;
  note: string;
  tint?: Tint;
  visual?: React.ReactNode;
}) {
  return (
    <Card className={cn(tint && TINT_CLASS[tint])}>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="num-display text-3xl tabular-nums md:text-4xl">{value}</p>
        {visual && <div className="my-1.5">{visual}</div>}
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
