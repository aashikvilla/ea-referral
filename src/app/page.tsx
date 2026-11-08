import { CandidateShell } from "@/components/candidate/candidate-shell";
import { ReferralHome } from "@/components/candidate/referral-home";

export default function Home() {
  return (
    <CandidateShell showFooter={false}>
      <ReferralHome />
    </CandidateShell>
  );
}
