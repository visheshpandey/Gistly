import { IssuesPanel } from "@/features/issues/issues-panel";
import { PageHeader } from "@/components/layout/page-header";

export default function IssuesPage() {
  return (
    <>
      <PageHeader
        title="Issues"
        description="Track the problems you decided to act on, and see whether they are shrinking."
      />
      <IssuesPanel />
    </>
  );
}
