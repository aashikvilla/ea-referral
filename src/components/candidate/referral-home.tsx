"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CandidateGuide,
  type GuideMood,
} from "@/components/candidate/candidate-guide";
import { JobLookup } from "@/components/candidate/job-lookup";

const welcomeMessage =
  "Thanks for stopping by. Need a referral or checking your request?";

export function ReferralHome() {
  const [guideState, setGuideState] = useState<{
    mood: GuideMood;
    message: string;
  }>({ mood: "welcome", message: welcomeMessage });
  const [showRoleLookup, setShowRoleLookup] = useState(false);

  return (
    <section className="mx-auto grid max-w-6xl gap-5 px-5 pt-2 pb-8 sm:px-8 lg:min-h-[min(760px,calc(100svh-84px))] lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-8">
      <CandidateGuide
        mood={guideState.mood}
        layout="hero"
        headingLevel="h1"
        title="Hey, I’m Ashik."
        message={guideState.message}
      />

      <div className="grid gap-3 sm:gap-4">
        <button
          type="button"
          aria-expanded={showRoleLookup}
          aria-controls="role-lookup-panel"
          onClick={() => {
            const next = !showRoleLookup;
            setShowRoleLookup(next);
            setGuideState(
              next
                ? {
                    mood: "pointing",
                    message: "Paste an EA Careers listing or enter the job ID.",
                  }
                : { mood: "welcome", message: welcomeMessage },
            );
          }}
          className="group flex min-h-20 items-center justify-between gap-4 rounded-[1.6rem] bg-[#2456c7] px-5 py-4 text-left text-white shadow-[0_12px_25px_-18px_rgba(36,86,199,0.85)] transition hover:bg-[#1b46aa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2456c7] sm:px-6"
        >
          <span className="text-base font-semibold">I need a referral</span>
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-lg transition group-hover:translate-x-0.5"
          >
            {showRoleLookup ? "−" : "→"}
          </span>
        </button>

        <Link
          href="/status"
          className="group flex min-h-20 items-center justify-between gap-4 rounded-[1.6rem] border border-[#d9e4f0] bg-[#f2f8ff] px-5 py-4 transition hover:border-[#a9c4e2] hover:bg-[#eaf4ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2456c7] sm:px-6"
        >
          <span>
            <span className="block text-xs font-bold tracking-[0.14em] text-[#5680b4] uppercase">
              I’m checking my request
            </span>
          </span>
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-lg text-[#2456c7] shadow-sm transition group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>

        {showRoleLookup && (
          <div
            id="role-lookup-panel"
            className="rounded-[1.6rem] border border-[#d9e4f0] bg-white p-4 shadow-[0_18px_54px_-44px_rgba(18,48,84,0.35)] sm:p-5"
          >
            <JobLookup
              onGuideUpdate={(mood, message) =>
                setGuideState({ mood, message })
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
