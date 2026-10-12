import { PageHeader } from "@/components/page-header";
import { ReportsPanel } from "@/components/reports-panel";

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
