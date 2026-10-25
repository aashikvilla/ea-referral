import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import {
  CandidateShell,
  Eyebrow,
} from "@/components/candidate/candidate-shell";

export default function SignInPage() {
  return (
    <CandidateShell>
      <section className="mx-auto max-w-xl px-5 pt-10 pb-12 sm:px-8 sm:pt-16">
        <Eyebrow>Secure sign in</Eyebrow>
        <h1 className="mt-4 font-serif text-5xl leading-tight tracking-[-0.04em] text-[#173d32]">
          Your status stays private.
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#52645d]">
          Verify your email with a one-time code to view your own referral
          request.
        </p>
        <div className="mt-8 rounded-[1.5rem] border border-[#dce3dd] bg-white p-5 shadow-[0_24px_70px_-48px_rgba(23,61,50,0.28)] sm:p-7">
          <Suspense fallback={<p>Loading sign-in…</p>}>
            <SignInForm />
          </Suspense>
        </div>
      </section>
    </CandidateShell>
  );
}
