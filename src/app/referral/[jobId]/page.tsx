import { Suspense } from "react";
import { CandidateGuide } from "@/components/candidate/candidate-guide";
import { CandidateShell } from "@/components/candidate/candidate-shell";
import { IntakeFlow } from "@/components/candidate/intake-flow";

export default function ReferralPage(props: PageProps<"/referral/[jobId]">) {
  return (
    <Suspense
      fallback={
        <CandidateShell>
          <main className="mx-auto max-w-4xl px-5 py-16" aria-busy="true">
            <CandidateGuide
              mood="checking"
              layout="compact"
              title="Checking the listing."
              message="I’m making sure requests are available before asking for details."
            />
            <p className="sr-only" role="status">
              Checking listing availability.
            </p>
          </main>
        </CandidateShell>
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
