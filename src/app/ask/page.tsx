import { AskPanel } from "@/components/ask-panel";
import { PageHeader } from "@/components/page-header";

export default function AskPage() {
  return (
    <>
      <PageHeader
        title="Ask"
        description="Ask your own questions about your feedback and get answers backed by the real reviews."
      />
      <AskPanel />
    </>
  );
}
