import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  FileText,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { GoToDashboardAfterImport, LandingActions } from "@/components/landing-actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "InsightFlow: customer feedback into decisions",
  description: "Import feedback, see what customers feel, find out what to fix first, and share a report.",
};

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Bring in any feedback",
    text: "Upload CSV, Excel, JSON or text files, or paste reviews. Every upload becomes its own dataset, and nothing is overwritten.",
  },
  {
    icon: Sparkles,
    title: "AI reads every review",
    text: "Each unique review gets a sentiment, a theme, a severity and a main issue. Counts are calculated by code, never by the AI.",
  },
  {
    icon: BarChart3,
    title: "A dashboard that answers questions",
    text: "Key numbers, trends and top complaints. Filter by category, sentiment, theme or date and everything updates together.",
  },
  {
    icon: Lightbulb,
    title: "Know what to fix first",
    text: "Problems ranked by a priority score, with the numbers and a plain reason for every rank, plus a suggested action.",
  },
  {
    icon: ClipboardList,
    title: "Track the fixes",
    text: "Save a problem, set it to open, in progress or resolved, and see how it moves against today's numbers.",
  },
  {
    icon: FileText,
    title: "Share a report",
    text: "A clean report you can print to PDF or send as a link. No account needed to read it.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Import and clean",
    text: "Your file is read in your browser. Repeats are merged into one entry with a count, so volume stays accurate. Adaption can double-check the quality on a sample.",
  },
  {
    n: "02",
    title: "Analyse",
    text: "The AI labels each unique review. Only new feedback is analysed when you add more, so it stays fast.",
  },
  {
    n: "03",
    title: "Decide",
    text: "See the ranked priorities, ask questions in plain English, save issues and share the report with your team.",
  },
];

// Plain facts about the product and the built-in sample. None of these are estimates.
const FACTS = [
  { value: "7,000", label: "sample reviews" },
  { value: "317", label: "unique after cleaning" },
  { value: "6", label: "file formats, or paste" },
  { value: "0", label: "logins needed" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <GoToDashboardAfterImport />
      <header className="nav-dark bg-nav text-nav-ink">
        <div className="flex page-width items-center gap-3 py-4">
          <Brand />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              data-slot="button"
              data-variant="outline"
              className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}
            >
              Open dashboard
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="page-width pb-14 pt-12 md:pb-20 md:pt-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-brand">Customer feedback analysis</p>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.08] md:text-6xl">
            AI-powered feedback intelligence.
            <br />
            <span className="text-brand">From raw signal to ranked decisions.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            InsightFlow shows what customers feel, what they keep complaining about, and what to fix first, with the
            real reviews and numbers behind every answer.
          </p>
          <div className="mt-8">
            <LandingActions />
          </div>

          <dl className="mt-14 grid grid-cols-2 border-y-[1.5px] border-edge md:grid-cols-4">
            {FACTS.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  "py-5 pr-4",
                  i % 2 === 1 ? "border-l pl-5" : "pl-0",
                  i >= 2 && "border-t md:border-t-0",
                  i === 2 && "md:border-l",
                  i > 0 && "md:pl-6",
                )}
              >
                <dt className="sr-only">{f.label}</dt>
                <dd className="num-display text-4xl tabular-nums">{f.value}</dd>
                <dd className="mt-1 text-sm text-muted-foreground">{f.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="what" className="page-width pb-16 md:pb-24">
          <h2 id="what" className="title-bar text-2xl font-semibold md:text-3xl">
            Everything from raw feedback to a shared report
          </h2>
          {/* A ruled grid instead of separate cards: one outline, thin lines between the items. */}
          <div className="mt-8 grid overflow-hidden rounded-lg border-[1.5px] border-edge bg-card shadow-[3px_3px_0_var(--edge)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="-mb-px -mr-px border-b border-r p-6 md:p-7">
                <span className="flex size-9 items-center justify-center rounded-md border-[1.5px] border-edge bg-hl text-[#1c1b2e]">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="how" className="page-width pb-16 md:pb-24">
          <h2 id="how" className="title-bar text-2xl font-semibold md:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t-2 border-foreground pt-5">
                <span className="text-sm font-bold tabular-nums tracking-wider text-brand">{s.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy" className="page-width pb-16 md:pb-24">
          <div className="grid gap-4 border-y py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 size-6 shrink-0 text-brand" aria-hidden="true" />
              <h2 id="privacy" className="text-xl font-bold tracking-tight">
                Your data stays in your browser
              </h2>
            </div>
            <p className="max-w-3xl text-[0.9375rem] leading-relaxed text-muted-foreground">
              Files are read and stored on your own computer. Only the review text is sent to the AI when you run an
              analysis, and a small sample goes to Adaption only if you choose to run its quality check. You always see
              what is sent first.
            </p>
          </div>
        </section>

        <section className="page-width pb-20">
          <div className="nav-dark flex flex-col gap-6 rounded-lg border-[1.5px] border-edge bg-nav p-8 text-nav-ink shadow-[3px_3px_0_var(--hl)] md:flex-row md:items-center md:justify-between md:p-12">
            <h2 className="max-w-xl text-2xl font-semibold text-nav-ink md:text-3xl">
              See it on real-looking data in under a minute.
            </h2>
            <LandingActions tone="dark" />
          </div>
        </section>
      </main>

      <footer className="border-t-4 border-hl bg-nav text-nav-mute">
        <div className="flex page-width flex-wrap items-center justify-between gap-2 py-6 text-sm">
          <span><b className="font-semibold text-nav-ink">InsightFlow</b> · Build Battle 2026</span>
          <Link href="/dashboard" className="text-nav-ink underline underline-offset-4 hover:text-hl">
            Go to the dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
