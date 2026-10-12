import { AnalysisPanel } from "@/features/analysis/analysis-panel";
import { PageHeader } from "@/components/layout/page-header";

export default function AnalysisPage() {
  return (
    <>
      <PageHeader
        title="AI Analysis"
        description="Sentiment, themes and the main problems in your feedback."
      />
      <AnalysisPanel />
    </>
  );
}
