import { PageHeader, Placeholder } from "@/components/page-header";

export default function AnalysisPage() {
  return (
    <>
      <PageHeader
        title="AI Analysis"
        description="Sentiment, themes and issue groups for your feedback."
      />
      <Placeholder
        title="No analysis yet"
        description="Once feedback is analyzed, sentiment and themes will show up here."
        phase="the AI analysis phase"
      />
    </>
  );
}
