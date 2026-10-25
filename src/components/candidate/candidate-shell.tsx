import Link from "next/link";
import type { ReactNode } from "react";
import { useWorkspace } from "@/lib/demo/workspace";

export function CandidateShell({ children }: { children: ReactNode }) {
  const { mode } = useWorkspace();
  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#192521]">
      <div className="border-b border-[#d7e1dc] bg-[#e9f3ed] px-4 py-2 text-center text-xs font-medium tracking-wide text-[#315b4c]">
        {mode === "demo" ? (
          <>
            DEMO MODE <span className="mx-2 text-[#9ab4a8]">·</span> This is a
            local preview. Details stay in this tab&apos;s memory; files and
            emails are not sent.
          </>
        ) : (
          <>
            CONNECTED SERVICE <span className="mx-2 text-[#9ab4a8]">·</span>{" "}
            Referral requests are reviewed by the employee who shared this link.
          </>
        )}
      </div>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="EA referral home"
        >
          <span className="grid size-10 place-items-center rounded-full bg-[#173d32] text-sm font-bold tracking-tight text-white">
            EA
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Referral, thoughtfully.
          </span>
        </Link>
        <nav
          className="flex items-center gap-5 text-sm text-[#52645d]"
          aria-label="Main navigation"
        >
          <Link className="transition hover:text-[#173d32]" href="/status">
            Check status
          </Link>
          <Link className="transition hover:text-[#173d32]" href="/privacy">
            Privacy
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-16 flex max-w-7xl flex-col gap-3 border-t border-[#dce3df] px-5 py-7 text-xs leading-5 text-[#66756e] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          A personal referral assistant. A referral is never a guarantee of an
          interview or offer.
        </p>
        <div className="flex gap-4">
          <Link
            href="/privacy"
            className="underline decoration-[#a8b6af] underline-offset-4"
          >
            Privacy notice
          </Link>
          <a
            href="https://jobs.ea.com/en_US/careers"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[#a8b6af] underline-offset-4"
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
    <p className="text-xs font-semibold tracking-[0.18em] text-[#55776a] uppercase">
      {children}
    </p>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#d6e5dc] bg-[#eef5f0] px-4 py-3 text-sm leading-6 text-[#466558]">
      {children}
    </div>
  );
}
