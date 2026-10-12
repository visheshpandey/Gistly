import { PageHeader } from "@/components/layout/page-header";
import { RecommendationsPanel } from "@/features/recommendations/recommendations-panel";

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
