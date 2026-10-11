import { KpiCards } from "@/components/kpi-cards";
import { ErrorState, PageHeader, Placeholder } from "@/components/page-header";
import { loadFeedback } from "@/lib/feedback";

export default async function DashboardPage() {
  const data = await loadFeedback();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your customer feedback."
      />
      {data.error ? (
        <ErrorState message={data.error} />
      ) : (
        <div className="flex flex-col gap-6">
          <KpiCards data={data} />
          <Placeholder
            title="Charts and trends are coming"
            description="Sentiment, themes and volume over time will appear here once AI analysis is in place."
            phase="a later phase"
          />
        </div>
      )}
    </>
  );
}
