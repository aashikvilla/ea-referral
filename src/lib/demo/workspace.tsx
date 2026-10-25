"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  demoActivity,
  demoApplications,
  demoCandidates,
  getDemoJobsForSession,
} from "@/lib/demo/fixtures";
import type {
  ActionResult,
  ActivityEvent,
  Application,
  ApplicationStatus,
  Candidate,
  CreateApplicationInput,
  CreateJobInput,
  Job,
  ReferralSlot,
  UpdateApplicationInput,
  UpdateJobInput,
  WorkspaceMode,
  WorkspaceSession,
} from "@/lib/demo/types";
import {
  canTransitionApplicationStatus,
  checkEligibility,
} from "@/lib/domain/eligibility";
import { getReferralSlot, isIntakeAvailable } from "@/lib/domain/slots";
import {
  hasDuplicateApplication,
  normalizeCanonicalJobId,
  validateApplicationInput,
  validateEaJobUrl,
} from "@/lib/domain/validation";

type WorkspaceData = {
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  activity: ActivityEvent[];
};
type SubmitResult = ActionResult & { applicationId?: string };
type WorkspaceSnapshot = {
  data: WorkspaceData;
  slots: ReferralSlot[];
  loading: boolean;
  error: string | null;
  session: WorkspaceSession;
};
type SessionPayload = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; email: string } | null;
  isAdmin: boolean;
};
type WorkspacePayload = WorkspaceData & { slots?: ReferralSlot[] };
type JobsPayload = { jobs: Job[]; slots?: ReferralSlot[] };
type WorkspaceStore = {
  getSnapshot(): WorkspaceSnapshot;
  getServerSnapshot(): WorkspaceSnapshot;
  subscribe(listener: () => void): () => void;
  publish(update: (snapshot: WorkspaceSnapshot) => WorkspaceSnapshot): void;
  loadConnected(): Promise<boolean>;
};

type WorkspaceContextValue = WorkspaceData & {
  mode: WorkspaceMode;
  loading: boolean;
  error: string | null;
  session: WorkspaceSession;
  slots: ReferralSlot[];
  refreshWorkspace(): Promise<boolean>;
  addJob(input: CreateJobInput): Promise<ActionResult>;
  updateJob(id: string, patch: UpdateJobInput): Promise<ActionResult>;
  updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
  ): Promise<ActionResult>;
  updateApplication(
    id: string,
    patch: UpdateApplicationInput,
  ): Promise<ActionResult>;
  reserveReferral(jobId: string, applicationId: string): Promise<ActionResult>;
  releaseReferral(jobId: string): Promise<ActionResult>;
  confirmReferral(jobId: string, applicationId: string): Promise<ActionResult>;
  submitApplication(input: CreateApplicationInput): Promise<SubmitResult>;
  resetDemo(): void;
};

const initialData = (availabilityCheckedAt: string): WorkspaceData => ({
  jobs: getDemoJobsForSession(availabilityCheckedAt),
  candidates: demoCandidates,
  applications: demoApplications,
  activity: demoActivity,
});
const emptyData = (): WorkspaceData => ({
  jobs: [],
  candidates: [],
  applications: [],
  activity: [],
});
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const topLevelMessage =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : null;
    const nestedError =
      body && typeof body === "object" && "error" in body ? body.error : null;
    const nestedMessage =
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof nestedError.message === "string"
        ? nestedError.message
        : null;
    const message =
      topLevelMessage ??
      nestedMessage ??
      `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

function publicSlots(jobs: Job[]): ReferralSlot[] {
  return jobs.map((job) => ({
    jobId: job.id,
    status:
      job.status === "referred"
        ? "confirmed"
        : job.status === "paused"
          ? "reserved"
          : "available",
    updatedAt: job.updatedAt,
  }));
}

function createWorkspaceStore(
  mode: WorkspaceMode,
  demoReferenceTime: string,
): WorkspaceStore {
  const initial: WorkspaceSnapshot = {
    data: mode === "demo" ? initialData(demoReferenceTime) : emptyData(),
    slots: [],
    loading: mode === "connected",
    error: null,
    session: null,
  };
  let snapshot = initial;
  let requestVersion = 0;
  const listeners = new Set<() => void>();
  const publish: WorkspaceStore["publish"] = (update) => {
    snapshot = update(snapshot);
    for (const listener of listeners) listener();
  };
  const subscribe: WorkspaceStore["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const loadConnected = async (): Promise<boolean> => {
    if (mode !== "connected") return true;
    const requestId = ++requestVersion;
    publish((current) => ({ ...current, loading: true, error: null }));
    let verifiedSession: WorkspaceSession = null;
    try {
      const sessionResponse = await fetch("/api/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const sessionPayload = await readJson<SessionPayload>(sessionResponse);
      if (!sessionPayload.configured)
        throw new Error("Connected services are not configured.");
      verifiedSession = {
        user: sessionPayload.authenticated ? sessionPayload.user : null,
        isAdmin: sessionPayload.authenticated && sessionPayload.isAdmin,
      };
      if (verifiedSession.isAdmin) {
        const response = await fetch("/api/admin/workspace", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await readJson<WorkspacePayload>(response);
        if (
          !Array.isArray(payload.jobs) ||
          !Array.isArray(payload.candidates) ||
          !Array.isArray(payload.applications) ||
          !Array.isArray(payload.activity)
        )
          throw new Error(
            "The connected workspace returned an invalid snapshot.",
          );
        if (requestId !== requestVersion) return false;
        const data: WorkspaceData = {
          jobs: payload.jobs,
          candidates: payload.candidates,
          applications: payload.applications,
          activity: payload.activity,
        };
        publish((current) => ({
          ...current,
          data,
          slots:
            payload.slots ??
            payload.jobs.map((job) =>
              getReferralSlot(job, payload.applications),
            ),
          session: verifiedSession,
          error: null,
        }));
      } else {
        const response = await fetch("/api/jobs", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await readJson<JobsPayload>(response);
        if (!Array.isArray(payload.jobs))
          throw new Error(
            "The public job service returned an invalid response.",
          );
        if (requestId !== requestVersion) return false;
        publish((current) => ({
          ...current,
          data: { ...emptyData(), jobs: payload.jobs },
          slots: payload.slots ?? publicSlots(payload.jobs),
          session: verifiedSession,
          error: null,
        }));
      }
      return true;
    } catch (cause) {
      if (requestId !== requestVersion) return false;
      const message =
        cause instanceof Error
          ? cause.message
          : "The connected workspace could not be loaded.";
      publish((current) => ({
        ...current,
        data: emptyData(),
        slots: [],
        session: verifiedSession,
        error: message,
      }));
      return false;
    } finally {
      if (requestId === requestVersion)
        publish((current) => ({ ...current, loading: false }));
    }
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe,
    publish,
    loadConnected,
  };
}

export function DemoWorkspaceProvider({
  children,
  mode = "demo",
  demoReferenceTime,
}: {
  children: React.ReactNode;
  mode?: WorkspaceMode;
  demoReferenceTime: string;
}) {
  const [store] = useState(() => createWorkspaceStore(mode, demoReferenceTime));
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const { data, loading, error, session } = snapshot;

  useEffect(() => {
    if (mode === "connected") void store.loadConnected();
  }, [mode, store]);

  function commit(update: (current: WorkspaceData) => WorkspaceData) {
    store.publish((current) => ({ ...current, data: update(current.data) }));
  }

  function addActivity(
    label: string,
    detail: string,
    tone: ActivityEvent["tone"],
    jobId?: string,
    applicationId?: string,
  ) {
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label,
      detail,
      tone,
      jobId,
      applicationId,
    };
    commit((current) => ({
      ...current,
      activity: [event, ...current.activity],
    }));
  }

  async function connectedMutation(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
  ): Promise<ActionResult & { applicationId?: string }> {
    if (mode !== "connected")
      return { ok: false, message: "Connected services are not active." };
    const current = store.getSnapshot();
    if (current.loading)
      return {
        ok: false,
        message: "Wait for the connected workspace to finish loading.",
      };
    if (current.error)
      return { ok: false, message: "The connected workspace is unavailable." };
    try {
      const response = await fetch(path, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readJson<ActionResult & { applicationId?: string }>(
        response,
      );
      if (!result.ok) return result;
      const refreshed = await store.loadConnected();
      return refreshed
        ? result
        : {
            ...result,
            message: `${result.message} The workspace refresh failed; reload before continuing.`,
          };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "The connected action failed.";
      store.publish((state) => ({ ...state, error: message }));
      return { ok: false, message };
    }
  }

  async function addJob(input: CreateJobInput): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation("/api/admin/jobs", "POST", input);
    const current = store.getSnapshot().data;
    const canonicalJobId = normalizeCanonicalJobId(input.canonicalJobId);
    if (!canonicalJobId)
      return {
        ok: false,
        message: "Enter a numeric EA job ID or an official EA careers job URL.",
      };
    if (!validateEaJobUrl(input.officialUrl))
      return { ok: false, message: "Use an official EA careers job URL." };
    if (current.jobs.some((job) => job.canonicalJobId === canonicalJobId))
      return {
        ok: false,
        message: "A job with this EA job ID already exists in the demo.",
      };
    const now = new Date().toISOString();
    const job: Job = {
      ...input,
      id: `job-${crypto.randomUUID()}`,
      canonicalJobId,
      status: "draft",
      availability: "unknown",
      availabilityCheckedAt: null,
      availabilitySource: "unknown",
      createdAt: now,
      updatedAt: now,
    };
    commit((state) => ({ ...state, jobs: [job, ...state.jobs] }));
    addActivity(
      "Job added",
      `${job.title} was added to the demo workspace.`,
      "neutral",
      job.id,
    );
    return { ok: true, message: "Job added to this tab's demo workspace." };
  }

  async function updateJob(
    id: string,
    patch: UpdateJobInput,
  ): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation(
        `/api/admin/jobs/${encodeURIComponent(id)}`,
        "PATCH",
        patch,
      );
    const current = store.getSnapshot().data;
    const existingJob = current.jobs.find((job) => job.id === id);
    if (!existingJob)
      return { ok: false, message: "That demo job could not be found." };
    const slot = getReferralSlot(existingJob, current.applications);
    if (patch.status === "referred")
      return {
        ok: false,
        message: "Use the explicit confirm action to mark a demo referral.",
      };
    if (slot.status === "confirmed" && patch.status === "open")
      return {
        ok: false,
        message: "A confirmed demo referral keeps this job closed.",
      };
    if (slot.status === "reserved" && patch.status === "open")
      return {
        ok: false,
        message: "Release the demo reservation before reopening intake.",
      };
    if (
      patch.canonicalJobId &&
      current.applications.some((application) => application.jobId === id)
    )
      return {
        ok: false,
        message: "The job ID cannot change after demo requests exist.",
      };
    if (patch.canonicalJobId) {
      const canonicalJobId = normalizeCanonicalJobId(patch.canonicalJobId);
      if (!canonicalJobId)
        return {
          ok: false,
          message:
            "Enter a numeric EA job ID or an official EA careers job URL.",
        };
      if (
        current.jobs.some(
          (job) => job.id !== id && job.canonicalJobId === canonicalJobId,
        )
      )
        return {
          ok: false,
          message: "A job with this EA job ID already exists in the demo.",
        };
      patch = { ...patch, canonicalJobId };
    }
    if (patch.officialUrl && !validateEaJobUrl(patch.officialUrl))
      return { ok: false, message: "Use an official EA careers job URL." };
    const now = new Date().toISOString();
    if (patch.availability)
      patch = {
        ...patch,
        availabilityCheckedAt: patch.availability === "unknown" ? null : now,
        availabilitySource:
          patch.availability === "unknown" ? "unknown" : "manual",
      };
    commit((state) => ({
      ...state,
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, ...patch, updatedAt: now } : job,
      ),
    }));
    if (patch.status && patch.status !== existingJob.status)
      addActivity(
        "Job status changed",
        `${existingJob.title}: ${existingJob.status} → ${patch.status}.`,
        "neutral",
        id,
      );
    if (patch.availability && patch.availability !== existingJob.availability)
      addActivity(
        "Availability updated",
        `${existingJob.title}: manually marked ${patch.availability}${patch.availabilityCheckedAt ? ` at ${new Date(patch.availabilityCheckedAt).toLocaleString()}` : ""}.`,
        patch.availability === "closed" ? "warning" : "neutral",
        id,
      );
    return { ok: true, message: "Demo job updated in this tab's memory." };
  }

  async function updateApplication(
    id: string,
    patch: UpdateApplicationInput,
  ): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation(
        `/api/admin/applications/${encodeURIComponent(id)}`,
        "PATCH",
        patch,
      );
    const current = store.getSnapshot().data;
    const existing = current.applications.find(
      (application) => application.id === id,
    );
    if (!existing)
      return { ok: false, message: "That demo request could not be found." };
    if (
      patch.status &&
      !canTransitionApplicationStatus(existing.status, patch.status)
    )
      return {
        ok: false,
        message:
          "Use the dedicated reserve or confirm action for this status change.",
      };
    commit((state) => ({
      ...state,
      applications: state.applications.map((application) =>
        application.id === id
          ? patch.status === "correction_required"
            ? {
                ...application,
                ...patch,
                resumeReady: false,
                correctionFields: [
                  "resume",
                  "firstName",
                  "lastName",
                  "email",
                  "phone",
                ],
                matchScore: 0,
                match: {
                  mandatory: 0,
                  relevantWork: 0,
                  preferred: 0,
                  achievements: 0,
                },
                matchSummary:
                  "Owner requested a corrected resume; previous assessment is stale.",
                evidence: [],
                requirements: [],
              }
            : { ...application, ...patch }
          : application,
      ),
    }));
    return { ok: true, message: "Demo request updated in this tab's memory." };
  }

  async function updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
  ): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation(
        `/api/admin/applications/${encodeURIComponent(id)}/decision`,
        "POST",
        { status },
      );
    const result = await updateApplication(id, { status });
    if (result.ok)
      addActivity(
        "Status updated",
        `A demo request moved to ${status.replaceAll("_", " ")}.`,
        "neutral",
        undefined,
        id,
      );
    return result;
  }

  async function reserveReferral(
    jobId: string,
    applicationId: string,
  ): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation("/api/admin/referrals/reserve", "POST", {
        jobId,
        applicationId,
      });
    const current = store.getSnapshot().data;
    const job = current.jobs.find((item) => item.id === jobId);
    const application = current.applications.find(
      (item) => item.id === applicationId && item.jobId === jobId,
    );
    if (!job || !application)
      return { ok: false, message: "Choose a valid demo job and request." };
    if (!isIntakeAvailable(job, current.applications))
      return {
        ok: false,
        message:
          "This demo job already has a reserved or confirmed referral slot.",
      };
    if (
      !["ready_for_review", "shortlisted"].includes(application.status) ||
      !application.resumeReady ||
      checkEligibility(job, application.eligibility) !== "eligible"
    )
      return {
        ok: false,
        message:
          "This request is not eligible and ready to reserve in the demo.",
      };
    commit((state) => ({
      ...state,
      jobs: state.jobs.map((item) =>
        item.id === jobId
          ? { ...item, status: "paused", updatedAt: new Date().toISOString() }
          : item,
      ),
      applications: state.applications.map((item) =>
        item.id === applicationId
          ? { ...item, status: "selected_pending_submission" }
          : item,
      ),
    }));
    addActivity(
      "Slot reserved",
      "Intake is paused while the owner completes manual steps.",
      "warning",
      jobId,
      applicationId,
    );
    return {
      ok: true,
      message: "Demo slot reserved. No EA portal action was performed.",
    };
  }

  async function releaseReferral(jobId: string): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation("/api/admin/referrals/release", "POST", {
        jobId,
      });
    const current = store.getSnapshot().data;
    const application = current.applications.find(
      (item) =>
        item.jobId === jobId && item.status === "selected_pending_submission",
    );
    if (!application)
      return {
        ok: false,
        message: "There is no reserved demo slot to release.",
      };
    commit((state) => ({
      ...state,
      jobs: state.jobs.map((item) =>
        item.id === jobId
          ? { ...item, status: "open", updatedAt: new Date().toISOString() }
          : item,
      ),
      applications: state.applications.map((item) =>
        item.id === application.id
          ? { ...item, status: "ready_for_review" }
          : item,
      ),
    }));
    addActivity(
      "Reservation released",
      "The demo intake slot is available again.",
      "neutral",
      jobId,
      application.id,
    );
    return { ok: true, message: "Demo reservation released." };
  }

  async function confirmReferral(
    jobId: string,
    applicationId: string,
  ): Promise<ActionResult> {
    if (mode === "connected")
      return connectedMutation("/api/admin/referrals/confirm", "POST", {
        jobId,
        applicationId,
      });
    const current = store.getSnapshot().data;
    const job = current.jobs.find((item) => item.id === jobId);
    const application = current.applications.find(
      (item) => item.id === applicationId && item.jobId === jobId,
    );
    if (
      !job ||
      !application ||
      application.status !== "selected_pending_submission"
    )
      return {
        ok: false,
        message: "Reserve this demo slot before confirming it.",
      };
    commit((state) => ({
      ...state,
      jobs: state.jobs.map((item) =>
        item.id === jobId
          ? { ...item, status: "referred", updatedAt: new Date().toISOString() }
          : item,
      ),
      applications: state.applications.map((item) =>
        item.jobId !== jobId
          ? item
          : item.id === applicationId
            ? { ...item, status: "referral_confirmed" }
            : ["ready_for_review", "shortlisted"].includes(item.status)
              ? { ...item, status: "slot_filled_other" }
              : item,
      ),
    }));
    addActivity(
      "Referral marked confirmed",
      "The owner recorded a manual confirmation in this demo.",
      "positive",
      jobId,
      applicationId,
    );
    return {
      ok: true,
      message:
        "Marked as manually submitted in the demo. No EA portal action or email was performed.",
    };
  }

  async function submitApplication(
    input: CreateApplicationInput,
  ): Promise<SubmitResult> {
    if (mode === "connected")
      return connectedMutation("/api/applications", "POST", input);
    const current = store.getSnapshot().data;
    const validationError = validateApplicationInput(input);
    if (validationError) return { ok: false, message: validationError };
    const job = current.jobs.find((item) => item.id === input.jobId);
    if (!job || !isIntakeAvailable(job, current.applications))
      return {
        ok: false,
        message: "This demo intake is currently unavailable.",
      };
    if (
      hasDuplicateApplication(
        job.id,
        input.candidate.email,
        current.applications,
        current.candidates,
      )
    )
      return {
        ok: false,
        message:
          "A request from this email is already in the demo for this job.",
      };
    if (checkEligibility(job, input.eligibility) !== "eligible")
      return {
        ok: false,
        message:
          "This sample flow needs an owner review before it can be submitted.",
      };
    const candidateId = `candidate-${crypto.randomUUID()}`;
    const applicationId = `app-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const candidate: Candidate = {
      ...input.candidate,
      id: candidateId,
      relationship: input.relationship,
    };
    const application: Application = {
      id: applicationId,
      jobId: job.id,
      candidateId,
      status: "submitted",
      submittedAt: now,
      eligibility: input.eligibility,
      resumeReady: Object.values(input.resume.fields).every(Boolean),
      resumeFields: input.resume.fields,
      resume: {
        fileName: input.resume.fileName,
        fileSize: input.resume.fileSize,
        fileType: input.resume.fileType,
        version: 1,
        uploadedAt: now,
      },
      correctionFields: Object.entries(input.resume.fields)
        .filter(([, ready]) => !ready)
        .map(([field]) => field),
      matchScore: 0,
      match: { mandatory: 0, relevantWork: 0, preferred: 0, achievements: 0 },
      matchSummary: "Not assessed in the demo.",
      evidence: [],
      requirements: [],
      showcase: {
        note: input.showcase?.note ?? "",
        links: input.showcase?.links ?? [],
        files: input.showcase?.files ?? [],
      },
      note: input.showcase?.note,
      projectLinks: input.showcase?.links ?? [],
    };
    commit((state) => ({
      ...state,
      candidates: [candidate, ...state.candidates],
      applications: [application, ...state.applications],
      activity: [
        {
          id: `event-${crypto.randomUUID()}`,
          at: now,
          label: "Sample request submitted",
          detail: "A request was added to this tab's memory only.",
          tone: "neutral",
          jobId: job.id,
          applicationId,
        },
        ...state.activity,
      ],
    }));
    return {
      ok: true,
      message:
        "Sample request saved in this tab's memory only. No email was sent and no file was uploaded.",
      applicationId,
    };
  }

  function resetDemo() {
    if (mode !== "demo") return;
    commit(() => initialData(new Date().toISOString()));
  }

  const projectedSlots = data.jobs.map((job) => {
    const confirmed = data.applications.find(
      (application) =>
        application.jobId === job.id &&
        application.status === "referral_confirmed",
    );
    const reserved = data.applications.find(
      (application) =>
        application.jobId === job.id &&
        application.status === "selected_pending_submission",
    );
    return confirmed
      ? {
          jobId: job.id,
          status: "confirmed" as const,
          applicationId: confirmed.id,
          updatedAt: confirmed.submittedAt,
        }
      : reserved
        ? {
            jobId: job.id,
            status: "reserved" as const,
            applicationId: reserved.id,
            updatedAt: reserved.submittedAt,
          }
        : {
            jobId: job.id,
            status: "available" as const,
            updatedAt: job.updatedAt,
          };
  });
  const slots = mode === "connected" ? snapshot.slots : projectedSlots;
  const value: WorkspaceContextValue = {
    ...data,
    mode,
    loading,
    error,
    session,
    slots,
    refreshWorkspace: store.loadConnected,
    addJob,
    updateJob,
    updateApplicationStatus,
    updateApplication,
    reserveReferral,
    releaseReferral,
    confirmReferral,
    submitApplication,
    resetDemo,
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used within DemoWorkspaceProvider.");
  return context;
}
