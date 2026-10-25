import Link from "next/link";
import type { ReactNode } from "react";
import { DemoBanner } from "./primitives";

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 text-stone-950">
      <span className="grid size-10 place-items-center rounded-xl bg-teal-800 text-sm font-bold tracking-wide text-white">
        EA
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold">Referral desk</span>
        <span className="mt-0.5 block text-[11px] text-stone-500">
          Personal workspace
        </span>
      </span>
    </Link>
  );
}

export function PublicShell({
  children,
  active = "request",
  mode = "demo",
}: {
  children: ReactNode;
  active?: "request" | "status";
  mode?: "demo" | "connected";
}) {
  return (
    <div className="min-h-screen bg-[#f8f8f4]">
      {mode === "demo" && <DemoBanner />}
      <header className="border-b border-stone-200 bg-[#fcfcf9]">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand href="/" />
          <nav className="flex items-center gap-1">
            <Link
              className={`rounded-lg px-3 py-2 text-sm ${active === "request" ? "font-semibold text-teal-900" : "text-stone-600 hover:bg-stone-100"}`}
              href="/"
            >
              Referral request
            </Link>
            <Link
              className={`rounded-lg px-3 py-2 text-sm ${active === "status" ? "font-semibold text-teal-900" : "text-stone-600 hover:bg-stone-100"}`}
              href="/status"
            >
              Check status
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-stone-200 bg-[#fcfcf9] px-5 py-5 text-center text-xs text-stone-500">
        A personal referral request tool · A referral is not a guarantee of
        interview or employment.
      </footer>
    </div>
  );
}

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/compare", label: "Compare" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/settings", label: "Settings" },
];
export function AdminShell({
  children,
  active,
  mode,
}: {
  children: ReactNode;
  active?: string;
  mode: "demo" | "connected";
}) {
  return (
    <div className="min-h-screen bg-[#f7f8f5]">
      {mode === "demo" && <DemoBanner />}
      <div className="min-h-[calc(100vh-36px)] lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-stone-200 bg-[#fcfcf9] p-5 lg:flex lg:flex-col">
          <Brand href="/admin" />
          <p className="mt-10 mb-3 px-3 text-[11px] font-bold tracking-[0.14em] text-stone-400 uppercase">
            Workspace
          </p>
          <nav className="space-y-1">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3.5 py-3 text-sm ${active === item.href ? "bg-teal-50 font-semibold text-teal-900" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-stone-100 p-4">
            <p className="text-xs font-semibold text-stone-700">
              {mode === "demo" ? "Demo mode" : "Connected workspace"}
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {mode === "demo"
                ? "Workspace changes stay in this tab’s memory and clear on reload."
                : "Workspace data is loaded from the connected service."}
            </p>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex h-[76px] items-center justify-between border-b border-stone-200 bg-[#fcfcf9] px-5 sm:px-8">
            <div className="lg:hidden">
              <Brand href="/admin" />
            </div>
            <nav className="flex gap-1 lg:hidden">
              {adminNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2 py-2 text-xs ${active === item.href ? "font-semibold text-teal-900" : "text-stone-600"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="hidden text-sm text-stone-500 lg:block">
              Private admin workspace
            </p>
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5">
              <span
                className={`size-2 rounded-full ${mode === "demo" ? "bg-amber-500" : "bg-teal-600"}`}
              />
              <span className="text-xs font-medium text-stone-700">
                {mode === "demo" ? "Demo data" : "Connected data"}
              </span>
            </div>
          </header>
          <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
