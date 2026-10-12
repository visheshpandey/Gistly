import Link from "next/link";

// The product name in the Fraunces serif with a yellow dot. It always links to the entry page.
// It takes its colour from where it sits, so it works on the dark bar and on light pages.
export function Brand() {
  return (
    <Link href="/" className="wordmark rounded-sm text-[1.45rem] leading-none" aria-label="InsightFlow home">
      InsightFlow
    </Link>
  );
}
