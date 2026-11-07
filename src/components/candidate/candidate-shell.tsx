"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useWorkspace } from "@/lib/demo/workspace";

export function CandidateShell({ children }: { children: ReactNode }) {
  const { mode } = useWorkspace();
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#172338]">
      <div className="border-b border-[#d7e5f3] bg-[#edf6ff] px-4 py-2 text-center text-[11px] font-medium tracking-wide text-[#315274] sm:text-xs">
        {mode === "demo" ? (
          <>
            DEMO PREVIEW <span className="mx-2 text-[#8aa9c5]">·</span> This
            independent sample stays in this tab; no request, file, or email is
            sent.
          </>
        ) : (
          <>
            PERSONAL REFERRAL <span className="mx-2 text-[#8aa9c5]">·</span>{" "}
            Requests are reviewed by the employee who shared this link; a
            referral is never guaranteed.
          </>
        )}
      </div>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3"
          aria-label="The Open Door Referral Assistant home"
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-[#2456c7] text-white shadow-[0_6px_16px_-8px_rgba(36,86,199,0.75)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-6"
            >
              <path
                d="M5.25 20V4.8c0-.72.58-1.3 1.3-1.3h10.9c.72 0 1.3.58 1.3 1.3V20M3.5 20h17M9 20V7.25h6V20"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="13.2" cy="13.4" r=".65" fill="currentColor" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-[#142b4b]">
              The Open Door
            </span>
            <span className="block text-[11px] font-medium tracking-wide text-[#58718d]">
              Referral Assistant
            </span>
          </span>
        </Link>
        <nav
          className="flex items-center gap-4 text-xs font-medium text-[#526174] sm:gap-6 sm:text-sm"
          aria-label="Main navigation"
        >
          <Link className="transition hover:text-[#2456c7]" href="/status">
            Request status
          </Link>
          <Link className="transition hover:text-[#2456c7]" href="/privacy">
            Privacy
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-16 flex max-w-7xl flex-col gap-3 border-t border-[#dce5ef] px-5 py-7 text-xs leading-5 text-[#637287] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          An independent referral assistant. EA makes hiring decisions; a
          referral never guarantees an interview or offer.
        </p>
        <div className="flex gap-4">
          <Link
            href="/privacy"
            className="underline decoration-[#a9bad0] underline-offset-4"
          >
            Privacy notice
          </Link>
          <a
            href="https://jobs.ea.com/en_US/careers"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[#a9bad0] underline-offset-4"
          >
            EA Careers ↗
          </a>
        </div>
      </footer>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.17em] text-[#32619c] uppercase">
      {children}
    </p>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#d7e8f8] bg-[#eef7ff] px-4 py-3 text-sm leading-6 text-[#3e5d7c]">
      {children}
    </div>
  );
}
