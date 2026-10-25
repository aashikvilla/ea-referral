import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { DemoWorkspaceProvider } from "@/lib/demo/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referral desk | Personal workspace",
  description:
    "A personal referral request workspace with a session-only fictional demo.",
};

async function RequestScopedWorkspace({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "demo" | "connected";
}) {
  await connection();
  const demoReferenceTime = new Date().toISOString();
  return (
    <DemoWorkspaceProvider mode={mode} demoReferenceTime={demoReferenceTime}>
      {children}
    </DemoWorkspaceProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const mode =
    process.env.EA_REFERRAL_MODE === "demo" ||
    process.env.EA_REFERRAL_MODE === undefined
      ? "demo"
      : "connected";
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#f7f8f5]" aria-busy="true">
              <p className="sr-only" role="status">
                Loading referral workspace
              </p>
            </div>
          }
        >
          <RequestScopedWorkspace mode={mode}>
            {children}
          </RequestScopedWorkspace>
        </Suspense>
      </body>
    </html>
  );
}
