import { PageHeader, Placeholder } from "@/components/page-header";

export default function AdaptionPage() {
  return (
    <>
      <PageHeader
        title="Adaption"
        description="Deduplicate and enrich your dataset before analysis."
      />
      <Placeholder
        title="Adaption is not connected"
        description="Dataset preparation runs on the server. No API key is needed in the browser."
        phase="the Adaption phase"
      />
    </>
  );
}
