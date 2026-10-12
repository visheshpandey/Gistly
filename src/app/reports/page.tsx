import { PageHeader } from "@/components/layout/page-header";
import { ReportsPanel } from "@/features/reports/reports-panel";

export default function ReportsPage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="A report you can send to your team: download it as a PDF or share a link."
        />
      </div>
      <ReportsPanel />
    </>
  );
}
