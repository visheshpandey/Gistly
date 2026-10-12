import { FeedbackWorkspace } from "@/features/feedback/feedback-workspace";
import { PageHeader } from "@/components/layout/page-header";

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
