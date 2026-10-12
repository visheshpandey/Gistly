import { PageHeader } from "@/components/page-header";
import { RecommendationsPanel } from "@/components/recommendations-panel";

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        title="Recommendations"
        description="The problems to fix first, with the numbers behind each ranking."
      />
      <RecommendationsPanel />
    </>
  );
}
