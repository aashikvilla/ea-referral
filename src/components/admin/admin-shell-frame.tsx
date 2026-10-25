"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/shared/shells";
import { useWorkspace } from "@/lib/demo/workspace";

export function AdminShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode, loading, error, session } = useWorkspace();
  const active =
    pathname === "/admin"
      ? "/admin"
      : pathname.startsWith("/admin/jobs")
        ? "/admin/jobs"
        : pathname.startsWith("/admin/candidates")
          ? "/admin/candidates"
          : pathname.startsWith("/admin/compare")
            ? "/admin/compare"
            : pathname.startsWith("/admin/notifications")
              ? "/admin/notifications"
              : pathname.startsWith("/admin/settings")
                ? "/admin/settings"
                : undefined;
  if (mode === "connected" && loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] p-6">
        <div className="rounded-2xl border border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-stone-800">
            Verifying admin access
          </p>
          <p className="mt-2 text-sm text-stone-500">
            The workspace will appear after the owner session is confirmed.
          </p>
        </div>
      </div>
    );
  }

  if (mode === "connected" && error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] p-6">
        <section className="max-w-lg rounded-2xl border border-[#e3d9c5] bg-white p-7 shadow-sm">
          <p className="text-xs font-bold tracking-[0.16em] text-[#92733d] uppercase">
            Connected workspace unavailable
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#193b31]">
            Admin data could not be loaded.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#6b7b73]">
            The admin workspace is hidden until connected setup and data access
            are available. No sample records are shown in connected mode.
          </p>
        </section>
      </div>
    );
  }

  if (mode === "connected" && session?.isAdmin !== true) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f5] p-6">
        <section className="max-w-lg rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-bold tracking-[0.16em] text-[#648274] uppercase">
            Owner workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#193b31]">
            Verified admin sign-in required.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#6b7b73]">
            This private workspace is available only to the configured owner
            account. Candidate access does not include admin records.
          </p>
          <Link
            href="/sign-in?next=%2Fadmin"
            className="mt-5 inline-flex rounded-xl bg-[#1c5545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#174738]"
          >
            Sign in with the owner account
          </Link>
        </section>
      </div>
    );
  }

  return (
    <AdminShell mode={mode} active={active}>
      {children}
    </AdminShell>
  );
}
