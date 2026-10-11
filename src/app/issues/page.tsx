import { PageHeader, Placeholder } from "@/components/page-header";

export default function IssuesPage() {
  return (
    <>
      <PageHeader
        title="Issues"
        description="Track the problems you decide to act on."
      />
      <Placeholder
        title="No issues saved"
        description="Save an issue from a recommendation to track its status here."
        phase="the issue tracking phase"
      />
    </>
  );
}
