import { IntakeFlow } from "@/components/candidate/intake-flow";

export default async function ReferralPage({
  params,
}: PageProps<"/referral/[jobId]">) {
  const { jobId } = await params;
  return <IntakeFlow jobId={jobId} />;
}
