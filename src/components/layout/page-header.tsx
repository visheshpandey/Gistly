// Page title and one-line description, plus the shared error box.
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-1.5 max-w-prose text-[0.9375rem] text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm"
    >
      <p className="font-medium text-destructive">Could not load feedback</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  );
}
