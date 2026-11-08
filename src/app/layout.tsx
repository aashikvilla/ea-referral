import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { CandidateGuide } from "@/components/candidate/candidate-guide";
import { DemoWorkspaceProvider } from "@/lib/demo/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "with Aashik | Personal Referral Guide",
  description: "Personal help with a referral request and follow-up.",
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
  // Public pages never seed or submit in-memory fictional requests. They use
  // the connected path and show an unavailable state until services are ready.
  const mode = "connected" as const;
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Suspense
          fallback={
            <main className="grid min-h-screen place-items-center bg-[#f8fafc] px-5 py-12">
              <div className="w-full max-w-3xl" aria-busy="true">
                <CandidateGuide
                  mood="thinking"
                  layout="compact"
                  title="One moment."
                  message="I’m getting the referral service ready."
                />
                <p className="sr-only" role="status">
                  Checking referral service.
                </p>
              </div>
            </main>
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
