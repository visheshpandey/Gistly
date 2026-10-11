import { PageHeader, Placeholder } from "@/components/page-header";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Export or share a summary of your findings."
      />
      <Placeholder
        title="No reports yet"
        description="Reports you create will be listed here."
        phase="the reports phase"
      />
    </>
  );
}
