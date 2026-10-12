import { cn } from "@/lib/utils";

// One pill button in a filter group. Pressed (yellow) means "only show this".
export function FilterChip({
  pressed,
  onClick,
  dot,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  dot?: string; // optional colour dot, for example the sentiment colour
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border-[1.5px] px-3 py-1 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed ? "border-edge bg-hl font-bold text-[#1c1b2e]" : "border-edge bg-card text-foreground hover:bg-muted",
      )}
    >
      {dot && (
        <span
          className={cn("size-2 rounded-full", pressed && "ring-2 ring-[#1c1b2e]")}
          style={{ background: dot }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
