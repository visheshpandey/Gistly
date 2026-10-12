import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Shown for any address that does not exist.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border-[1.5px] border-edge bg-card p-8 text-center shadow-[3px_3px_0_var(--edge)]">
      <h1 className="title-bar text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">This address does not exist. The dashboard is a good place to start.</p>
      <Link href="/dashboard" className={buttonVariants()}>
        Go to the dashboard
      </Link>
    </div>
  );
}
