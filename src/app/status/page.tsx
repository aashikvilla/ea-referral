"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  CandidateShell,
  Eyebrow,
} from "@/components/candidate/candidate-shell";

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

export default function StatusPage() {
  const router = useRouter();
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
  }, []);

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
        <Eyebrow>Private candidate status</Eyebrow>
        <h1 className="mt-4 font-serif text-5xl leading-tight tracking-[-0.04em] text-[#173d32]">
          A clear update, when you need it.
        </h1>
        {loading ? (
          <p className="mt-6 text-[#52645d]">Checking your private session…</p>
        ) : !session?.configured ? (
          <div className="mt-8 rounded-2xl border border-[#dce3dd] bg-white p-6">
            <p className="leading-7 text-[#52645d]">
              Candidate status sign-in is available when connected services are
              configured. No email was sent and no status was accessed in this
              demo.
            </p>
            <p className="mt-4 text-sm leading-6 text-[#77857e]">
              Demo requests and entered details stay in this browser tab&apos;s
              memory and clear when it is refreshed or closed.
            </p>
          </div>
        ) : !session.authenticated ? (
          <div className="mt-8 rounded-2xl border border-[#dce3dd] bg-white p-6">
            <p className="leading-7 text-[#52645d]">
              Sign in with the verified email address used for your request to
              see your own status.
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#173d32] px-5 text-sm font-semibold text-white"
              href="/sign-in?next=%2Fstatus"
            >
              Sign in securely
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#eef5f0] px-4 py-3 text-sm text-[#466558]">
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
                    className="rounded-2xl border border-[#dce3dd] bg-white p-5"
                  >
                    <h2 className="font-semibold text-[#254a3d]">
                      {item.jobTitle}
                    </h2>
                    <p className="mt-2 text-sm text-[#52645d]">
                      {labels[item.status] ?? "Under review"}
                    </p>
                    <p className="mt-1 text-xs text-[#77857e]">
                      Received {new Date(item.submittedAt).toLocaleDateString()}
                    </p>
                    {item.status === "correction_required" && (
                      <div className="mt-4 rounded-xl bg-[#fbf5e8] p-4">
                        <p className="text-sm leading-6 text-[#735b2c]">
                          Please upload a corrected resume so the request can
                          continue. PDF or DOCX, up to 4 MiB.
                        </p>
                        <label
                          className={`mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[#173d32] px-4 text-sm font-semibold text-white ${uploadingStatusId === item.id ? "opacity-60" : ""}`}
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
                <div className="rounded-2xl border border-[#dce3dd] bg-white p-6 text-sm leading-6 text-[#52645d]">
                  No referral requests are associated with this verified account
                  yet.
                </div>
              )}
            </div>
            <div className="mt-6 rounded-2xl border border-[#dce3dd] bg-white p-5">
              <h2 className="font-semibold text-[#254a3d]">
                Request data deletion
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#607168]">
                This sends a deletion request for review by the employee who
                shared your referral link.
              </p>
              <button
                disabled={busy}
                onClick={requestDeletion}
                className="mt-4 min-h-10 rounded-full border border-[#cbd8d1] px-4 text-sm font-semibold text-[#315b4c] disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit deletion request"}
              </button>
            </div>
            {message && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[#f5f7f4] px-4 py-3 text-sm text-[#52645d]"
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
