import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { CandidateGuide } from "@/components/candidate/candidate-guide";
import { WorkspaceProvider } from "@/lib/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "with Aashik | Personal Referral Guide",
  description: "Personal help with a referral request and follow-up.",
};

function ConnectedWorkspace({ children }: { children: ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
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
          <ConnectedWorkspace>{children}</ConnectedWorkspace>
        </Suspense>
      </body>
    </html>
  );
}
