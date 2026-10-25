"use client";

import {
  useState,
  useEffect,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useWorkspace } from "@/lib/demo/workspace";
import {
  relationshipOptions,
  relationshipOptionsVerified,
} from "@/lib/demo/fixtures";
import type {
  CreateApplicationInput,
  EligibilityAnswers,
  Job,
  Relationship,
} from "@/lib/demo/types";
import { CandidateShell, DemoNotice, Eyebrow } from "./candidate-shell";

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

export function IntakeFlow({ jobId }: { jobId: string }) {
  const { jobs, slots, submitApplication, mode, session } = useWorkspace();
  const job = jobs.find(
    (item) => item.id === jobId || item.canonicalJobId === jobId,
  );
  const [step, setStep] = useState<Step>("eligibility");
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [stopReason, setStopReason] = useState<StopReason>("already_applied");
  const [useSample, setUseSample] = useState(false);
  const [localResume, setLocalResume] = useState<LocalFile | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeReadiness, setResumeReadiness] = useState<{
    ready: boolean;
    missingFields: string[];
    parserStatus: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showcaseChoice, setShowcaseChoice] = useState<"yes" | "no" | "">("");
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
  const heardFrom = "EA's Public Career Page";

  useEffect(() => {
    if (mode !== "connected" || !session?.user?.id || !job) return;
    void fetch("/api/analytics/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ jobId: job.id, event: "candidate_role_view" }),
    }).catch(() => undefined);
  }, [job, mode, session?.user?.id]);

  const totalExtras = extraFiles.reduce((sum, file) => sum + file.size, 0);
  const badFields = useSample
    ? []
    : ["first name", "last name", "email address", "phone number"];
  if (mode === "connected" && !session?.user)
    return (
      <CandidateShell>
        <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <Eyebrow>Verified candidate sign in</Eyebrow>
          <h1 className="mt-4 font-serif text-4xl text-[#173d32]">
            Sign in before sharing your details.
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[#52645d]">
            Your email must be verified so this request and its status can be
            linked to your private account.
          </p>
          <Link
            className="mt-7 inline-flex rounded-full bg-[#173d32] px-5 py-3 text-sm font-semibold text-white"
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
          <h1 className="mt-4 font-serif text-4xl text-[#173d32]">
            We couldn’t find that sample role.
          </h1>
          <p className="mt-4 text-[#52645d]">
            Try opening the sample flow from the home page. This demo can’t look
            up live EA roles.
          </p>
          <Link
            className="mt-7 inline-flex rounded-full bg-[#173d32] px-5 py-3 text-sm font-semibold text-white"
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
    if (file.size > (mode === "connected" ? 4 * 1024 * 1024 : MAX_EXTRAS)) {
      setError(
        mode === "connected"
          ? "Resume files must be 4 MiB or smaller."
          : "This browser demo accepts resume selections up to 10 MiB.",
      );
      event.target.value = "";
      return;
    }
    setUseSample(false);
    setLocalResume({
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
    });
    setResumeId(null);
    setResumeReadiness(null);
    if (mode === "connected") {
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
              resume.readiness?.ready === true &&
              resume.parserStatus === "ready",
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
    }
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
        !(
          mode === "connected"
            ? ["pdf", "docx"]
            : ["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp"]
        ).includes(file.name.split(".").pop()?.toLowerCase() ?? ""),
    );
    if (hasUnsupported)
      setError(
        mode === "connected"
          ? "Choose PDF or DOCX files only."
          : "Choose PDF, DOCX, TXT, or common image files only.",
      );
    else if (
      mode === "connected" &&
      chosen.some((file) => file.size > 4 * 1024 * 1024)
    )
      setError("Each supporting file must be 4 MiB or smaller.");
    else if (next.reduce((sum, file) => sum + file.size, 0) > MAX_EXTRAS)
      setError(
        "Supporting files must total 10 MiB or less. Remove a file to continue.",
      );
    else {
      const startIndex = extraFiles.length;
      setExtraFiles(next);
      if (mode === "connected") {
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
                value.message ||
                  "A supporting file is not available for review.",
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
      }
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
    if (mode === "connected") {
      void fetch("/api/analytics/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ jobId: job.id, event: "intake_started" }),
      }).catch(() => undefined);
    }
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
    if (mode === "connected") {
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
    }
    setError("");
    setStep("details");
  }
  function advanceResume() {
    if (!localResume && !useSample) {
      setError(
        "Choose a resume file, or use the fictional sample resume to preview the demo.",
      );
      return;
    }
    if (mode === "connected" && (!resumeId || !resumeReadiness?.ready)) {
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
    if (mode === "demo" && !useSample) {
      setError(
        "Resume text extraction is not configured. Your selected file stays on this device, and the flow cannot mark it ready.",
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
    if (Array.from(note).length > 500) {
      setError("Keep your note to 500 characters or fewer.");
      return;
    }
    if (linksText.trim()) {
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
    setStep("review");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "connected") {
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
        setSubmittedId(value.applicationId || value.id || "");
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
      return;
    }
    if (!useSample) {
      setError(
        "A real resume parser and submission service are not configured. This demo only accepts the fictional sample resume.",
      );
      return;
    }
    const input: CreateApplicationInput = {
      jobId: job?.id ?? jobId,
      candidate: { ...candidate, relationship: candidate.relationship },
      eligibility,
      relationship: candidate.relationship,
      resume: {
        fileName: "Sample_Resume_Alex_Rivera.pdf",
        fileSize: 182400,
        fileType: "application/pdf",
        fields: { firstName: true, lastName: true, email: true, phone: true },
      },
      showcase:
        showcaseChoice === "yes"
          ? {
              note,
              links: linksText
                .split(/[\n,]/)
                .map((link) => link.trim())
                .filter(Boolean),
              files: extraFiles.map(({ name, size }) => ({ name, size })),
            }
          : undefined,
    };
    const result = await submitApplication(input);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSubmittedId(result.applicationId ?? "demo-request");
    setStep("complete");
    setError("");
  }

  const eligibility = answers;
  return (
    <CandidateShell>
      <div className="mx-auto max-w-4xl px-5 pt-8 pb-10 sm:px-8 sm:pt-12">
        <div className="mb-8 flex items-center justify-between gap-3 text-xs text-[#6e7c74]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 hover:text-[#173d32]"
          >
            <span aria-hidden="true">←</span> Home
          </Link>
          <span>
            APPLICATION PREVIEW <span className="mx-1">·</span>{" "}
            {step === "complete"
              ? "COMPLETE"
              : step === "stopped"
                ? "CHECK RESULT"
                : `STEP ${stepIndex + 1} OF 5`}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[#e2e8e3]"
          aria-label={`Progress ${progress}%`}
        >
          <div
            className="h-full rounded-full bg-[#4f806c] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        {stopAtStart ? (
          <div className="mt-9 rounded-[1.5rem] border border-[#e9ddc7] bg-white p-6 sm:p-9">
            <Eyebrow>Intake unavailable</Eyebrow>
            <h1 className="mt-3 font-serif text-4xl text-[#173d32]">
              This demo role can’t accept another request.
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#5c6d64]">
              {slot?.status === "confirmed" || job.status === "referred"
                ? "A referral has already been confirmed for this role in the sample data."
                : slot?.status === "reserved" || job.status === "paused"
                  ? "The sample intake is paused while a referral slot is reserved."
                  : "The role is marked closed in this demo."}{" "}
              No resume or personal details are requested here.
            </p>
            <div className="mt-6">
              <a
                href={job.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[#315b4c] underline underline-offset-4"
              >
                View the EA careers listing ↗
              </a>
            </div>
          </div>
        ) : unknown ? (
          <div className="mt-9 rounded-[1.5rem] border border-[#e9ddc7] bg-white p-6 sm:p-9">
            <Eyebrow>Role status needs a check</Eyebrow>
            <h1 className="mt-3 font-serif text-4xl text-[#173d32]">
              I can’t verify this listing in the demo.
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#5c6d64]">
              This does not mean the job is closed. The sample role is marked
              unknown, and the live EA listing checker is not connected. Check
              the listing directly or choose another sample role.
            </p>
            <a
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#173d32] px-5 text-sm font-semibold text-white"
              href={job.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              Check EA Careers ↗
            </a>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_245px]">
              <section>
                <div className="mb-5">
                  <Eyebrow>PERSONAL REFERRAL REQUEST</Eyebrow>
                  <h1 className="mt-2 font-serif text-4xl leading-tight tracking-[-0.035em] text-[#173d32] sm:text-[2.75rem]">
                    {stepHeading(step)}
                  </h1>
                </div>
                <div className="rounded-[1.5rem] border border-[#dce3dd] bg-white p-5 shadow-[0_20px_60px_-48px_rgba(23,61,50,0.3)] sm:p-8">
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
                      candidate={
                        mode === "connected"
                          ? { ...candidate, email: session?.user?.email ?? "" }
                          : candidate
                      }
                      setCandidate={setCandidate}
                      connected={mode === "connected"}
                      verifiedEmail={session?.user?.email ?? ""}
                      onBack={() => setStep("eligibility")}
                      onNext={() => {
                        if (
                          !candidate.firstName.trim() ||
                          !candidate.lastName.trim() ||
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                            mode === "connected"
                              ? (session?.user?.email ?? "")
                              : candidate.email,
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
                        setStep("resume");
                      }}
                    />
                  )}
                  {step === "resume" && (
                    <ResumeStep
                      useSample={useSample}
                      setUseSample={setUseSample}
                      localResume={localResume}
                      onChoose={handleResume}
                      badFields={badFields}
                      onBack={() => setStep("details")}
                      onNext={advanceResume}
                      connected={mode === "connected"}
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
                      connected={mode === "connected"}
                      uploading={uploading}
                      onRemove={(index) =>
                        setExtraFiles((files) =>
                          files.filter((_, i) => i !== index),
                        )
                      }
                      onBack={() => setStep("resume")}
                      onNext={nextFromShowcase}
                    />
                  )}
                  {step === "review" && (
                    <ReviewStep
                      candidate={
                        mode === "connected"
                          ? { ...candidate, email: session?.user?.email ?? "" }
                          : candidate
                      }
                      answers={answers}
                      job={job}
                      useSample={useSample}
                      connected={mode === "connected"}
                      resumeFileName={localResume?.name ?? ""}
                      choice={showcaseChoice}
                      note={note}
                      links={linksText}
                      files={extraFiles}
                      heardFrom={heardFrom}
                      onBack={() => setStep("showcase")}
                      onSubmit={submit}
                    />
                  )}
                  {step === "complete" && (
                    <CompleteStep
                      submittedId={submittedId}
                      connected={mode === "connected"}
                    />
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
              <aside className="space-y-4">
                <div className="rounded-2xl border border-[#dce3dd] bg-white p-5">
                  <Eyebrow>THE ROLE</Eyebrow>
                  <h2 className="mt-3 leading-6 font-semibold text-[#244a3d]">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#6b7a72]">
                    {job.team} · {job.location}
                  </p>
                  <div className="mt-4 border-t border-[#edf0ed] pt-4 text-xs leading-5 text-[#6f7d75]">
                    <p>{job.canonicalJobId}</p>
                    <p className="mt-1">
                      Listing status:{" "}
                      {job.availability === "open"
                        ? "manually marked open in demo"
                        : job.availability}
                    </p>
                  </div>
                  <a
                    className="mt-3 inline-flex text-xs font-semibold text-[#315b4c] underline underline-offset-4"
                    href={job.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official listing ↗
                  </a>
                </div>
                <div className="rounded-2xl bg-[#edf3ee] p-5">
                  <p className="text-sm font-semibold text-[#315b4c]">
                    Your resume is enough.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#68776f]">
                    Extra notes and supporting files are optional. You can skip
                    them without penalty.
                  </p>
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
      <span className="mb-2 block text-sm font-medium text-[#304d41]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-[#77857e]">
          {hint}
        </span>
      )}
    </label>
  );
}
const inputClass =
  "min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-[#fcfdfb] px-3.5 text-sm outline-none transition focus:border-[#4e7f6b] focus:ring-4 focus:ring-[#e5efe8]";
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
      className={`w-full rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4e7f6b] ${selected ? "border-[#54826e] bg-[#edf5ef] ring-1 ring-[#54826e]" : "border-[#dce3dd] bg-white hover:border-[#a9beb1]"}`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`grid size-4 shrink-0 place-items-center rounded-full border ${selected ? "border-[#3e705b]" : "border-[#aebbb3]"}`}
        >
          {selected && <span className="size-2 rounded-full bg-[#3e705b]" />}
        </span>
        <span className="text-sm font-medium text-[#304d41]">{label}</span>
      </span>
      {description && (
        <span className="mt-1 ml-7 block text-xs leading-5 text-[#78867f]">
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
    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#edf0ed] pt-5 sm:flex-row sm:justify-between">
      {back ? (
        <button
          type="button"
          onClick={back}
          className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#607168] hover:bg-[#f4f7f4]"
        >
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      {nextLabel === "Submit demo request" ? null : (
        <button
          type="button"
          onClick={next}
          className="min-h-11 rounded-full bg-[#173d32] px-6 text-sm font-semibold text-white transition hover:bg-[#245445]"
        >
          {nextLabel} <span aria-hidden="true">→</span>
        </button>
      )}
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
      <DemoNotice>
        This is a demo. We ask these before contact details or a resume. “Yes”
        for a prior application or referral ends this sample flow based on the
        sample policy.
      </DemoNotice>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-[#304d41]">
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
        <legend className="mb-3 text-sm font-semibold text-[#304d41]">
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
        <legend className="mb-3 text-sm font-semibold text-[#304d41]">
          Are you located in one of the role’s listed locations?
        </legend>
        <p className="mb-3 text-xs leading-5 text-[#77857e]">
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
        <legend className="mb-3 text-sm font-semibold text-[#304d41]">
          Do you know me personally or have we worked together?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            label="No, we haven’t"
            selected={answered.knowsOwner && !answers.knowsOwner}
            onClick={() => updateAnswer("knowsOwner", false)}
          />
          <Choice
            label="Yes, we know each other"
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
  connected,
  verifiedEmail,
  onBack,
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
  connected: boolean;
  verifiedEmail: string;
  onBack: () => void;
  onNext: () => void;
}) {
  function field(key: keyof typeof candidate, value: string) {
    setCandidate({ ...candidate, [key]: value });
  }
  return (
    <div>
      {!connected && (
        <DemoNotice>
          Your contact details are entered for the fictional sample application
          only. Values stay in this tab’s demo memory only. Use fictional sample
          details; the demo cannot send updates.
        </DemoNotice>
      )}
      {!connected && (
        <button
          type="button"
          onClick={() =>
            setCandidate({
              firstName: "Alex",
              lastName: "Rivera",
              email: "alex.rivera@example.invalid",
              phone: "+1 555 010 0199",
              country: "United States",
              currentCompany: "Northstar Interactive",
              currentTitle: "Gameplay Engineer",
              relationship: "former_colleague",
            })
          }
          className="mt-4 rounded-full border border-[#cbd8d1] px-4 py-2.5 text-xs font-semibold text-[#315b4c] hover:bg-[#f4f7f4]"
        >
          Fill fictional sample details
        </button>
      )}
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
            value={connected ? verifiedEmail : candidate.email}
            readOnly={connected}
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
        <Field
          label="Relationship to me"
          hint={
            relationshipOptionsVerified
              ? undefined
              : "These options are provisional and have not been recently verified against EA’s form."
          }
        >
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
            label="How did you initially hear about this opportunity?"
            hint="Only the confirmed source option is shown here."
          >
            <div
              className={`${inputClass} flex items-center text-sm text-[#52645d]`}
            >
              EA&apos;s Public Career Page
            </div>
          </Field>
        </div>
      </div>
      <ActionRow back={onBack} next={onNext} />
    </div>
  );
}
function ResumeStep({
  useSample,
  setUseSample,
  localResume,
  onChoose,
  badFields,
  onBack,
  onNext,
  connected,
  readiness,
  uploading,
}: {
  useSample: boolean;
  setUseSample: (value: boolean) => void;
  localResume: LocalFile | null;
  onChoose: (event: ChangeEvent<HTMLInputElement>) => void;
  badFields: string[];
  onBack: () => void;
  onNext: () => void;
  connected: boolean;
  readiness: {
    ready: boolean;
    missingFields: string[];
    parserStatus: string;
  } | null;
  uploading: boolean;
}) {
  const [showCorrection, setShowCorrection] = useState(false);
  return (
    <div>
      <p className="text-sm leading-6 text-[#607168]">
        We need to be able to read your first name, last name, email, and phone
        from the resume itself. Typing those details above does not replace them
        in the document.
      </p>
      <div className="mt-5 space-y-3">
        {!connected && (
          <button
            type="button"
            onClick={() => {
              setUseSample(true);
            }}
            className={`w-full rounded-xl border p-4 text-left ${useSample ? "border-[#54826e] bg-[#edf5ef] ring-1 ring-[#54826e]" : "border-[#dce3dd] hover:border-[#a9beb1]"}`}
          >
            <span className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#304d41]">
                Use fictional sample resume
              </span>
              <span className="text-xs font-semibold text-[#55776a]">
                DEMO ONLY
              </span>
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#77857e]">
              Alex Rivera · sample file with all four text fields already
              readable
            </span>
          </button>
        )}
        <label className="block cursor-pointer rounded-xl border border-dashed border-[#b9c9bf] p-4 transition hover:bg-[#f8faf8]">
          <span className="block text-sm font-semibold text-[#304d41]">
            Choose a resume file from this device
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#77857e]">
            {connected
              ? "PDF or DOCX · up to 4 MiB · uploaded for a secure scan and text check"
              : "PDF or DOCX · Local preview only, up to 10 MiB"}
          </span>
          <input
            className="mt-3 block w-full text-sm text-[#607168] file:mr-3 file:rounded-full file:border-0 file:bg-[#eaf1eb] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#315b4c]"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onChoose}
          />
        </label>
      </div>
      {!connected && (
        <button
          type="button"
          onClick={() => {
            setUseSample(false);
            setShowCorrection((current) => !current);
          }}
          className="mt-4 text-xs font-semibold text-[#315b4c] underline decoration-[#a8b6af] underline-offset-4"
          aria-expanded={showCorrection}
        >
          Preview a resume correction example
        </button>
      )}
      {!connected && showCorrection && (
        <div className="mt-3 rounded-xl border border-[#efdfbe] bg-[#fbf5e8] p-4 text-sm leading-6 text-[#735b2c]">
          <p className="font-semibold">
            Fictional example: phone number needs correction
          </p>
          <p className="mt-1">
            The sample reader found a first name, last name, and email, but
            could not clearly read a phone number. Add the number as selectable
            text near your contact details, then upload the updated resume. A
            typed phone field alone would not clear this check.
          </p>
          <button
            type="button"
            onClick={() => {
              setUseSample(true);
              setShowCorrection(false);
            }}
            className="mt-3 min-h-10 rounded-full bg-[#173d32] px-4 text-xs font-semibold text-white"
          >
            Use the fictional corrected resume
          </button>
        </div>
      )}
      {connected ? (
        localResume && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm leading-6 ${readiness?.ready ? "border border-[#d6e5dc] bg-[#eef5f0] text-[#466558]" : "border border-[#efdfbe] bg-[#fbf5e8] text-[#735b2c]"}`}
          >
            {uploading
              ? "Uploading and checking the resume…"
              : readiness?.ready
                ? `${localResume.name} is ready. The server found readable contact fields in the document.`
                : readiness?.parserStatus === "quarantined"
                  ? `${localResume.name} is quarantined pending a clean scan.`
                  : readiness
                    ? `The document needs readable ${readiness.missingFields.join(", ") || "contact fields"}. Update the file and upload it again.`
                    : "Waiting for the server resume check."}
          </p>
        )
      ) : useSample ? (
        <p className="mt-4 rounded-xl border border-[#d6e5dc] bg-[#eef5f0] px-4 py-3 text-sm text-[#466558]">
          Sample ready: Alex Rivera · sample_resume.pdf · Name, email and phone
          are readable in this fictional example.
        </p>
      ) : (
        localResume && (
          <div className="mt-4 rounded-xl border border-[#efdfbe] bg-[#fbf5e8] px-4 py-3 text-sm leading-6 text-[#735b2c]">
            Selected locally: <strong>{localResume.name}</strong>. No file was
            uploaded. Text extraction is unavailable, so readiness is unknown. A
            production flow would ask for a corrected file if required fields
            could not be read.
          </div>
        )
      )}
      {!connected && !useSample && badFields.length > 0 && (
        <p className="mt-3 text-xs leading-5 text-[#77857e]">
          Fields not parsed in this preview: {badFields.join(", ")}.
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
  onNext,
  connected,
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
  onNext: () => void;
  connected: boolean;
  uploading: boolean;
}) {
  return (
    <div>
      <p className="max-w-xl text-sm leading-6 text-[#607168]">
        Your resume is all I need. If you have a project or something else that
        shows why you’re a good fit, you can add it here.
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
        <div className="mt-6 space-y-5 border-t border-[#edf0ed] pt-5">
          <Field
            label="What would you like me to know?"
            hint="Optional · up to 500 characters"
          >
            <textarea
              className={`${inputClass} min-h-32 resize-y py-3`}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="A project, your contribution, or a result you’re proud of…"
            />
            <span className="mt-1 block text-right text-xs text-[#77857e]">
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
            hint={
              connected
                ? "Optional · PDF or DOCX · each file up to 4 MiB, total up to 10 MiB"
                : "Optional · PDF, DOCX, TXT, or common image files · total maximum 10 MiB"
            }
          >
            <input
              className="block w-full text-sm text-[#607168] file:mr-3 file:rounded-full file:border-0 file:bg-[#eaf1eb] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#315b4c]"
              type="file"
              multiple
              accept={
                connected
                  ? ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : ".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              }
              onChange={onChoose}
            />
          </Field>
          {connected && uploading && (
            <p className="text-xs text-[#607168]" role="status">
              Uploading and checking selected files…
            </p>
          )}
          <div className="rounded-xl bg-[#f5f7f4] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#52645d]">
                Supporting files selected
              </span>
              <span
                className={
                  total > MAX_EXTRAS
                    ? "font-semibold text-red-700"
                    : "text-[#6f7d75]"
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
                    className="flex items-center justify-between gap-3 text-xs text-[#65746b]"
                  >
                    <span className="truncate">
                      {file.name} · {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="shrink-0 font-semibold text-[#55776a] underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#77857e]">No files chosen.</p>
            )}
          </div>
        </div>
      )}
      <ActionRow back={onBack} next={onNext} />
    </div>
  );
}
function ReviewStep({
  candidate,
  answers,
  job,
  useSample,
  choice,
  note,
  links,
  files,
  heardFrom,
  onBack,
  onSubmit,
  connected,
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
  useSample: boolean;
  choice: "yes" | "no" | "";
  note: string;
  links: string;
  files: LocalFile[];
  heardFrom: string;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  connected: boolean;
  resumeFileName: string;
}) {
  return (
    <form onSubmit={onSubmit}>
      {!connected && (
        <DemoNotice>
          Review only. Submitting creates a fictional application in this
          browser demo; it does not upload your file or send an email.
        </DemoNotice>
      )}
      <div className="mt-5 divide-y divide-[#edf0ed]">
        <ReviewRow
          label="Role"
          value={`${job.title} · ${job.canonicalJobId}`}
        />
        <ReviewRow
          label="Eligibility"
          value={`Not previously applied: ${answers.previouslyApplied ? "No" : "Yes"} · Not previously referred: ${answers.previouslyReferred ? "No" : "Yes"} · Location: ${answers.inListedLocation ? "Yes" : "No"}`}
        />
        <ReviewRow
          label="Name and email"
          value={`${candidate.firstName || "—"} ${candidate.lastName} · ${candidate.email || "—"}`}
        />
        <ReviewRow
          label="Resume"
          value={
            connected
              ? `${resumeFileName || "Uploaded resume"} · server checked and ready`
              : useSample
                ? "Fictional sample resume · local readiness example"
                : "No parsed resume"
          }
        />
        <ReviewRow label="Heard about role" value={heardFrom} />
        <ReviewRow
          label="Optional showcase"
          value={
            choice === "yes"
              ? `${note ? `${note.length} character note` : "No note"} · ${links.split(/[\n,]/).filter(Boolean).length} links · ${files.length} ${connected ? "uploaded files" : "local files"}`
              : "Skipped"
          }
        />
      </div>
      <p className="mt-5 text-xs leading-5 text-[#77857e]">
        I understand that a referral is not guaranteed and that this request
        will be reviewed by the employee who shared the link.
        {connected
          ? " My uploaded resume and contact details will be stored for review."
          : " In this demo, no real data is submitted."}
      </p>
      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#edf0ed] pt-5 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-full px-5 text-sm font-semibold text-[#607168] hover:bg-[#f4f7f4]"
        >
          Back
        </button>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-[#173d32] px-6 text-sm font-semibold text-white transition hover:bg-[#245445]"
        >
          {connected ? "Submit request" : "Submit demo request"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-[#77857e]">{label}</dt>
      <dd className="text-sm text-[#304d41]">{value}</dd>
    </div>
  );
}
function CompleteStep({
  submittedId,
  connected,
}: {
  submittedId: string;
  connected: boolean;
}) {
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-full bg-[#e7f1e9] text-xl text-[#3e705b]">
        ✓
      </span>
      <p className="mt-5 text-sm leading-6 text-[#607168]">
        {connected
          ? "Your request has been submitted for review. You have not applied to EA, and no referral has been submitted."
          : "The fictional request has been added to this browser demo workspace. You have not applied to EA, and no referral was submitted."}
      </p>
      <div className="mt-5 rounded-xl bg-[#f5f7f4] p-4 text-sm">
        <span className="text-xs text-[#77857e]">
          {connected ? "REQUEST RECEIPT" : "DEMO RECEIPT"}
        </span>
        <p className="mt-1 font-mono text-[#315b4c]">{submittedId}</p>
      </div>
      {!connected && (
        <DemoNotice>
          This demo cannot verify email or send a status link. No email was
          sent. In a real service, a private link would be sent after
          submission.
        </DemoNotice>
      )}
      <Link
        href="/status"
        className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#cbd8d1] px-5 text-sm font-semibold text-[#315b4c]"
      >
        Visit the private status page
      </Link>
    </div>
  );
}
function StoppedStep({ reason }: { reason: StopReason }) {
  const messages: Record<StopReason, { title: string; body: string }> = {
    already_applied: {
      title: "You’ve already applied for this role.",
      body: "The sample policy asks people who have already applied for this role to stop here. This demo rule is based on an example EA notice, not a statement of every current EA policy.",
    },
    already_referred: {
      title: "You’ve already been referred for this role.",
      body: "The sample policy asks people who have already been referred for this role to stop here. This demo rule is based on an example EA notice, not a statement of every current EA policy.",
    },
    eligibility_review: {
      title: "This needs an owner check.",
      body: "You selected “I’m not sure” for a prior application or referral. This demo cannot verify your eligibility, so please ask the employee who shared the link before sending personal information.",
    },
    known_person: {
      title: "We know each other!",
      body: "No need to fill this form. Just message me directly and I’ll take a look. This does not reserve a slot or promise a referral.",
    },
    location_review: {
      title: "This needs an owner check.",
      body: "The role locations may not match your location. The demo has no policy configured for this case, so this is not an automatic rejection. Please ask the employee who shared the link before sending personal information.",
    },
  };
  return (
    <div>
      <span className="grid size-12 place-items-center rounded-full bg-[#fbf1df] text-xl text-[#8a6d33]">
        i
      </span>
      <h2 className="mt-5 text-xl font-semibold text-[#264b3e]">
        {messages[reason].title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#607168]">
        {messages[reason].body}
      </p>
      {reason === "known_person" && (
        <p className="mt-3 text-sm leading-6 text-[#607168]">
          No resume or contact information was requested or saved.
        </p>
      )}
      {!["location_review", "eligibility_review"].includes(reason) && (
        <a
          href="https://www.linkedin.com/"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#cbd8d1] px-5 text-sm font-semibold text-[#315b4c]"
        >
          Open LinkedIn ↗
        </a>
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
