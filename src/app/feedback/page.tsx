import { FeedbackWorkspace } from "@/components/feedback-workspace";
import { PageHeader } from "@/components/page-header";

export default function FeedbackPage() {
  return (
    <>
      <PageHeader
        title="Feedback"
        description="Browse, import and add feedback. Identical reviews are grouped and counted under Occurrences."
      />
      <FeedbackWorkspace />
    </>
  );
}
