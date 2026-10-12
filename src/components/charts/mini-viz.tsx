import { cn } from "@/lib/utils";

// Small charts drawn with plain HTML and SVG. They need no chart library and no browser-only code, so the same
// pieces work on every page and in the printed report. Every chart has a text label for screen readers, and the
// numbers it shows always come from the caller (they are never estimated here).

const nf = new Intl.NumberFormat("en-US");
const pctText = (v: number) => `${Math.round(v * 100)}%`;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Positive, neutral and negative as one bar: green, sand, red.
export function SentimentBar({
  positive,
  neutral,
  negative,
  className,
}: {
  positive: number;
  neutral: number;
  negative: number;
  className?: string;
}) {
  const total = positive + neutral + negative;
  const share = (v: number) => (total > 0 ? v / total : 0);
  return (
    <div
      role="img"
      aria-label={`${pctText(share(positive))} positive, ${pctText(share(neutral))} neutral, ${pctText(share(negative))} negative`}
      className={cn("flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted", className)}
    >
      <span className="bg-pos" style={{ width: `${share(positive) * 100}%` }} />
      <span className="bg-neu" style={{ width: `${share(neutral) * 100}%` }} />
      <span className="bg-neg" style={{ width: `${share(negative) * 100}%` }} />
    </div>
  );
}

// One value as a filled bar. `reference` draws a thin ink marker, for example where the top problem sits.
export function MeterBar({
  value,
  reference,
  color = "var(--neg)",
  label,
  className,
}: {
  value: number; // 0 to 1
  reference?: number; // 0 to 1
  color?: string;
  label: string;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={cn("relative h-2.5 w-full rounded-full bg-muted", className)}>
      <span className="block h-full rounded-full" style={{ width: `${clamp01(value) * 100}%`, background: color }} />
      {reference !== undefined && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground"
          style={{ left: `calc(${clamp01(reference) * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

// A half-circle gauge with the value written in the middle.
export function Gauge({
  value,
  display,
  caption,
  color = "var(--pos)",
}: {
  value: number; // 0 to 1
  display: string;
  caption?: string;
  color?: string;
}) {
  const length = Math.PI * 50;
  return (
    <figure className="flex flex-col items-center" role="img" aria-label={`${display}${caption ? `, ${caption}` : ""}`}>
      <svg viewBox="0 0 120 70" className="w-36" aria-hidden="true">
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="var(--muted)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M10 62 A50 50 0 0 1 110 62"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${length * clamp01(value)} ${length}`}
        />
        <text x="60" y="58" textAnchor="middle" className="num-display" fontSize="20" fill="var(--foreground)">
          {display}
        </text>
      </svg>
      {caption && <figcaption className="mt-1 text-center text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

// Steps that get smaller, for example "rows read, unique, labelled".
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const colors = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--pos)"];
  return (
    <ol className="flex flex-col gap-2.5" aria-label="Data funnel">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col gap-1">
          <span className="flex justify-between gap-3 text-sm">
            <span>{s.label}</span>
            <span className="font-semibold tabular-nums">{nf.format(s.value)}</span>
          </span>
          <span className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%`, background: colors[i % colors.length] }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

// A row of tiny columns, for example negative mentions at severity 1 to 5.
export function MiniHistogram({
  values,
  colors,
  label,
  className,
}: {
  values: number[];
  colors: string[];
  label: string;
  className?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div role="img" aria-label={label} className={cn("flex h-8 items-end gap-1", className)}>
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: colors[i % colors.length], opacity: v === 0 ? 0.25 : 1 }}
        />
      ))}
    </div>
  );
}

// A small line for a series of shares, used next to a "rising / falling" takeaway.
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--neg)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// A ring chart with thin separators between slices and a total in the middle.
export function Donut({
  items,
  center,
  sub,
  size = 150,
}: {
  items: { name: string; value: number; color: string }[];
  center: string;
  sub: string;
  size?: number;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 40;
  const length = 2 * Math.PI * r;
  const gap = items.filter((i) => i.value > 0).length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={items.map((i) => `${i.name} ${total > 0 ? pctText(i.value / total) : "0%"}`).join(", ")}
      className="shrink-0"
    >
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
      {total > 0 &&
        items.map((i) => {
          const part = (i.value / total) * length;
          const dash = Math.max(0, part - gap);
          const el = (
            <circle
              key={i.name}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={i.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${length - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += part;
          return el;
        })}
      <text x="50" y="50" textAnchor="middle" className="num-display" fontSize="15" fill="var(--foreground)">
        {center}
      </text>
      <text x="50" y="62" textAnchor="middle" fontSize="6.5" fontWeight="600" letterSpacing="0.6" fill="var(--muted-foreground)">
        {sub.toUpperCase()}
      </text>
    </svg>
  );
}

export type MatrixPoint = {
  name: string;
  x: number; // share of all feedback, 0 to 1
  y: number; // negative share, 0 to 1
  size: number; // 0 to 1 (average severity / 5)
  rank: number; // priority rank, 1 = fix first
};

// Every theme placed by how much it is talked about (left to right) and how negative it is (bottom to top).
// Bubble size is severity. The top-right corner is what to fix first.
export function PriorityMatrix({ points, onSelect }: { points: MatrixPoint[]; onSelect?: (name: string) => void }) {
  const W = 640;
  const H = 360;
  const m = { l: 52, r: 24, t: 20, b: 46 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const maxX = Math.max(0.05, ...points.map((p) => p.x)) * 1.12;
  const X = (v: number) => m.l + (v / maxX) * iw;
  const Y = (v: number) => m.t + ih - v * ih;
  const midX = maxX / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const sorted = [...points].sort((a, b) => b.size - a.size); // big bubbles first so small ones stay on top
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block h-auto w-full min-w-[30rem] max-w-[46rem]"
        role="img"
        aria-label={`Priority matrix: ${[...points]
          .sort((a, b) => a.rank - b.rank)
          .map((p) => `${p.name}, ${pctText(p.x)} of feedback, ${pctText(p.y)} negative`)
          .join("; ")}`}
      >
        {/* the "fix first" corner */}
        <rect x={X(midX)} y={Y(1)} width={X(maxX) - X(midX)} height={Y(0.5) - Y(1)} fill="var(--neg)" opacity="0.07" />
        <text x={X(maxX) - 6} y={Y(1) + 16} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--neg)">
          FIX FIRST
        </text>
        <text x={X(0) + 6} y={Y(0) - 8} fontSize="11" fontWeight="600" fill="var(--muted-foreground)">
          small and mostly positive
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="var(--border)" />
            <text x={m.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
              {pctText(t)}
            </text>
          </g>
        ))}
        <line x1={X(midX)} x2={X(midX)} y1={m.t} y2={m.t + ih} stroke="var(--edge)" strokeDasharray="4 4" opacity="0.5" />
        <line x1={m.l} x2={W - m.r} y1={Y(0.5)} y2={Y(0.5)} stroke="var(--edge)" strokeDasharray="4 4" opacity="0.5" />
        <line x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} stroke="var(--edge)" strokeWidth="1.5" />
        <text x={m.l + iw / 2} y={H - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--muted-foreground)">
          Share of all feedback →
        </text>
        <text
          x={14}
          y={m.t + ih / 2}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="var(--muted-foreground)"
          transform={`rotate(-90 14 ${m.t + ih / 2})`}
        >
          Negative share →
        </text>
        {sorted.map((p) => {
          const cx = X(p.x);
          const cy = Y(p.y);
          const r = 7 + clamp01(p.size) * 15;
          const left = cx > W - m.r - 150;
          return (
            <g
              key={p.name}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={onSelect ? `${p.name}: show examples` : undefined}
              onClick={onSelect ? () => onSelect(p.name) : undefined}
              onKeyDown={onSelect ? (e) => (e.key === "Enter" || e.key === " ") && onSelect(p.name) : undefined}
              className={onSelect ? "cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--brand)]" : undefined}
            >
              <title>{`${p.name}: ${pctText(p.x)} of feedback, ${pctText(p.y)} negative, severity ${(p.size * 5).toFixed(1)} of 5`}</title>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={p.rank <= 3 ? "var(--neg)" : "var(--p2)"}
                fillOpacity="0.85"
                stroke="var(--edge)"
                strokeWidth="1.5"
              />
              <text
                x={left ? cx - r - 6 : cx + r + 6}
                y={cy + 4}
                textAnchor={left ? "end" : "start"}
                fontSize="12"
                fontWeight="600"
                fill="var(--foreground)"
                stroke="var(--card)"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {p.rank}. {short(p.name, 26)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// A grid where each cell's colour shows how negative that combination is.
export function Heatmap({
  rows,
  cols,
  cell,
  onSelectRow,
}: {
  rows: string[];
  cols: string[];
  cell: (row: string, col: string) => { negativeShare: number; mentions: number } | null;
  onSelectRow?: (row: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Theme
            </th>
            {cols.map((c) => (
              <th key={c} scope="col" className="px-1 pb-1 text-left align-bottom text-xs font-semibold text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className="max-w-[12rem] pr-2 text-left font-medium">
                {onSelectRow ? (
                  <button type="button" onClick={() => onSelectRow(r)} className="text-left hover:underline">
                    {short(r, 30)}
                  </button>
                ) : (
                  short(r, 30)
                )}
              </th>
              {cols.map((c) => {
                const v = cell(r, c);
                if (!v || v.mentions === 0) {
                  return (
                    <td key={c} className="rounded-md bg-muted/50 px-2 py-2 text-center text-xs text-muted-foreground">
                      –
                    </td>
                  );
                }
                const strength = Math.round(12 + clamp01(v.negativeShare) * 78);
                return (
                  <td
                    key={c}
                    title={`${r} × ${c}: ${pctText(v.negativeShare)} negative of ${nf.format(v.mentions)} mentions`}
                    className={cn(
                      "rounded-md px-2 py-2 text-center text-xs font-bold tabular-nums",
                      v.negativeShare > 0.55 ? "text-on-neg" : "text-foreground",
                    )}
                    style={{ background: `color-mix(in srgb, var(--neg) ${strength}%, var(--card))` }}
                  >
                    {pctText(v.negativeShare)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Share of negative feedback in each cell. Darker red means more complaints.</p>
    </div>
  );
}
