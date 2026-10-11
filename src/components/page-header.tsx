export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function Placeholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs text-muted-foreground">Planned for {phase}.</p>
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
