"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function CandidateShell({
  children,
  showFooter = true,
}: {
  children: ReactNode;
  showFooter?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#172338]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3"
          aria-label="With Aashik home"
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-[15px] bg-[#2456c7] text-white shadow-[0_6px_16px_-8px_rgba(36,86,199,0.75)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 40 40"
              fill="none"
              className="size-7"
            >
              <path
                d="M8 30 19.8 8l12.2 22M13.2 21.7h13.6"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M24 28.5c1.7 1.1 3.4 1.1 5.1 0"
                stroke="#8ee8ff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="30.5" cy="11" r="2" fill="#8ee8ff" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold tracking-tight text-[#142b4b]">
              with Aashik
            </span>
          </span>
        </Link>
      </header>
      <main>{children}</main>
      {showFooter && (
        <footer className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-[#e5eaf0] px-5 py-5 text-xs leading-5 text-[#6a7889] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>EA makes all hiring decisions. A referral is not a guarantee.</p>
          <Link
            href="/privacy"
            className="w-fit underline decoration-[#a9bad0] underline-offset-4"
          >
            Privacy
          </Link>
        </footer>
      )}
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
