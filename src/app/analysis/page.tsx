import { AnalysisPanel } from "@/components/analysis-panel";
import { PageHeader } from "@/components/page-header";

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
