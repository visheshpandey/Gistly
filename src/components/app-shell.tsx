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
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-[1240px] px-4 md:px-8">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 print:hidden">
          <Brand />
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
            <DatasetSwitcher />
            <ThemeToggle />
          </div>
        </header>
      </div>

      <nav
        aria-label="Main"
        className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden"
      >
        <div className="no-scrollbar mx-auto flex w-full max-w-[1240px] gap-1 overflow-x-auto px-4 md:px-8">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px shrink-0 whitespace-nowrap border-b-[3px] px-3.5 py-3 text-[15px] font-semibold transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1240px] px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
