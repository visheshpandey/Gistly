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

// One headline number with a label and a short note.
export function Stat({ label, value, note, tint }: { label: string; value: string; note: string; tint?: Tint }) {
  return (
    <Card className={cn(tint && TINT_CLASS[tint])}>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold tabular-nums tracking-tight md:text-4xl">{value}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
