import Link from "next/link";
import { JobLookup } from "@/components/candidate/job-lookup";
import {
  CandidateShell,
  DemoNotice,
  Eyebrow,
} from "@/components/candidate/candidate-shell";

export default function Home() {
  const mode =
    process.env.EA_REFERRAL_MODE === "demo" ||
    process.env.EA_REFERRAL_MODE === undefined
      ? "demo"
      : "connected";
  return (
    <CandidateShell>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pt-8 pb-10 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:pt-16 lg:pb-20">
        <div>
          <Eyebrow>A personal referral, made clearer</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[1.04] tracking-[-0.045em] text-[#173d32] sm:text-6xl lg:text-[4.5rem]">
            A thoughtful way to ask for a referral.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#52645d]">
            Share the role you have in mind, tell me a little about your
            experience, and I’ll take a look when I can. The process is
            straightforward and there’s no expectation to add more than your
            resume.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/privacy"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#cbd8d1] px-6 text-sm font-semibold text-[#315b4c] transition hover:bg-white"
            >
              How your information is handled
            </Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#78877f]">
            A referral is a personal recommendation, not a promise of an
            interview or job.
          </p>
        </div>
        <div className="relative">
          <div className="absolute -top-8 -left-8 size-32 rounded-full bg-[#e4eee5] blur-2xl" />
          <div className="relative rounded-[2rem] border border-[#dce3dd] bg-white p-5 shadow-[0_24px_70px_-48px_rgba(23,61,50,0.35)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0ed] pb-5">
              <div>
                <Eyebrow>Referral request</Eyebrow>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  Start with a role
                </h2>
              </div>
              <span className="rounded-full bg-[#eff5f0] px-3 py-1.5 text-[11px] font-semibold text-[#55776a]">
                ABOUT 3 MIN
              </span>
            </div>
            <div className="mt-6 space-y-4">
              <JobLookup />
              {mode === "demo" && (
                <div className="rounded-xl bg-[#f5f7f4] px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-[#71857a] uppercase">
                    Try a fictional sample role
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
                    <Link
                      href="/referral/job-508741"
                      className="text-[#315b4c] underline decoration-[#b5c5bb] underline-offset-4"
                    >
                      Open intake
                    </Link>
                    <Link
                      href="/referral/job-509182"
                      className="text-[#315b4c] underline decoration-[#b5c5bb] underline-offset-4"
                    >
                      Status unknown
                    </Link>
                    <Link
                      href="/referral/job-507316"
                      className="text-[#315b4c] underline decoration-[#b5c5bb] underline-offset-4"
                    >
                      Slot confirmed
                    </Link>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#f1f5f1] p-4">
                  <span className="text-[11px] font-semibold tracking-wider text-[#698277] uppercase">
                    First
                  </span>
                  <p className="mt-2 text-sm font-medium">Check the role</p>
                  <p className="mt-1 text-xs leading-5 text-[#718078]">
                    See whether this role can accept requests.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f1f5f1] p-4">
                  <span className="text-[11px] font-semibold tracking-wider text-[#698277] uppercase">
                    Then
                  </span>
                  <p className="mt-2 text-sm font-medium">Share your details</p>
                  <p className="mt-1 text-xs leading-5 text-[#718078]">
                    Upload a resume only after eligibility checks.
                  </p>
                </div>
              </div>
              {mode === "demo" && (
                <DemoNotice>
                  Demo preview only. The lookup and application do not connect
                  to EA or save information.
                </DemoNotice>
              )}
            </div>
          </div>
          <div className="relative mt-4 flex items-center gap-3 px-3 text-xs text-[#697971]">
            <span className="grid size-8 place-items-center rounded-full bg-[#dfeae2] text-[#315b4c]">
              ✳
            </span>
            <span>Keep it simple. Your resume is all that’s needed.</span>
          </div>
        </div>
      </section>
      <section className="border-y border-[#e0e6e1] bg-[#f0f3ed]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-9 sm:px-8 md:grid-cols-3 md:gap-10">
          {[
            [
              "01",
              "Check fit and availability",
              "We check role details and basic eligibility before asking for personal information.",
            ],
            [
              "02",
              "Share what matters",
              "Add a resume for review. Optional work samples can help tell the story, but are never required.",
            ],
            [
              "03",
              "Hear back with clarity",
              "In a configured service, sign in with your verified email to check your request status.",
            ],
          ].map(([n, title, copy]) => (
            <article key={n} className="flex gap-4">
              <span className="pt-1 font-serif text-2xl text-[#789285]">
                {n}
              </span>
              <div>
                <h2 className="font-semibold text-[#264b3e]">{title}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#66756e]">
                  {copy}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </CandidateShell>
  );
}
