"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { DatasetSwitcher } from "@/components/dataset-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/feedback", label: "Feedback" },
  { href: "/analysis", label: "AI Analysis" },
  { href: "/ask", label: "Ask" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/issues", label: "Issues" },
  { href: "/reports", label: "Reports" },
  { href: "/adaption", label: "Adaption" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The entry page and the printable report view bring their own layout.
  if (pathname === "/" || pathname.startsWith("/reports/view")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The dark ink bar: name and dataset controls on top, the tabs below. Only the tabs stay pinned when scrolling. */}
      <div className="nav-dark bg-nav text-nav-ink print:hidden">
        <header className="page-width flex flex-wrap items-center gap-x-4 gap-y-2 pt-3.5 pb-1">
          <Brand />
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
            <DatasetSwitcher />
            <ThemeToggle />
          </div>
        </header>
      </div>

      <nav aria-label="Main" className="nav-dark sticky top-0 z-30 bg-nav print:hidden">
        <div className="no-scrollbar page-width flex gap-1 overflow-x-auto">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-[3px] px-3.5 pt-3 pb-2.5 text-[0.9375rem] font-semibold transition-colors",
                  active ? "border-hl text-hl" : "border-transparent text-nav-mute hover:text-nav-ink",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="page-width flex-1 py-6 md:py-8 print:max-w-none print:p-0">{children}</main>

      <footer className="mt-8 border-t-4 border-hl bg-nav text-nav-mute print:hidden">
        <div className="page-width flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-5 text-sm">
          <span>
            <b className="font-semibold text-nav-ink">Verdict</b> · customer feedback into priorities
          </span>
          <span>Every number is calculated from your data. The AI only labels and explains.</span>
        </div>
      </footer>
    </div>
  );
}
