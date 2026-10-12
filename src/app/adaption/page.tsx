import { AdaptionPanel } from "@/components/adaption-panel";
import { PageHeader } from "@/components/page-header";

export default function AdaptionPage() {
  return (
    <>
      <PageHeader
        title="Adaption"
        description="Remove duplicates and score the quality of your dataset before analysis."
      />
      <AdaptionPanel />
    </>
  );
}
