import Link from "next/link";
import {
  CandidateShell,
  Eyebrow,
} from "@/components/candidate/candidate-shell";

export default function PrivacyPage() {
  return (
    <CandidateShell>
      <article className="mx-auto max-w-3xl px-5 pt-10 pb-8 sm:px-8 sm:pt-16">
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="mt-4 text-4xl leading-tight font-bold tracking-[-0.04em] text-[#142b4b] sm:text-5xl">
          Your information, plainly.
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#526174]">
          With Aashik is an independent personal referral assistant, not an EA
          service. A request asks an employee to consider referring you; it is
          not an application to EA. EA makes all hiring decisions.
        </p>

        <div className="mt-8 rounded-2xl border border-[#d7e8f8] bg-[#f2f8ff] p-5 text-sm leading-6 text-[#405a76]">
          If you submit a request, the contact and eligibility details you
          provide, your resume, and any optional material are stored for review
          by the employee who shared your link. If a service is unavailable, the
          request is not saved.
        </div>

        <div className="mt-9 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-[#1c3d64]">
              Resume checks
            </h2>
            <p className="mt-2 leading-7 text-[#5d7087]">
              A resume must pass a clean file scan and contain readable contact
              details before it can be accepted. A successful check does not
              guarantee that EA’s recruiting systems can read the document.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#1c3d64]">
              Optional material
            </h2>
            <p className="mt-2 leading-7 text-[#5d7087]">
              Notes, links, and work samples are optional. Adding them does not
              improve an evidence score or guarantee a referral.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#1c3d64]">
              Status and email
            </h2>
            <p className="mt-2 leading-7 text-[#5d7087]">
              Request status is available after you sign in with the verified
              email used for your request. The service does not automatically
              send a status email.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[#1c3d64]">Deletion</h2>
            <p className="mt-2 leading-7 text-[#5d7087]">
              Sign in with your verified email and use your status page to ask
              for your information to be deleted. A retention period has not
              been set.
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center rounded-full border border-[#c9d9ea] px-5 text-sm font-semibold text-[#2456c7]"
        >
          Back to Aashik
        </Link>
      </article>
    </CandidateShell>
  );
}
