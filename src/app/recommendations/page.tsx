import { PageHeader, Placeholder } from "@/components/page-header";

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        title="Recommendations"
        description="Prioritized issues with the evidence behind each one."
      />
      <Placeholder
        title="No recommendations yet"
        description="Recommendations are generated after feedback has been analyzed."
        phase="the recommendations phase"
      />
    </>
  );
}
