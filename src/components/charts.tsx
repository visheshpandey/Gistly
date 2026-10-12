"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisMetrics } from "@/lib/analysis/metrics";
import type { TrendPoint } from "@/lib/analysis/filters";

// Colours carry meaning everywhere: green = positive, grey = neutral, red = negative.
// They are CSS variables from globals.css, so the charts follow the light or dark theme by themselves.
export const COLORS = { positive: "var(--pos)", neutral: "var(--neu)", negative: "var(--neg)", accent: "var(--primary)" };
const SEVERITY_COLORS = ["#f2c14e", "#f0a03c", "#e8772e", "#dd4b2c", "#b71c2b"]; // minor to severe
const nf = new Intl.NumberFormat("en-US");
const AXIS = { fontSize: 12, fill: "currentColor" };
const GRID = { stroke: "var(--border)" };
const TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 14px rgb(0 0 0 / 0.12)",
  },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 2 },
  cursor: { fill: "var(--muted)", fillOpacity: 0.6 },
};

const short = (s: string, max = 24) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Every chart sits in a labelled box. The same numbers are also written out in the cards, for screen readers.
function Frame({ label, height = 260, children }: { label: string; height?: number; children: React.ReactElement }) {
  return (
    <div role="img" aria-label={label} className="w-full text-muted-foreground" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// A ring with the total in the middle and a legend that shows each share and count.
export function SentimentDonut({ m }: { m: AnalysisMetrics }) {
  const all = [
    { name: "Positive", value: m.positive, color: COLORS.positive },
    { name: "Neutral", value: m.neutral, color: COLORS.neutral },
    { name: "Negative", value: m.negative, color: COLORS.negative },
  ];
  const data = all.filter((d) => d.value > 0);
  const total = Math.max(1, m.labelledMentions);
  const share = (v: number) => `${((v / total) * 100).toFixed(1)}%`;
  return (
    <div
      role="img"
      aria-label={all.map((d) => `${d.name} ${share(d.value)}`).join(", ")}
      className="flex flex-wrap items-center gap-x-8 gap-y-4"
    >
      <div className="relative size-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v) => `${nf.format(Number(v))} mentions`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">{nf.format(m.labelledMentions)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">mentions</span>
        </div>
      </div>
      <ul className="flex min-w-40 flex-1 flex-col gap-3">
        {all.map((d) => (
          <li key={d.name} className="flex items-center gap-3 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden="true" />
            <span className="flex-1">{d.name}</span>
            <span className="font-semibold tabular-nums">{share(d.value)}</span>
            <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{nf.format(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Negative mentions per theme, biggest first, with the count written at the end of each bar.
// Clicking a bar opens the examples.
export function ThemeBars({ m, onSelect }: { m: AnalysisMetrics; onSelect: (theme: string) => void }) {
  const data = m.themes
    .filter((t) => t.negative > 0)
    .sort((a, b) => b.negative - a.negative)
    .slice(0, 6)
    .map((t) => ({ theme: t.theme, negative: t.negative }));
  const max = Math.max(1, data[0]?.negative ?? 1);
  const total = Math.max(1, m.negative);
  // Plain HTML rows (name above the bar) so long theme names never squeeze the bars on a phone.
  return (
    <ul className="flex flex-col gap-3" aria-label="Negative mentions by theme">
      {data.map((d, i) => (
        <li key={d.theme}>
          <button
            type="button"
            onClick={() => onSelect(d.theme)}
            className="group flex w-full flex-col gap-1.5 rounded-lg px-1 py-1 text-left"
            aria-label={`${d.theme}: ${nf.format(d.negative)} negative mentions. Show examples.`}
          >
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium group-hover:underline">{d.theme}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{nf.format(d.negative)}</span>{" "}
                <span className="text-xs text-muted-foreground">{((d.negative / total) * 100).toFixed(0)}%</span>
              </span>
            </span>
            <span className="h-3 w-full overflow-hidden rounded-full bg-muted">
              {/* The biggest problem is the strongest red; the rest fade a little so the ranking reads at a glance. */}
              <span
                className="block h-full rounded-full"
                style={{ width: `${(d.negative / max) * 100}%`, background: COLORS.negative, opacity: 1 - i * 0.11 }}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Share of positive, neutral and negative feedback inside each category, with the shares written on the bars.
export function CategoryStack({ m }: { m: AnalysisMetrics }) {
  const data = (m.byCategory ?? []).map((c) => ({
    category: c.category,
    Positive: c.mentions > 0 ? (c.positive / c.mentions) * 100 : 0,
    Neutral: c.mentions > 0 ? (c.neutral / c.mentions) * 100 : 0,
    Negative: c.mentions > 0 ? (c.negative / c.mentions) * 100 : 0,
  }));
  const inside = (v: unknown) => (Number(v) >= 9 ? `${Math.round(Number(v))}%` : "");
  const labelStyle = { fontSize: 11, fontWeight: 600, fill: "var(--background)" };
  return (
    <div className="flex flex-col gap-2">
      <Frame
        label={`Sentiment by category: ${data.map((d) => `${d.category} ${d.Negative.toFixed(0)}% negative`).join(", ")}`}
        height={Math.max(160, data.length * 46 + 20)}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="category"
            width={130}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => short(String(v), 20)}
          />
          <Tooltip {...TOOLTIP} formatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Bar dataKey="Positive" stackId="s" fill={COLORS.positive} isAnimationActive={false} radius={[6, 0, 0, 6]}>
            <LabelList dataKey="Positive" position="center" formatter={inside} style={labelStyle} />
          </Bar>
          <Bar dataKey="Neutral" stackId="s" fill={COLORS.neutral} isAnimationActive={false}>
            <LabelList dataKey="Neutral" position="center" formatter={inside} style={labelStyle} />
          </Bar>
          <Bar dataKey="Negative" stackId="s" fill={COLORS.negative} isAnimationActive={false} radius={[0, 6, 6, 0]}>
            <LabelList dataKey="Negative" position="center" formatter={inside} style={labelStyle} />
          </Bar>
        </BarChart>
      </Frame>
      <SentimentKey />
    </div>
  );
}

function SentimentKey() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
      {(["positive", "neutral", "negative"] as const).map((k) => (
        <li key={k} className="flex items-center gap-1.5 capitalize">
          <span className="size-2.5 rounded-full" style={{ background: COLORS[k] }} />
          {k}
        </li>
      ))}
    </ul>
  );
}

// How serious the complaints are: minor (1) to severe (5), with the count on top of each bar.
export function SeverityBars({ m }: { m: AnalysisMetrics }) {
  const names = ["Minor", "Low", "Medium", "High", "Severe"];
  const data = m.severity.map((value, i) => ({ level: `${i + 1} ${names[i]}`, value }));
  return (
    <Frame label={`Negative mentions by severity 1 to 5: ${data.map((d) => `${d.level}: ${nf.format(d.value)}`).join(", ")}`}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 24, bottom: 4 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="level" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
        <YAxis hide />
        <Tooltip {...TOOLTIP} formatter={(v) => [`${nf.format(Number(v))} negative mentions`, ""]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.level} fill={SEVERITY_COLORS[i]} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: unknown) => (Number(v) > 0 ? nf.format(Number(v)) : "")}
            style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }}
          />
        </Bar>
      </BarChart>
    </Frame>
  );
}

// Negative share over time as a shaded line, with a dashed line at the average so rises and falls stand out.
export function TrendLine({ points }: { points: TrendPoint[] }) {
  const data = points.map((p) => ({ date: p.date, negative: Math.round(p.negativeShare * 1000) / 10 }));
  const avg = data.length > 0 ? data.reduce((s, d) => s + d.negative, 0) / data.length : 0;
  return (
    <Frame label={`Negative share over time, from ${data[0]?.date ?? ""} to ${data[data.length - 1]?.date ?? ""}`}>
      <AreaChart data={data} margin={{ left: 0, right: 16, top: 8 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--neg)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} width={44} />
        <Tooltip {...TOOLTIP} cursor={{ stroke: "var(--muted-foreground)" }} formatter={(v) => [`${Number(v).toFixed(1)}% negative`, ""]} />
        <ReferenceLine
          y={avg}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{ value: `average ${avg.toFixed(0)}%`, position: "insideTopRight", fontSize: 11, fill: "currentColor" }}
        />
        <Area
          type="monotone"
          dataKey="negative"
          stroke={COLORS.negative}
          strokeWidth={2.5}
          fill="url(#trend-fill)"
          dot={data.length < 40 ? { r: 3, fill: "var(--neg)", strokeWidth: 0 } : false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </Frame>
  );
}
