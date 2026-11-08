"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import { CandidateGuide } from "@/components/candidate/candidate-guide";
import {
  CandidateShell,
  DemoNotice,
  Eyebrow,
} from "@/components/candidate/candidate-shell";
import { useWorkspace } from "@/lib/demo/workspace";
import type {
  Application,
  ApplicationStatus,
  Candidate,
  Job,
} from "@/lib/demo/types";

type Session = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; email: string | null } | null;
  isAdmin: boolean;
};
type Status = {
  id: string;
  jobId: string;
  jobTitle: string;
  status: string;
  submittedAt: string;
  eligibility?: {
    previouslyApplied: boolean | null;
    previouslyReferred: boolean | null;
    knowsOwner: boolean;
    inListedLocation: boolean | null;
  };
};

const demoSubmissionIdPattern =
  /^app-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const labels: Record<string, string> = {
  submitted: "Received",
  processing: "Received",
  correction_required: "Action needed",
  eligibility_review: "Eligibility check",
  needs_clarification: "Eligibility check",
  ready_for_review: "Under review",
  shortlisted: "Under review",
  selected_pending_submission: "Under review",
  referral_confirmed: "Referral submitted",
  not_selected: "Referral not available",
  slot_filled_other: "Referral not available",
};

const demoStatusDetails: Record<
  ApplicationStatus,
  { label: string; nextStep: string }
> = {
  submitted: {
    label: "Request received",
    nextStep:
      "The request is ready for the employee who shared the link to review. No email was sent and no referral was submitted.",
  },
  processing: {
    label: "Resume check in progress",
    nextStep:
      "The resume check needs to finish before review can continue. This sample status is only stored in this tab.",
  },
  correction_required: {
    label: "Resume needs a correction",
    nextStep:
      "Ask the employee who shared the link what needs updating. This demo cannot send a corrected file.",
  },
  eligibility_review: {
    label: "Eligibility needs review",
    nextStep:
      "The employee who shared the link can review your answers before deciding whether to continue.",
  },
  needs_clarification: {
    label: "More information may be needed",
    nextStep:
      "The employee may ask you a follow-up question before continuing the review.",
  },
  ready_for_review: {
    label: "Ready for review",
    nextStep:
      "The employee who shared the link can review your request and decide whether to take a referral step.",
  },
  shortlisted: {
    label: "Under review",
    nextStep:
      "The employee marked your request for further consideration. A referral has not been confirmed.",
  },
  selected_pending_submission: {
    label: "Selected for a manual referral step",
    nextStep:
      "The employee still needs to complete and confirm any referral action. This demo does not submit to EA.",
  },
  referral_confirmed: {
    label: "Referral marked confirmed",
    nextStep:
      "The employee recorded a manual confirmation in this demo. No EA portal action or email was performed.",
  },
  not_selected: {
    label: "Not selected for referral",
    nextStep:
      "The employee is unable to refer you for this opening. You can contact another EA employee about other roles.",
  },
  slot_filled_other: {
    label: "Referral slot filled",
    nextStep:
      "The employee recorded that the referral slot went to another candidate. You can ask another EA employee about other roles.",
  },
};

function receivedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function DemoRequestStatus({
  applicationId,
  application,
  candidate,
  job,
}: {
  applicationId: string;
  application?: Application;
  candidate?: Candidate;
  job?: Job;
}) {
  if (!application) {
    return (
      <div className="mt-8 space-y-5">
        <CandidateGuide
          mood="unavailable"
          layout="compact"
          title="Let’s find the right request."
          message="Pip can show one receipt at a time, while its request is still in this tab’s memory."
        />
        <div className="rounded-2xl border border-[#dce5ef] bg-white p-6 sm:p-7">
          <Eyebrow>Demo receipt</Eyebrow>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#142b4b]">
            {applicationId
              ? "This request is not in the current tab."
              : "No request is selected."}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#526174]" role="status">
            {applicationId
              ? "The request ID does not match a request held in this tab’s memory. Requests you create in this preview clear when you refresh or close the tab."
              : "Complete a sample request to open its receipt here. Requests you create in this preview clear when you refresh or close the tab."}
          </p>
          <Link
            href="/referral/job-508741"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#2456c7] px-5 text-sm font-semibold text-white transition hover:bg-[#1b46aa]"
          >
            Start a sample request
          </Link>
        </div>
      </div>
    );
  }

  const details = demoStatusDetails[application.status];
  const candidateName = [candidate?.firstName, candidate?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mt-8 space-y-5">
      <CandidateGuide
        mood={
          application.status === "not_selected" ||
          application.status === "slot_filled_other"
            ? "unavailable"
            : "success"
        }
        layout="compact"
        title={details.label}
        message="Preview receipts use in-memory data. Requests you create here clear when you refresh or close the tab."
      />
      <article className="rounded-2xl border border-[#dce5ef] bg-white p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow>Demo receipt</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#142b4b]">
              {job?.title ?? "Role details unavailable"}
            </h2>
          </div>
          <span className="rounded-full bg-[#edf6ff] px-3 py-1.5 text-xs font-semibold text-[#315c95]">
            {details.label}
          </span>
        </div>

        <dl className="mt-6 grid gap-5 border-t border-[#edf2f7] pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#637287] uppercase">
              Request ID
            </dt>
            <dd className="mt-1 font-mono text-sm break-all text-[#304967]">
              {application.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#637287] uppercase">
              Received
            </dt>
            <dd className="mt-1 text-sm text-[#304967]">
              {receivedDate(application.submittedAt)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl bg-[#f5f9fd] p-4">
          <h3 className="text-sm font-semibold text-[#142b4b]">Contact</h3>
          {candidate ? (
            <div className="mt-2 space-y-1 text-sm leading-6 text-[#526174]">
              <p>{candidateName || "Name not provided"}</p>
              <p className="break-all">
                {candidate.email || "Email not provided"}
              </p>
              {candidate.phone && <p>{candidate.phone}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[#526174]">
              Contact details are not available in this tab’s request record.
            </p>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-[#d7e8f8] bg-[#eef7ff] p-4">
          <h3 className="text-sm font-semibold text-[#294c78]">
            What happens next
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#3e5d7c]">
            {details.nextStep}
          </p>
        </div>

        <div className="mt-5">
          <DemoNotice>
            This is a local demo receipt that uses in-memory data. No email,
            file upload, or EA referral was sent.
          </DemoNotice>
        </div>
      </article>
    </div>
  );
}

function StatusPageFallback() {
  return (
    <CandidateShell>
      <section
        className="mx-auto max-w-3xl px-5 pt-10 pb-10 sm:px-8 sm:pt-16"
        aria-busy="true"
      >
        <CandidateGuide
          mood="checking"
          layout="compact"
          title="Checking your request."
          message="I’m getting your private status page ready."
        />
        <p className="sr-only" role="status">
          Loading request status.
        </p>
      </section>
    </CandidateShell>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<StatusPageFallback />}>
      <StatusPageContent />
    </Suspense>
  );
}

function StatusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, applications, candidates, jobs } = useWorkspace();
  const requestedApplicationId =
    searchParams.get("applicationId")?.trim() ?? "";
  const isDemoSubmissionId = demoSubmissionIdPattern.test(
    requestedApplicationId,
  );
  const demoApplication =
    mode === "demo" && isDemoSubmissionId
      ? applications.find((item) => item.id === requestedApplicationId)
      : undefined;
  const demoCandidate = demoApplication
    ? candidates.find((item) => item.id === demoApplication.candidateId)
    : undefined;
  const demoJob = demoApplication
    ? jobs.find((item) => item.id === demoApplication.jobId)
    : undefined;
  const [session, setSession] = useState<Session | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingStatusId, setUploadingStatusId] = useState("");
  const [uploadResults, setUploadResults] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode === "demo") return;
    void (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const value = await res.json();
        setSession(value);
        if (value.configured && value.authenticated) {
          const statusResponse = await fetch("/api/status", {
            cache: "no-store",
          });
          const data = await statusResponse.json();
          if (statusResponse.ok) setStatuses(data.statuses ?? []);
          else setMessage(data.message ?? "Your status could not be loaded.");
        }
      } catch {
        setMessage("Your status could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/status");
    router.refresh();
  }
  async function requestDeletion() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(
          value.message || "The deletion request could not be submitted.",
        );
      setMessage("Your deletion request was recorded.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The deletion request could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadCorrectedResume(
    item: Status,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(extension ?? "")) {
      setUploadResults((current) => ({
        ...current,
        [item.id]: "Choose a PDF or DOCX resume.",
      }));
      return;
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      setUploadResults((current) => ({
        ...current,
        [item.id]: "The corrected resume must be 4 MiB or smaller.",
      }));
      return;
    }
    if (!item.eligibility) {
      setUploadResults((current) => ({
        ...current,
        [item.id]:
          "Eligibility details are unavailable for this request. Please contact the employee who shared the link.",
      }));
      return;
    }
    setUploadingStatusId(item.id);
    setUploadResults((current) => ({
      ...current,
      [item.id]: "Uploading and checking the corrected resume…",
    }));
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("jobId", item.jobId);
      form.set("eligibility", JSON.stringify(item.eligibility));
      const response = await fetch("/api/uploads/resume", {
        method: "POST",
        body: form,
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(
          value.message || "Resume upload could not be completed.",
        );
      const resume = value.resume;
      if (!resume)
        throw new Error("The upload response did not include a resume check.");
      const scanLabel =
        resume.scanStatus === "clean"
          ? "Clean scan"
          : resume.scanStatus === "quarantined"
            ? "Quarantined pending a clean scan"
            : "Scan status unavailable";
      const parserLabel =
        resume.parserStatus === "ready"
          ? "Contact details readable"
          : resume.parserStatus === "correction_required"
            ? `Needs readable ${resume.readiness?.missingFields?.join(", ") || "contact details"}`
            : `Parser status: ${resume.parserStatus || "unavailable"}`;
      setUploadResults((current) => ({
        ...current,
        [item.id]: `${scanLabel}. ${parserLabel}.`,
      }));
      const statusResponse = await fetch("/api/status", { cache: "no-store" });
      const statusData = await statusResponse.json();
      if (!statusResponse.ok)
        throw new Error(
          statusData.message || "The updated status could not be loaded.",
        );
      setStatuses(statusData.statuses ?? []);
    } catch (error) {
      setUploadResults((current) => ({
        ...current,
        [item.id]:
          error instanceof Error
            ? error.message
            : "Resume upload could not be completed.",
      }));
    } finally {
      setUploadingStatusId("");
    }
  }

  return (
    <CandidateShell>
      <section className="mx-auto max-w-3xl px-5 pt-10 pb-10 sm:px-8 sm:pt-16">
        <Eyebrow>Request status</Eyebrow>
        <h1 className="mt-4 font-serif text-5xl leading-tight tracking-[-0.04em] text-[#142b4b]">
          A clear update, when you need it.
        </h1>
        {mode === "demo" ? (
          <DemoRequestStatus
            applicationId={requestedApplicationId}
            application={demoApplication}
            candidate={demoCandidate}
            job={demoJob}
          />
        ) : loading ? (
          <p className="mt-6 text-[#526174]">Checking your private session…</p>
        ) : !session?.configured ? (
          <div className="mt-8 rounded-2xl border border-[#dce5ef] bg-white p-6">
            <p className="leading-7 text-[#526174]">
              Candidate status sign-in is available when connected services are
              configured. No email was sent and no request status was accessed.
            </p>
          </div>
        ) : !session.authenticated ? (
          <div className="mt-8 rounded-2xl border border-[#dce5ef] bg-white p-6">
            <p className="leading-7 text-[#526174]">
              Sign in with the verified email address used for your request to
              see your own status.
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#2456c7] px-5 text-sm font-semibold text-white"
              href="/sign-in?next=%2Fstatus"
            >
              Sign in securely
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#edf6ff] px-4 py-3 text-sm text-[#315274]">
              <span>Signed in as {session.user?.email}</span>
              <button className="font-semibold underline" onClick={logout}>
                Sign out
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {statuses.length ? (
                statuses.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[#dce5ef] bg-white p-5"
                  >
                    <h2 className="font-semibold text-[#142b4b]">
                      {item.jobTitle}
                    </h2>
                    <p className="mt-2 text-sm text-[#526174]">
                      {labels[item.status] ?? "Under review"}
                    </p>
                    <p className="mt-1 text-xs text-[#637287]">
                      Received {new Date(item.submittedAt).toLocaleDateString()}
                    </p>
                    {item.status === "correction_required" && (
                      <div className="mt-4 rounded-xl bg-[#fbf5e8] p-4">
                        <p className="text-sm leading-6 text-[#735b2c]">
                          Please upload a corrected resume so the request can
                          continue. PDF or DOCX, up to 4 MiB.
                        </p>
                        <label
                          className={`mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[#2456c7] px-4 text-sm font-semibold text-white ${uploadingStatusId === item.id ? "opacity-60" : ""}`}
                        >
                          {uploadingStatusId === item.id
                            ? "Checking resume…"
                            : "Choose corrected resume"}
                          <input
                            className="sr-only"
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            disabled={uploadingStatusId !== ""}
                            onChange={(event) =>
                              void uploadCorrectedResume(item, event)
                            }
                          />
                        </label>
                        {uploadResults[item.id] && (
                          <p
                            className="mt-3 text-sm leading-6 text-[#735b2c]"
                            role="status"
                          >
                            {uploadResults[item.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-[#dce5ef] bg-white p-6 text-sm leading-6 text-[#526174]">
                  No referral requests are associated with this verified account
                  yet.
                </div>
              )}
            </div>
            <div className="mt-6 rounded-2xl border border-[#dce5ef] bg-white p-5">
              <h2 className="font-semibold text-[#142b4b]">
                Request data deletion
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#526174]">
                This sends a deletion request for review by the employee who
                shared your referral link.
              </p>
              <button
                disabled={busy}
                onClick={requestDeletion}
                className="mt-4 min-h-10 rounded-full border border-[#bfd3e9] px-4 text-sm font-semibold text-[#2352a3] disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit deletion request"}
              </button>
            </div>
            {message && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[#f2f8ff] px-4 py-3 text-sm text-[#526174]"
              >
                {message}
              </p>
            )}
          </>
        )}
      </section>
    </CandidateShell>
  );
}
