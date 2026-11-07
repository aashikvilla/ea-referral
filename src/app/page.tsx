import Link from "next/link";
import { CandidateGuide } from "@/components/candidate/candidate-guide";
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
      <section className="mx-auto grid max-w-7xl gap-8 px-5 pt-5 pb-12 sm:px-8 sm:pt-8 lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:gap-14 lg:pt-10 lg:pb-16">
        <div className="max-w-2xl py-5 lg:py-10">
          <Eyebrow>The Open Door · Referral Assistant</Eyebrow>
          <h1 className="mt-5 max-w-2xl text-4xl leading-[1.08] font-bold tracking-[-0.045em] text-balance text-[#142b4b] sm:text-6xl lg:text-[4.35rem]">
            A clearer path to a personal referral.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#526174] sm:text-lg sm:leading-8">
            Check the role, share what matters, and follow each step with
            confidence. The employee who shared the link reviews your request;
            you decide what to include.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#role-check"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#2456c7] px-6 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_rgba(36,86,199,0.8)] transition hover:bg-[#1b46aa]"
            >
              Check a role <span aria-hidden="true">→</span>
            </a>
            {mode === "demo" && (
              <Link
                href="/referral/job-508741"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#bfd3e9] bg-white px-5 text-sm font-semibold text-[#2352a3] transition hover:bg-[#f1f7ff]"
              >
                Try the sample request
              </Link>
            )}
          </div>
          <p className="mt-5 max-w-xl text-xs leading-5 text-[#637287]">
            EA makes all hiring decisions. A referral can introduce your
            experience; it never guarantees an interview or offer.
          </p>
          {mode === "demo" && (
            <p className="mt-2 text-xs font-medium text-[#426182]">
              Independent preview · your progress clears when this tab refreshes
              or closes.
            </p>
          )}
        </div>

        <div className="grid gap-4">
          <CandidateGuide
            mood="welcome"
            layout="hero"
            title="Take the next step with confidence."
            message="Pip guides the steps. The employee who shared your link makes the referral decision."
          />
          <div
            id="role-check"
            className="scroll-mt-6 rounded-[1.6rem] border border-[#dce5ef] bg-white p-5 shadow-[0_22px_65px_-48px_rgba(18,48,84,0.32)] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] pb-5">
              <div>
                <Eyebrow>Start with the role</Eyebrow>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#142b4b]">
                  Check the listing first
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-[#edf6ff] px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#32619c] sm:text-[11px]">
                ABOUT 3 MIN
              </span>
            </div>
            <div className="mt-5 space-y-4">
              <JobLookup />
              {mode === "demo" && (
                <div className="rounded-2xl border border-[#d8e7f7] bg-[#f2f8ff] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold tracking-wide text-[#294c78] uppercase">
                        Prefer a walkthrough?
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#607792]">
                        Use a fictional role to preview the request steps.
                      </p>
                    </div>
                    <Link
                      href="/referral/job-508741"
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[#2456c7] px-4 text-xs font-semibold text-white transition hover:bg-[#1b46aa]"
                    >
                      Start sample request{" "}
                      <span className="ml-2" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#dce9f7] pt-3 text-xs font-medium">
                    <Link
                      className="text-[#315c95] underline underline-offset-4"
                      href="/referral/job-509182"
                    >
                      Preview unknown listing
                    </Link>
                    <Link
                      className="text-[#315c95] underline underline-offset-4"
                      href="/referral/job-507316"
                    >
                      Preview confirmed referral
                    </Link>
                  </div>
                </div>
              )}
              {mode === "demo" && (
                <DemoNotice>
                  This is a fictional browser preview. Role lookup and sample
                  requests do not contact EA or leave this tab.
                </DemoNotice>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dce5ef] bg-[#eef4fb]">
        <div className="mx-auto grid max-w-7xl gap-7 px-5 py-9 sm:px-8 md:grid-cols-3 md:gap-10 md:py-11">
          {[
            [
              "01",
              "Check before you share",
              "Role availability and a few basic questions come first, before contact details or a resume.",
            ],
            [
              "02",
              "Keep it focused",
              "A resume supports the employee’s review. Extra notes or work samples are optional.",
            ],
            [
              "03",
              "Know who decides",
              "The employee who shared your link reviews your request. Only EA can make hiring decisions.",
            ],
          ].map(([number, title, copy]) => (
            <article key={number} className="flex gap-4">
              <span className="pt-0.5 text-sm font-bold tracking-wider text-[#398bb8]">
                {number}
              </span>
              <div>
                <h2 className="font-semibold text-[#1c3d64]">{title}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#5d7087]">
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
