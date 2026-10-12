import { AskPanel } from "@/features/ask/ask-panel";
import { PageHeader } from "@/components/layout/page-header";

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
