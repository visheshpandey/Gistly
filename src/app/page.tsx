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
    tint: "bg-tint-a",
  },
  {
    icon: Sparkles,
    title: "AI reads every review",
    text: "Each unique review gets a sentiment, a theme, a severity and a main issue. Counts are calculated by code, never by the AI.",
    tint: "bg-tint-d",
  },
  {
    icon: BarChart3,
    title: "A dashboard that answers questions",
    text: "Key numbers, trends and top complaints. Filter by category, sentiment, theme or date and everything updates together.",
    tint: "bg-tint-c",
  },
  {
    icon: Lightbulb,
    title: "Know what to fix first",
    text: "Problems ranked by a priority score, with the numbers and a plain reason for every rank, plus a suggested action.",
    tint: "bg-tint-b",
  },
  {
    icon: ClipboardList,
    title: "Track the fixes",
    text: "Save a problem, set it to open, in progress or resolved, and see how it moves against today's numbers.",
    tint: "bg-tint-e",
  },
  {
    icon: FileText,
    title: "Share a report",
    text: "A clean report you can print to PDF or send as a link. No account needed to read it.",
    tint: "bg-tint-a",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Import and clean",
    text: "Your file is read in your browser. Repeats are merged into one entry with a count, so volume stays accurate. Adaption can double-check the quality on a sample.",
  },
  {
    n: "2",
    title: "Analyse",
    text: "The AI labels each unique review. Only new feedback is analysed when you add more, so it stays fast.",
  },
  {
    n: "3",
    title: "Decide",
    text: "See the ranked priorities, ask questions in plain English, save issues and share the report with your team.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <GoToDashboardAfterImport />
      <header className="mx-auto flex w-full max-w-[1240px] items-center gap-3 px-4 py-4 md:px-8">
        <Brand />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
            Open dashboard
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-10 md:px-8 md:pb-24 md:pt-20">
          <p className="mb-4 inline-flex rounded-full border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customer feedback analysis
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            AI-powered feedback intelligence.
            <br />
            <span className="text-primary">From raw signal to ranked decisions.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            InsightFlow shows what customers feel, what they keep complaining about, and what to fix first, with the
            real reviews and numbers behind every answer.
          </p>
          <div className="mt-8">
            <LandingActions />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No login. The sample has 7,000 reviews that collapse into 317 unique ones, so you can explore straight away.
          </p>
        </section>

        <section aria-labelledby="what" className="mx-auto w-full max-w-[1240px] px-4 pb-16 md:px-8 md:pb-24">
          <h2 id="what" className="text-2xl font-bold tracking-tight md:text-3xl">
            Everything from raw feedback to a shared report
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, tint }) => (
              <div key={title} className={cn("rounded-xl p-6", tint)}>
                <Icon className="size-6" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto w-full max-w-[1240px] px-4 pb-16 md:px-8 md:pb-24">
          <h2 id="how" className="text-2xl font-bold tracking-tight md:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy" className="mx-auto w-full max-w-[1240px] px-4 pb-16 md:px-8 md:pb-24">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 md:flex-row md:items-start md:p-8">
            <ShieldCheck className="size-8 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 id="privacy" className="text-xl font-bold tracking-tight">
                Your data stays in your browser
              </h2>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                Files are read and stored on your own computer. Only the review text is sent to the AI when you run an
                analysis, and a small sample goes to Adaption only if you choose to run its quality check. You always
                see what is sent first.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 pb-20 md:px-8">
          <div className="rounded-xl bg-tint-a p-8 md:p-12">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight md:text-3xl">
              See it on real-looking data in under a minute.
            </h2>
            <div className="mt-6">
              <LandingActions />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground md:px-8">
          <span>InsightFlow · Build Battle 2026</span>
          <Link href="/dashboard" className="underline underline-offset-4">
            Go to the dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
