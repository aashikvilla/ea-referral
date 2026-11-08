"use client";

import {
  useState,
  useEffect,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace";
import type { EligibilityAnswers, Job, Relationship } from "@/lib/domain/types";
import {
  CandidateGuide,
  type GuideMood,
} from "@/components/candidate/candidate-guide";
import { CandidateShell, Eyebrow } from "./candidate-shell";

type Step =
  | "eligibility"
  | "details"
  | "resume"
  | "showcase"
  | "review"
  | "complete"
  | "stopped";
type StopReason =
  | "already_applied"
  | "already_referred"
  | "known_person"
  | "location_review"
  | "eligibility_review";
type LocalFile = { name: string; size: number; type: string };
const MAX_EXTRAS = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const relationshipOptions = [
  { value: "current_ea_employee", label: "Current EA employee" },
  { value: "customer_client", label: "Customer or client" },
  { value: "family_member", label: "Family member" },
  { value: "former_colleague", label: "Former colleague" },
  { value: "friend", label: "Friend" },
  { value: "professional_network", label: "Professional network" },
  { value: "other", label: "Other" },
] as const;

export function IntakeFlow({ jobId }: { jobId: string }) {
  const {
    jobs,
    slots,
    session,
    loading,
    error: workspaceError,
  } = useWorkspace();
  const job = jobs.find(
    (item) => item.id === jobId || item.canonicalJobId === jobId,
  );
  const [step, setStep] = useState<Step>("eligibility");
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [stopReason, setStopReason] = useState<StopReason>("already_applied");
  const [localResume, setLocalResume] = useState<LocalFile | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeReadiness, setResumeReadiness] = useState<{
    ready: boolean;
    missingFields: string[];
    parserStatus: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showcaseChoice, setShowcaseChoice] = useState<"yes" | "no" | "">("");
  const [returnToReview, setReturnToReview] = useState(false);
  const [note, setNote] = useState("");
  const [linksText, setLinksText] = useState("");
  const [extraFiles, setExtraFiles] = useState<(LocalFile & { id?: string })[]>(
    [],
  );
  const [eligibilityAnswered, setEligibilityAnswered] = useState({
    previouslyApplied: false,
    previouslyReferred: false,
    knowsOwner: false,
    inListedLocation: false,
  });
  const [answers, setAnswers] = useState<EligibilityAnswers>({
    previouslyApplied: null,
    previouslyReferred: null,
    knowsOwner: false,
    inListedLocation: null,
  });
  const [candidate, setCandidate] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "",
    currentCompany: "",
    currentTitle: "",
    relationship: "professional_network" as Relationship,
  });
  const heardFrom = "Personal referral link · source details are not collected";

  useEffect(() => {
    if (!session?.user?.id || !job) return;
    void fetch("/api/analytics/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ jobId: job.id, event: "candidate_role_view" }),
    }).catch(() => undefined);
  }, [job, session?.user?.id]);

  const totalExtras = extraFiles.reduce((sum, file) => sum + file.size, 0);
  if (loading)
    return (
      <CandidateShell>
        <section
          className="mx-auto max-w-3xl px-5 py-16 sm:px-8"
          aria-busy="true"
        >
          <CandidateGuide
            mood="checking"
            layout="compact"
            title="Checking request availability."
            message="I’ll confirm the request service is ready before asking for any details."
          />
        </section>
      </CandidateShell>
    );
  if (workspaceError)
    return (
      <CandidateShell>
        <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
          <CandidateGuide
            mood="unavailable"
            layout="compact"
            title="Requests aren’t available yet."
            message="Please try again later. No request was created."
          />
          <Link
            className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[#2456c7] px-5 text-sm font-semibold text-white"
            href="/"
          >
            Back home
          </Link>
        </section>
      </CandidateShell>
    );
  if (!session?.user)
    return (
      <CandidateShell>
        <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <Eyebrow>Verified candidate sign in</Eyebrow>
          <h1 className="mt-4 font-serif text-4xl text-[#142b4b]">
            Sign in before sharing your details.
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[#526174]">
            Your email must be verified so this request and its status can be
            linked to your private account.
          </p>
          <Link
            className="mt-7 inline-flex rounded-full bg-[#142b4b] px-5 py-3 text-sm font-semibold text-white"
            href={`/sign-in?next=${encodeURIComponent(`/referral/${jobId}`)}`}
          >
            Verify your email
          </Link>
        </section>
      </CandidateShell>
    );
  if (!job)
    return (
      <CandidateShell>
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <Eyebrow>Referral request</Eyebrow>
          <h1 className="mt-4 font-serif text-4xl text-[#142b4b]">
            I can’t check that role right now.
          </h1>
          <p className="mt-4 text-[#526174]">
            Requests aren’t available yet. Please try again later. No request
            has been created.
          </p>
          <Link
            className="mt-7 inline-flex rounded-full bg-[#142b4b] px-5 py-3 text-sm font-semibold text-white"
            href="/"
          >
            Back home
          </Link>
        </div>
      </CandidateShell>
    );

  const slot = slots.find((item) => item.jobId === job.id);
  const slotClosed =
    job.status === "referred" ||
    job.status === "closed" ||
    job.status === "paused" ||
    slot?.status === "reserved" ||
    slot?.status === "confirmed";
  const unknown = step === "eligibility" && job.availability === "unknown";
  const stopAtStart =
    step === "eligibility" && (slotClosed || job.availability === "closed");
  const stepIndex = [
    "eligibility",
    "details",
    "resume",
    "showcase",
    "review",
  ].indexOf(step);
  const progress =
    step === "complete"
      ? 100
      : step === "stopped"
        ? 0
        : Math.max(10, Math.round(((stepIndex + 1) / 5) * 100));
  const stepNames = [
    "Quick checks",
    "Your details",
    "Resume",
    "Optional extras",
    "Review",
  ];
  const guideMood: GuideMood =
    step === "complete"
      ? "success"
      : step === "stopped" || stopAtStart || unknown
        ? "unavailable"
        : step === "eligibility" || step === "resume" || step === "review"
          ? "checking"
          : "reassuring";
  const guideContent: Record<Step, { title: string; message: string }> = {
    eligibility: {
      title: "A few straightforward checks.",
      message:
        "No contact details or resume are needed until the role and basic checks are clear.",
    },
    details: {
      title: "Share only what the owner needs.",
      message:
        "The employee who shared this link reviews your request. Add your contact details so they know who it is from.",
    },
    resume: {
      title: "Your resume is the main thing.",
      message:
        "A clear resume helps the employee review your experience. Extra notes and work samples are optional.",
    },
    showcase: {
      title: "A little more, only if you want.",
      message:
        "You can skip this step without penalty. Optional material does not change the evidence score.",
    },
    review: {
      title: "Take a moment to check the details.",
      message:
        "Review your contact information and any optional material before you finish.",
    },
    complete: {
      title: "Your request is in.",
      message: "Aashik will review your request and reply within two days.",
    },
    stopped: {
      title: "It’s okay to pause here.",
      message:
        "I can’t confirm this eligibility answer. Ask the employee who shared the link before continuing.",
    },
  };

  function updateAnswer<K extends keyof EligibilityAnswers>(
    key: K,
    value: EligibilityAnswers[K],
  ) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setEligibilityAnswered((current) => ({ ...current, [key]: true }));
  }
  async function handleResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(extension ?? "")) {
      setError("Choose a PDF or DOCX resume.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Resume files must be 4 MiB or smaller.");
      event.target.value = "";
      return;
    }
    setLocalResume({
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
    });
    setResumeId(null);
    setResumeReadiness(null);
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    form.set("jobId", job?.id ?? jobId);
    form.set("eligibility", JSON.stringify(answers));
    void fetch("/api/uploads/resume", { method: "POST", body: form })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw new Error(
            value.message || "Resume upload could not be completed.",
          );
        const resume = value.resume;
        setResumeId(resume.id);
        setResumeReadiness({
          ready:
            resume.readiness?.ready === true && resume.parserStatus === "ready",
          missingFields: resume.readiness?.missingFields ?? [],
          parserStatus: resume.parserStatus,
        });
        setError(
          resume.parserStatus === "quarantined"
            ? "The file is quarantined because a clean scan is not available. Try again when file scanning is configured."
            : "",
        );
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Resume upload could not be completed.",
        ),
      )
      .finally(() => setUploading(false));
    setError("");
  }
  function handleExtraFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    const added = chosen.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
    }));
    const next = [...extraFiles, ...added];
    const hasUnsupported = added.some(
      (file) =>
        !["pdf", "docx"].includes(
          file.name.split(".").pop()?.toLowerCase() ?? "",
        ),
    );
    if (hasUnsupported) setError("Choose PDF or DOCX files only.");
    else if (chosen.some((file) => file.size > MAX_FILE_SIZE))
      setError("Each supporting file must be 4 MiB or smaller.");
    else if (next.reduce((sum, file) => sum + file.size, 0) > MAX_EXTRAS)
      setError(
        "Supporting files must total 10 MiB or less. Remove a file to continue.",
      );
    else {
      const startIndex = extraFiles.length;
      setExtraFiles(next);
      setUploading(true);
      void Promise.all(
        chosen.map(async (file, index) => {
          const form = new FormData();
          form.set("file", file);
          form.set("jobId", job?.id ?? jobId);
          form.set("eligibility", JSON.stringify(answers));
          const response = await fetch("/api/uploads/supporting", {
            method: "POST",
            body: form,
          });
          const value = await response.json();
          if (
            !response.ok ||
            !value.file?.id ||
            value.file.scanStatus !== "clean"
          )
            throw new Error(
              value.message || "A supporting file is not available for review.",
            );
          return { index: startIndex + index, id: value.file.id as string };
        }),
      )
        .then((uploaded) =>
          setExtraFiles((current) =>
            current.map((item, index) => {
              const found = uploaded.find((upload) => upload.index === index);
              return found ? { ...item, id: found.id } : item;
            }),
          ),
        )
        .catch((reason: unknown) => {
          setExtraFiles((current) => current.filter((file) => file.id));
          setError(
            reason instanceof Error
              ? reason.message
              : "Supporting file upload failed.",
          );
        })
        .finally(() => setUploading(false));
      setError("");
    }
    event.target.value = "";
  }
  function canContinueEligibility() {
    return Object.values(eligibilityAnswered).every(Boolean);
  }
  function advanceEligibility() {
    if (!job) return;
    if (!canContinueEligibility()) {
      setError("Please answer each question to continue.");
      return;
    }
    void fetch("/api/analytics/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ jobId: job.id, event: "intake_started" }),
    }).catch(() => undefined);
    if (answers.previouslyReferred) {
      setStopReason("already_referred");
      setStep("stopped");
      return;
    }
    if (answers.previouslyApplied) {
      setStopReason("already_applied");
      setStep("stopped");
      return;
    }
    if (
      answers.previouslyApplied === null ||
      answers.previouslyReferred === null
    ) {
      setStopReason("eligibility_review");
      setStep("stopped");
      return;
    }
    if (answers.knowsOwner) {
      setStopReason("known_person");
      setStep("stopped");
      return;
    }
    if (answers.inListedLocation === false) {
      setStopReason("location_review");
      setStep("stopped");
      return;
    }
    void fetch("/api/analytics/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        jobId: job.id,
        event: "quick_checks_passed",
        eligibility: answers,
      }),
    }).catch(() => undefined);
    setError("");
    setStep("details");
  }
  function advanceResume() {
    if (!localResume) {
      setError("Choose a resume file to continue.");
      return;
    }
    if (!resumeId || !resumeReadiness?.ready) {
      setError(
        resumeReadiness?.parserStatus === "quarantined"
          ? "The resume is quarantined until a clean file scan is available."
          : resumeReadiness?.missingFields.length
            ? `The resume needs readable ${resumeReadiness.missingFields.join(", ")}.`
            : uploading
              ? "Wait for the resume upload and check to finish."
              : "Upload a resume and wait for its server check before continuing.",
      );
      return;
    }
    setError("");
    setStep("showcase");
  }
  function nextFromShowcase() {
    if (showcaseChoice === "") {
      setError(
        "Choose whether you’d like to add anything. Skipping is completely fine.",
      );
      return;
    }
    if (showcaseChoice === "yes" && Array.from(note).length > 500) {
      setError("Keep your note to 500 characters or fewer.");
      return;
    }
    if (showcaseChoice === "yes" && linksText.trim()) {
      const invalid = linksText
        .split(/[\n,]/)
        .map((link) => link.trim())
        .filter(Boolean)
        .some((link) => {
          try {
            return new URL(link).protocol !== "https:";
          } catch {
            return true;
          }
        });
      if (invalid) {
        setError("Enter full links that begin with https://.");
        return;
      }
    }
    setError("");
    setReturnToReview(false);
    setStep("review");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    if (
      !resumeId ||
      !resumeReadiness?.ready ||
      extraFiles.some((file) => !file.id)
    ) {
      setError(
        "Wait for all files to finish their server checks before submitting.",
      );
      return;
    }
    setUploading(true);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job?.id ?? jobId,
          candidate: {
            ...candidate,
            email: session?.user?.email ?? candidate.email,
          },
          eligibility: answers,
          relationship: candidate.relationship,
          resumeId,
          showcase:
            showcaseChoice === "yes"
              ? {
                  note,
                  links: linksText
                    .split(/[\n,]/)
                    .map((link) => link.trim())
                    .filter(Boolean),
                  files: extraFiles.map(({ id }) => ({ id })),
                }
              : undefined,
        }),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(
          value.message || "Your request could not be submitted.",
        );
      const applicationId = value.applicationId || value.id;
      if (typeof applicationId !== "string" || applicationId.length === 0)
        throw new Error(
          "The request was submitted, but no receipt ID returned.",
        );
      setSubmittedId(applicationId);
      setStep("complete");
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your request could not be submitted.",
      );
    } finally {
      setUploading(false);
    }
  }

  const showStepProgress =
    stepIndex >= 0 &&
    step !== "complete" &&
    step !== "stopped" &&
    !stopAtStart &&
    !unknown;
  return (
    <CandidateShell>
      <div className="mx-auto max-w-6xl px-5 pt-6 pb-10 sm:px-8 sm:pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#637287]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-medium hover:text-[#2456c7]"
          >
            <span aria-hidden="true">←</span> The Open Door
          </Link>
          <span className="rounded-full bg-[#edf6ff] px-3 py-1.5 font-bold tracking-wide text-[#32619c]">
            PERSONAL REQUEST
            {step === "complete"
              ? " · COMPLETE"
              : step === "stopped"
                ? " · PAUSED"
                : ""}
          </span>
        </div>
        {showStepProgress && (
          <div className="rounded-2xl border border-[#dce5ef] bg-white px-4 py-4 shadow-[0_12px_35px_-30px_rgba(18,48,84,0.32)] sm:px-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="font-semibold text-[#294c78]">
                Step {stepIndex + 1} of 5{" "}
                <span className="text-[#9db0c5 mx-1">·</span>{" "}
                {stepNames[stepIndex]}
              </p>
              <p className="text-[#6a7d93]">{progress}% complete</p>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[#e5edf6]"
              role="progressbar"
              aria-label={`${stepNames[stepIndex]} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-[#3475d6] transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <ol className="mt-3 grid grid-cols-5 gap-1 sm:gap-2">
              {stepNames.map((name, index) => (
                <li
                  key={name}
                  aria-current={index === stepIndex ? "step" : undefined}
                  className={`min-w-0 text-[9px] leading-4 sm:text-[11px] ${index === stepIndex ? "font-bold text-[#2456c7]" : index < stepIndex ? "font-medium text-[#4f6d8d]" : "text-[#91a0b1]"}`}
                >
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] ${index < stepIndex ? "bg-[#e2efff] text-[#2456c7]" : index === stepIndex ? "bg-[#2456c7] text-white" : "bg-[#eef2f7] text-[#7b8da3]"}`}
                    >
                      {index < stepIndex ? "✓" : index + 1}
                    </span>
                    <span className="truncate">{name}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {stopAtStart ? (
          <div className="mt-7 grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-stretch">
            <CandidateGuide
              mood="unavailable"
              title="Let’s pause before personal details."
              message="This role is not accepting a new referral request right now."
            />
            <div className="rounded-[1.5rem] border border-[#dce5ef] bg-white p-6 sm:p-9">
              <Eyebrow>Intake unavailable</Eyebrow>
              <h1 className="mt-3 text-3xl leading-tight font-bold tracking-[-0.035em] text-[#142b4b] sm:text-4xl">
                This role can’t accept another request.
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-[#526174]">
                {slot?.status === "confirmed" || job.status === "referred"
                  ? "A referral has already been confirmed for this employee’s slot."
                  : slot?.status === "reserved" || job.status === "paused"
                    ? "This employee’s referral slot is currently reserved."
                    : "This role is not available for a new referral request."}{" "}
                You can check the listing directly for its current hiring
                status.
              </p>
              <a
                href={job.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#c9d9ea] px-5 text-sm font-semibold text-[#2456c7] underline-offset-4 hover:bg-[#f3f8ff]"
              >
                View the EA Careers listing ↗
              </a>
            </div>
          </div>
        ) : unknown ? (
          <div className="mt-7 grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-stretch">
            <CandidateGuide
              mood="unavailable"
              title="I can’t verify this listing."
              message="That doesn’t mean the role is closed. I’ll pause before asking for your details."
            />
            <div className="rounded-[1.5rem] border border-[#dce5ef] bg-white p-6 sm:p-9">
              <Eyebrow>Role status needs a check</Eyebrow>
              <h1 className="mt-3 text-3xl leading-tight font-bold tracking-[-0.035em] text-[#142b4b] sm:text-4xl">
                Check the listing directly before you continue.
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-[#526174]">
                The listing check didn’t return a current status. This does not
                mean the role is closed, so I won’t ask for your personal
                information yet.
              </p>
              <a
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#2456c7] px-5 text-sm font-semibold text-white transition hover:bg-[#1b46aa]"
                href={job.officialUrl}
                target="_blank"
                rel="noreferrer"
              >
                Check EA Careers ↗
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-7">
              <section className="order-2 lg:order-1">
                <div className="mb-5">
                  <Eyebrow>Personal referral request</Eyebrow>
                  <h1 className="mt-2 text-3xl leading-tight font-bold tracking-[-0.035em] text-[#142b4b] sm:text-[2.75rem]">
                    {stepHeading(step)}
                  </h1>
                </div>
                <div className="rounded-[1.5rem] border border-[#dce5ef] bg-white p-5 shadow-[0_20px_60px_-48px_rgba(18,48,84,0.3)] sm:p-8">
                  {step === "eligibility" && (
                    <EligibilityStep
                      answers={answers}
                      answered={eligibilityAnswered}
                      updateAnswer={updateAnswer}
                      job={job}
                      onNext={advanceEligibility}
                    />
                  )}
                  {step === "details" && (
                    <DetailsStep
                      candidate={{
                        ...candidate,
                        email: session?.user?.email ?? "",
                      }}
                      setCandidate={setCandidate}
                      verifiedEmail={session?.user?.email ?? ""}
                      onBack={() => {
                        if (returnToReview) {
                          setReturnToReview(false);
                          setStep("review");
                        } else {
                          setStep("eligibility");
                        }
                      }}
                      backLabel={returnToReview ? "Back to review" : "Back"}
                      onNext={() => {
                        if (
                          !candidate.firstName.trim() ||
                          !candidate.lastName.trim() ||
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                            session?.user?.email ?? "",
                          ) ||
                          !candidate.phone.trim() ||
                          !candidate.country.trim()
                        ) {
                          setError(
                            "Add your first and last name, a valid email, phone number, and country to continue.",
                          );
                          return;
                        }
                        setError("");
                        if (returnToReview) {
                          setReturnToReview(false);
                          setStep("review");
                        } else {
                          setStep("resume");
                        }
                      }}
                    />
                  )}
                  {step === "resume" && (
                    <ResumeStep
                      localResume={localResume}
                      onChoose={handleResume}
                      onBack={() => setStep("details")}
                      onNext={advanceResume}
                      readiness={resumeReadiness}
                      uploading={uploading}
                    />
                  )}
                  {step === "showcase" && (
                    <ShowcaseStep
                      choice={showcaseChoice}
                      setChoice={setShowcaseChoice}
                      note={note}
                      setNote={setNote}
                      links={linksText}
                      setLinks={setLinksText}
                      files={extraFiles}
                      onChoose={handleExtraFiles}
                      total={totalExtras}
                      uploading={uploading}
                      onRemove={(index) =>
                        setExtraFiles((files) =>
                          files.filter((_, i) => i !== index),
                        )
                      }
                      onBack={() => {
                        if (returnToReview) {
                          setReturnToReview(false);
                          setStep("review");
                        } else {
                          setStep("resume");
                        }
                      }}
                      backLabel={returnToReview ? "Back to review" : "Back"}
                      onNext={nextFromShowcase}
                    />
                  )}
                  {step === "review" && (
                    <ReviewStep
                      candidate={{
                        ...candidate,
                        email: session?.user?.email ?? "",
                      }}
                      answers={answers}
                      job={job}
                      resumeFileName={localResume?.name ?? ""}
                      choice={showcaseChoice}
                      note={note}
                      links={linksText}
                      files={extraFiles}
                      heardFrom={heardFrom}
                      submitting={uploading}
                      onEditDetails={() => {
                        setError("");
                        setReturnToReview(true);
                        setStep("details");
                      }}
                      onEditShowcase={() => {
                        setError("");
                        setReturnToReview(true);
                        setStep("showcase");
                      }}
                      onSubmit={submit}
                    />
                  )}
                  {step === "complete" && (
                    <CompleteStep submittedId={submittedId} />
                  )}
                  {step === "stopped" && <StoppedStep reason={stopReason} />}
                  {error && (
                    <p
                      className="mt-5 rounded-xl border border-[#ecd6ce] bg-[#fcf1ed] px-4 py-3 text-sm leading-6 text-[#844936]"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}
                </div>
              </section>
              <aside className="order-1 space-y-4 lg:order-2">
                <CandidateGuide
                  mood={guideMood}
                  layout="compact"
                  title={guideContent[step].title}
                  message={guideContent[step].message}
                />
                <div className="rounded-2xl border border-[#dce5ef] bg-white p-5">
                  <Eyebrow>The role</Eyebrow>
                  <h2 className="mt-3 leading-6 font-semibold text-[#1b3b61]">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#60758b]">
                    {job.team} · {job.location}
                  </p>
                  <div className="mt-4 border-t border-[#edf2f7] pt-4 text-xs leading-5 text-[#687d94]">
                    <p>{job.canonicalJobId}</p>
                    <p className="mt-1">
                      Listing availability:{" "}
                      {job.availability === "open"
                        ? "marked open"
                        : job.availability === "closed"
                          ? "marked closed"
                          : "unknown"}
                    </p>
                  </div>
                  <a
                    className="mt-3 inline-flex text-xs font-semibold text-[#2456c7] underline underline-offset-4"
                    href={job.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official listing ↗
                  </a>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </CandidateShell>
  );
}

function stepHeading(step: Step) {
  return (
    {
      eligibility: "A few quick checks.",
      details: "A little about you.",
      resume: "Add a resume for review.",
      showcase: "Anything else you’d like to share?",
      review: "Take a final look.",
      complete: "Your request is in.",
      stopped: "A quick note before you go.",
    } as Record<Step, string>
  )[step];
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#2c4460]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-[#687d94]">
          {hint}
        </span>
      )}
    </label>
  );
}
const inputClass =
  "min-h-11 w-full rounded-xl border border-[#cfdae8] bg-[#ffffff] px-3.5 text-sm outline-none transition focus:border-[#4981d4] focus:ring-4 focus:ring-[#e8f1ff]";
function Choice({
  label,
  selected,
  onClick,
  description,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  description?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4981d4] ${selected ? "border-[#4a78cb] bg-[#eef5ff] ring-1 ring-[#4a78cb]" : "border-[#dce5ef] bg-white hover:border-[#97b5d2]"}`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`grid size-4 shrink-0 place-items-center rounded-full border ${selected ? "border-[#315cb1]" : "border-[#97b0ca]"}`}
        >
          {selected && <span className="size-2 rounded-full bg-[#315cb1]" />}
        </span>
        <span className="text-sm font-medium text-[#2c4460]">{label}</span>
      </span>
      {description && (
        <span className="mt-1 ml-7 block text-xs leading-5 text-[#687d94]">
          {description}
        </span>
      )}
    </button>
  );
}
function ActionRow({
  back,
  next,
  backLabel = "Back",
  nextLabel = "Continue",
}: {
  back?: () => void;
  next: () => void;
  backLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#edf2f7] pt-5 sm:flex-row sm:justify-between">
      {back ? (
        <button
          type="button"
          onClick={back}
          className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#526174] hover:bg-[#f1f6fc]"
        >
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={next}
        className="min-h-11 rounded-full bg-[#142b4b] px-6 text-sm font-semibold text-white transition hover:bg-[#1b46aa]"
      >
        {nextLabel} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
function EligibilityStep({
  answers,
  answered,
  updateAnswer,
  job,
  onNext,
}: {
  answers: EligibilityAnswers;
  answered: {
    previouslyApplied: boolean;
    previouslyReferred: boolean;
    knowsOwner: boolean;
    inListedLocation: boolean;
  };
  updateAnswer: <K extends keyof EligibilityAnswers>(
    key: K,
    value: EligibilityAnswers[K],
  ) => void;
  job: Job;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-[#d7e8f8] bg-[#eef7ff] px-4 py-3 text-sm leading-6 text-[#3e5d7c]">
        These quick questions come before contact details or a resume. In this
        flow, some answers need the employee who shared the link to review them.
        They do not determine EA hiring decisions.
      </p>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-[#2c4460]">
          Have you already applied to EA for this role?
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <Choice
            label="No"
            selected={
              answered.previouslyApplied && answers.previouslyApplied === false
            }
            onClick={() => updateAnswer("previouslyApplied", false)}
          />
          <Choice
            label="Yes"
            selected={answers.previouslyApplied === true}
            onClick={() => updateAnswer("previouslyApplied", true)}
          />
          <Choice
            label="I’m not sure"
            selected={
              answered.previouslyApplied && answers.previouslyApplied === null
            }
            onClick={() => updateAnswer("previouslyApplied", null)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-[#2c4460]">
          Have you already been referred for this role?
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <Choice
            label="No"
            selected={
              answered.previouslyReferred &&
              answers.previouslyReferred === false
            }
            onClick={() => updateAnswer("previouslyReferred", false)}
          />
          <Choice
            label="Yes"
            selected={answers.previouslyReferred === true}
            onClick={() => updateAnswer("previouslyReferred", true)}
          />
          <Choice
            label="I’m not sure"
            selected={
              answered.previouslyReferred && answers.previouslyReferred === null
            }
            onClick={() => updateAnswer("previouslyReferred", null)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-[#2c4460]">
          Are you located in one of the role’s listed locations?
        </legend>
        <p className="mb-3 text-xs leading-5 text-[#687d94]">
          {job.locations.join(" · ")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            label="Yes"
            selected={answers.inListedLocation === true}
            onClick={() => updateAnswer("inListedLocation", true)}
          />
          <Choice
            label="No"
            selected={answers.inListedLocation === false}
            onClick={() => updateAnswer("inListedLocation", false)}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-[#2c4460]">
          Have you met or worked with the employee who shared this link?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            label="No"
            selected={answered.knowsOwner && !answers.knowsOwner}
            onClick={() => updateAnswer("knowsOwner", false)}
          />
          <Choice
            label="Yes"
            selected={answers.knowsOwner}
            onClick={() => updateAnswer("knowsOwner", true)}
          />
        </div>
      </fieldset>
      <ActionRow next={onNext} />
    </div>
  );
}
function DetailsStep({
  candidate,
  setCandidate,
  verifiedEmail,
  onBack,
  backLabel,
  onNext,
}: {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    currentCompany: string;
    currentTitle: string;
    relationship: Relationship;
  };
  setCandidate: (next: typeof candidate) => void;
  verifiedEmail: string;
  onBack: () => void;
  backLabel: string;
  onNext: () => void;
}) {
  function field(key: keyof typeof candidate, value: string) {
    setCandidate({ ...candidate, [key]: value });
  }
  return (
    <div>
      <p className="rounded-xl border border-[#d7e8f8] bg-[#f2f8ff] px-4 py-3 text-sm leading-6 text-[#405a76]">
        If you submit, the employee who shared this link can review these
        details and your resume. This does not apply to EA.{" "}
        <Link
          className="font-semibold text-[#2456c7] underline underline-offset-4"
          href="/privacy"
        >
          Privacy details
        </Link>
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input
            className={inputClass}
            value={candidate.firstName}
            onChange={(event) => field("firstName", event.target.value)}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name">
          <input
            className={inputClass}
            value={candidate.lastName}
            onChange={(event) => field("lastName", event.target.value)}
            autoComplete="family-name"
          />
        </Field>
        <Field label="Email address">
          <input
            className={inputClass}
            type="email"
            value={verifiedEmail}
            readOnly
            onChange={(event) => field("email", event.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone number">
          <input
            className={inputClass}
            type="tel"
            value={candidate.phone}
            onChange={(event) => field("phone", event.target.value)}
            autoComplete="tel"
          />
        </Field>
        <Field label="Country">
          <input
            className={inputClass}
            value={candidate.country}
            onChange={(event) => field("country", event.target.value)}
            autoComplete="country-name"
          />
        </Field>
        <Field label="Relationship to me">
          <select
            className={inputClass}
            value={candidate.relationship}
            onChange={(event) => field("relationship", event.target.value)}
          >
            {relationshipOptions.map(({ value, label }) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Current employer (optional)">
          <input
            className={inputClass}
            value={candidate.currentCompany}
            onChange={(event) => field("currentCompany", event.target.value)}
          />
        </Field>
        <Field label="Current title (optional)">
          <input
            className={inputClass}
            value={candidate.currentTitle}
            onChange={(event) => field("currentTitle", event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Opportunity source"
            hint="This flow starts from a personal referral link and does not collect referral source details."
          >
            <div
              className={`${inputClass} flex items-center text-sm text-[#526174]`}
            >
              Personal referral link · no source selection collected
            </div>
          </Field>
        </div>
      </div>
      <ActionRow back={onBack} backLabel={backLabel} next={onNext} />
    </div>
  );
}
function ResumeStep({
  localResume,
  onChoose,
  onBack,
  onNext,
  readiness,
  uploading,
}: {
  localResume: LocalFile | null;
  onChoose: (event: ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onNext: () => void;
  readiness: {
    ready: boolean;
    missingFields: string[];
    parserStatus: string;
  } | null;
  uploading: boolean;
}) {
  return (
    <div>
      <p className="text-sm leading-6 text-[#526174]">
        We need to read your first name, last name, email, and phone from the
        resume itself. Typing those details above does not replace them in the
        document.
      </p>
      <label className="mt-5 block cursor-pointer rounded-xl border border-dashed border-[#a9c2dc] p-4 transition hover:bg-[#f6faff]">
        <span className="block text-sm font-semibold text-[#2c4460]">
          Choose a resume file from this device
        </span>
        <span className="mt-1 block text-xs leading-5 text-[#687d94]">
          PDF or DOCX · up to 4 MiB · uploaded for a secure scan and text check
        </span>
        <input
          className="mt-3 block w-full text-sm text-[#526174] file:mr-3 file:rounded-full file:border-0 file:bg-[#e8f1ff] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#2456c7]"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onChoose}
        />
      </label>
      {localResume && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm leading-6 ${readiness?.ready ? "border border-[#d7e8f8] bg-[#eef7ff] text-[#3e5d7c]" : "border border-[#efdfbe] bg-[#fbf5e8] text-[#735b2c]"}`}
          role="status"
          aria-live="polite"
        >
          {uploading
            ? "Uploading and checking the resume…"
            : readiness?.ready
              ? `${localResume.name} is ready. Required contact fields were found in the document.`
              : readiness?.parserStatus === "quarantined"
                ? `${localResume.name} is quarantined pending a clean scan.`
                : readiness
                  ? `The document needs readable ${readiness.missingFields.join(", ") || "contact fields"}. Update the file and upload it again.`
                  : "Waiting for the server resume check."}
        </p>
      )}
      <div className="mt-6">
        <ActionRow back={onBack} next={onNext} />
      </div>
    </div>
  );
}
function ShowcaseStep({
  choice,
  setChoice,
  note,
  setNote,
  links,
  setLinks,
  files,
  onChoose,
  total,
  onRemove,
  onBack,
  backLabel,
  onNext,
  uploading,
}: {
  choice: "yes" | "no" | "";
  setChoice: (choice: "yes" | "no") => void;
  note: string;
  setNote: (value: string) => void;
  links: string;
  setLinks: (value: string) => void;
  files: LocalFile[];
  onChoose: (event: ChangeEvent<HTMLInputElement>) => void;
  total: number;
  onRemove: (index: number) => void;
  onBack: () => void;
  backLabel: string;
  onNext: () => void;
  uploading: boolean;
}) {
  return (
    <div>
      <p className="max-w-xl text-sm leading-6 text-[#526174]">
        Your resume is the main item for review. Add a note or work sample only
        if it helps explain your experience.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Choice
          label="Yes, I’d like to add something"
          selected={choice === "yes"}
          onClick={() => setChoice("yes")}
        />
        <Choice
          label="No, continue with my resume"
          selected={choice === "no"}
          onClick={() => setChoice("no")}
        />
      </div>
      {choice === "yes" && (
        <div className="mt-6 space-y-5 border-t border-[#edf2f7] pt-5">
          <Field
            label="What would you like the employee to know?"
            hint="Optional · up to 500 characters"
          >
            <textarea
              className={`${inputClass} min-h-32 resize-y py-3`}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="A project, your contribution, or a result you’re proud of…"
            />
            <span className="mt-1 block text-right text-xs text-[#687d94]">
              {Array.from(note).length}/500
            </span>
          </Field>
          <Field
            label="Project or portfolio links"
            hint="Optional · one URL per line"
          >
            <textarea
              className={`${inputClass} min-h-20 resize-y py-3`}
              value={links}
              onChange={(event) => setLinks(event.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field
            label="Supporting files"
            hint="Optional · PDF or DOCX · each file up to 4 MiB, total up to 10 MiB"
          >
            <input
              className="block w-full text-sm text-[#526174] file:mr-3 file:rounded-full file:border-0 file:bg-[#e8f1ff] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#2456c7]"
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onChoose}
            />
          </Field>
          {uploading && (
            <p className="text-xs text-[#526174]" role="status">
              Uploading and checking selected files…
            </p>
          )}
          <div className="rounded-xl bg-[#f1f6fc] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#526174]">
                Supporting files selected
              </span>
              <span
                className={
                  total > MAX_EXTRAS
                    ? "font-semibold text-red-700"
                    : "text-[#687d94]"
                }
              >
                {formatBytes(total)} / 10 MiB
              </span>
            </div>
            {files.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 text-xs text-[#526174]"
                  >
                    <span className="truncate">
                      {file.name} · {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="shrink-0 font-semibold text-[#3f719d] underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#687d94]">No files chosen.</p>
            )}
          </div>
        </div>
      )}
      <ActionRow back={onBack} backLabel={backLabel} next={onNext} />
    </div>
  );
}
function ReviewStep({
  candidate,
  answers,
  job,
  choice,
  note,
  links,
  files,
  heardFrom,
  onEditDetails,
  onEditShowcase,
  onSubmit,
  submitting,
  resumeFileName,
}: {
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    currentCompany: string;
    currentTitle: string;
    relationship: Relationship;
  };
  answers: EligibilityAnswers;
  job: Job;
  choice: "yes" | "no" | "";
  note: string;
  links: string;
  files: LocalFile[];
  heardFrom: string;
  onEditDetails: () => void;
  onEditShowcase: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  resumeFileName: string;
}) {
  const relationship =
    relationshipOptions.find(({ value }) => value === candidate.relationship)
      ?.label ?? candidate.relationship;
  const showcaseLinks = links
    .split(/[\n,]/)
    .map((link) => link.trim())
    .filter(Boolean);
  return (
    <form onSubmit={onSubmit}>
      <div className="mt-5 space-y-4">
        <section className="rounded-2xl border border-[#e1e9f2] px-4 py-2 sm:px-5">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] py-3">
            <h3 className="text-sm font-semibold text-[#1b3b61]">
              Role and eligibility
            </h3>
          </div>
          <dl className="divide-y divide-[#edf2f7]">
            <ReviewRow
              label="Role"
              value={`${job.title} · ${job.canonicalJobId}`}
            />
            <ReviewRow
              label="Previous activity"
              value={`Applied: ${answers.previouslyApplied ? "Yes" : "No"} · Referred: ${answers.previouslyReferred ? "Yes" : "No"}`}
            />
            <ReviewRow
              label="Location"
              value={`${answers.inListedLocation ? "Within" : "Outside"} the listed locations`}
            />
            <ReviewRow
              label="Prior connection"
              value={
                answers.knowsOwner
                  ? "Have met or worked with the employee"
                  : "No prior personal connection"
              }
            />
            <ReviewRow
              label="Resume"
              value={`${resumeFileName || "Uploaded resume"} · server checked and ready`}
            />
          </dl>
        </section>
        <section className="rounded-2xl border border-[#e1e9f2] px-4 py-2 sm:px-5">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] py-3">
            <h3 className="text-sm font-semibold text-[#1b3b61]">
              Contact details
            </h3>
            <button
              type="button"
              onClick={onEditDetails}
              className="shrink-0 text-xs font-semibold text-[#2456c7] underline underline-offset-4"
            >
              Edit details
            </button>
          </div>
          <dl className="divide-y divide-[#edf2f7]">
            <ReviewRow
              label="Name and email"
              value={`${candidate.firstName || "—"} ${candidate.lastName || ""} · ${candidate.email || "—"}`}
            />
            <ReviewRow
              label="Phone"
              value={candidate.phone || "Not provided"}
            />
            <ReviewRow
              label="Country"
              value={candidate.country || "Not provided"}
            />
            <ReviewRow label="Relationship" value={relationship} />
            <ReviewRow
              label="Current work"
              value={
                [candidate.currentTitle, candidate.currentCompany]
                  .filter(Boolean)
                  .join(" at ") || "Not provided"
              }
            />
            <ReviewRow label="Opportunity source" value={heardFrom} />
          </dl>
        </section>
        <section className="rounded-2xl border border-[#e1e9f2] px-4 py-2 sm:px-5">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] py-3">
            <h3 className="text-sm font-semibold text-[#1b3b61]">
              Optional material
            </h3>
            <button
              type="button"
              onClick={onEditShowcase}
              className="shrink-0 text-xs font-semibold text-[#2456c7] underline underline-offset-4"
            >
              Edit optional material
            </button>
          </div>
          <dl className="divide-y divide-[#edf2f7]">
            <ReviewRow
              label="Choice"
              value={choice === "yes" ? "Optional material added" : "Skipped"}
            />
          </dl>
          {choice === "yes" && (
            <div className="space-y-3 border-t border-[#edf2f7] py-4 text-sm leading-6 text-[#405773]">
              {note && <p className="whitespace-pre-wrap">{note}</p>}
              {showcaseLinks.length > 0 && (
                <ul className="list-inside list-disc space-y-1 break-all">
                  {showcaseLinks.map((link) => (
                    <li key={link}>{link}</li>
                  ))}
                </ul>
              )}
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      {file.name} · {formatBytes(file.size)}
                    </li>
                  ))}
                </ul>
              )}
              {!note && showcaseLinks.length === 0 && files.length === 0 && (
                <p>No note, links, or files added.</p>
              )}
              <p className="text-xs text-[#687d94]">
                Optional material does not change the evidence coverage score.
              </p>
            </div>
          )}
        </section>
      </div>
      <p className="mt-5 text-xs leading-5 text-[#687d94]">
        The employee who shared the link reviews this request. A referral is
        never guaranteed. Your contact details and resume are stored for that
        review. This is not an EA job application.
      </p>
      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#edf2f7] pt-5 sm:flex-row sm:justify-between">
        <span />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-full bg-[#2456c7] px-6 text-sm font-semibold text-white transition hover:bg-[#1b46aa] disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit personal request"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-[#687d94]">{label}</dt>
      <dd className="text-sm text-[#2c4460]">{value}</dd>
    </div>
  );
}
function CompleteStep({ submittedId }: { submittedId: string }) {
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-full bg-[#e8f4ff] text-xl text-[#2867bb]">
        ✓
      </span>
      <p className="mt-5 text-sm leading-6 text-[#526174]">
        Your request was received for review by the employee who shared the
        link. This is not an EA job application, and no referral has been
        submitted.
      </p>
      <div className="mt-5 rounded-xl bg-[#f1f6fc] p-4 text-sm">
        <span className="text-xs text-[#687d94]">REQUEST RECEIPT</span>
        <p className="mt-1 font-mono text-[#2456c7]">{submittedId}</p>
      </div>
      <Link
        href="/status"
        className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#c9d9ea] px-5 text-sm font-semibold text-[#2456c7]"
      >
        Check request status
      </Link>
    </div>
  );
}
function StoppedStep({ reason }: { reason: StopReason }) {
  const messages: Record<StopReason, { title: string; body: string }> = {
    already_applied: {
      title: "You’ve already applied for this role.",
      body: "Please contact the employee who shared this link to confirm whether a referral request is appropriate. No request was submitted.",
    },
    already_referred: {
      title: "You’ve already been referred for this role.",
      body: "Please contact the employee who shared this link to confirm the next step. No request was submitted.",
    },
    eligibility_review: {
      title: "This needs an owner check.",
      body: "You selected “I’m not sure” about a prior application or referral. Please confirm next steps with the employee who shared this link before sharing personal information.",
    },
    known_person: {
      title: "You already know the employee.",
      body: "Please contact the employee using a method you already have to discuss next steps. No personal information was requested or saved.",
    },
    location_review: {
      title: "This needs an owner check.",
      body: "Your location may not match the listed locations. Please confirm next steps with the employee who shared this link before sharing personal information.",
    },
  };
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-full bg-[#eef6ff] text-xl text-[#3f719d]">
        i
      </span>
      <h2 className="mt-5 text-xl font-semibold text-[#1b3b61]">
        {messages[reason].title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#526174]">
        {messages[reason].body}
      </p>
      {reason === "known_person" && (
        <p className="mt-3 text-sm leading-6 text-[#526174]">
          No resume or contact information was requested or saved.
        </p>
      )}
    </div>
  );
}
function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
