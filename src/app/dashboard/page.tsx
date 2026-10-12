import { DashboardView } from "@/features/dashboard/dashboard-view";
import { PageHeader } from "@/components/layout/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What your customers say, how they feel, and what to fix first."
      />
      <DashboardView />
    </>
  );
}
