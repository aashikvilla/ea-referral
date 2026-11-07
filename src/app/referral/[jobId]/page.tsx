import { Suspense } from "react";
import { IntakeFlow } from "@/components/candidate/intake-flow";

export default function ReferralPage(props: PageProps<"/referral/[jobId]">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-5 py-16" aria-busy="true">
          <p role="status">Loading sample role…</p>
        </main>
      }
    >
      <ReferralContent params={props.params} />
    </Suspense>
  );
}

async function ReferralContent({
  params,
}: {
  params: PageProps<"/referral/[jobId]">["params"];
}) {
  const { jobId } = await params;
  return <IntakeFlow jobId={jobId} />;
}
