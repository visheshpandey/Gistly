import { FeedbackTable } from "@/components/feedback-table";
import { KpiCards } from "@/components/kpi-cards";
import { ErrorState, PageHeader } from "@/components/page-header";
import { loadFeedback } from "@/lib/feedback";

export default async function FeedbackPage() {
  const data = await loadFeedback();

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Browse the dataset. Identical reviews are grouped and counted under Occurrences."
      />
      {data.error ? (
        <ErrorState message={data.error} />
      ) : (
        <div className="flex flex-col gap-6">
          <KpiCards data={data} />
          <FeedbackTable rows={data.rows} categories={data.categories} />
        </div>
      )}
    </>
  );
}
