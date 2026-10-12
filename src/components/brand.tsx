import Link from "next/link";
import { BarChart3 } from "lucide-react";

// The product name, used in the app header and on the entry page. It always links to the entry page.
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-bold tracking-tight" aria-label="InsightFlow home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BarChart3 className="size-4" aria-hidden="true" />
      </span>
      <span className="text-lg">InsightFlow</span>
    </Link>
  );
}
