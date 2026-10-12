import { IssuesPanel } from "@/components/issues-panel";
import { PageHeader } from "@/components/page-header";

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
