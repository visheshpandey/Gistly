"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  Lightbulb,
  ListChecks,
  Menu,
  MessageSquareText,
  Search,
  Sparkles,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/analysis", label: "AI Analysis", icon: Sparkles },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/issues", label: "Issues", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/adaption", label: "Adaption", icon: Database },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center px-5 text-base font-semibold tracking-tight">
          Gistly
        </div>
        <NavLinks />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-lg">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="text-base font-semibold tracking-tight">Gistly</span>
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-md p-1 hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-md p-2 hover:bg-muted md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <span className="font-semibold tracking-tight md:hidden">Gistly</span>
          <div className="relative ml-auto w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              disabled
              aria-label="Global search (coming soon)"
              placeholder="Search everything (coming soon)"
              className="h-9 w-full rounded-lg border bg-muted/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
