"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ActionResult,
  ActivityEvent,
  Application,
  ApplicationStatus,
  Candidate,
  CreateApplicationInput,
  CreateJobInput,
  FunnelMetrics,
  Job,
  ReferralSlot,
  UpdateApplicationInput,
  UpdateJobInput,
  WorkspaceSession,
} from "@/lib/domain/types";

type WorkspaceData = {
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  activity: ActivityEvent[];
  funnelMetrics: FunnelMetrics;
};
type WorkspaceSnapshot = {
  data: WorkspaceData;
  slots: ReferralSlot[];
  loading: boolean;
  error: string | null;
  session: WorkspaceSession;
};
type SubmitResult = ActionResult & { applicationId?: string };
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
  load(): Promise<boolean>;
};

type WorkspaceContextValue = WorkspaceData & {
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
};

const EMPTY_FUNNEL_METRICS: FunnelMetrics = {
  verifiedRoleVisits: 0,
  intakeStarts: 0,
  quickChecksPassed: 0,
  requestsSubmitted: 0,
  referralsConfirmed: 0,
};

const emptyData = (): WorkspaceData => ({
  jobs: [],
  candidates: [],
  applications: [],
  activity: [],
  funnelMetrics: EMPTY_FUNNEL_METRICS,
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
    throw new Error(
      topLevelMessage ??
        nestedMessage ??
        `Request failed (${response.status}).`,
    );
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

function createWorkspaceStore(): WorkspaceStore {
  const initial: WorkspaceSnapshot = {
    data: emptyData(),
    slots: [],
    loading: true,
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

  const load = async (): Promise<boolean> => {
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
        publish((current) => ({
          ...current,
          data: {
            jobs: payload.jobs,
            candidates: payload.candidates,
            applications: payload.applications,
            activity: payload.activity,
            funnelMetrics: payload.funnelMetrics ?? EMPTY_FUNNEL_METRICS,
          },
          slots: payload.slots ?? [],
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
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish,
    load,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createWorkspaceStore);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const { data, loading, error, session } = snapshot;

  useEffect(() => {
    void store.load();
  }, [store]);

  async function connectedMutation(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
  ): Promise<SubmitResult> {
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
      const result = await readJson<SubmitResult>(response);
      if (!result.ok) return result;
      const refreshed = await store.load();
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

  const addJob = (input: CreateJobInput) =>
    connectedMutation("/api/admin/jobs", "POST", input);
  const updateJob = (id: string, patch: UpdateJobInput) =>
    connectedMutation(
      `/api/admin/jobs/${encodeURIComponent(id)}`,
      "PATCH",
      patch,
    );
  const updateApplication = (id: string, patch: UpdateApplicationInput) =>
    connectedMutation(
      `/api/admin/applications/${encodeURIComponent(id)}`,
      "PATCH",
      patch,
    );
  const updateApplicationStatus = (id: string, status: ApplicationStatus) =>
    connectedMutation(
      `/api/admin/applications/${encodeURIComponent(id)}/decision`,
      "POST",
      { status },
    );
  const reserveReferral = (jobId: string, applicationId: string) =>
    connectedMutation("/api/admin/referrals/reserve", "POST", {
      jobId,
      applicationId,
    });
  const releaseReferral = (jobId: string) =>
    connectedMutation("/api/admin/referrals/release", "POST", { jobId });
  const confirmReferral = (jobId: string, applicationId: string) =>
    connectedMutation("/api/admin/referrals/confirm", "POST", {
      jobId,
      applicationId,
    });
  const submitApplication = (input: CreateApplicationInput) =>
    connectedMutation("/api/applications", "POST", input);

  const value: WorkspaceContextValue = {
    ...data,
    loading,
    error,
    session,
    slots: snapshot.slots,
    refreshWorkspace: store.load,
    addJob,
    updateJob,
    updateApplicationStatus,
    updateApplication,
    reserveReferral,
    releaseReferral,
    confirmReferral,
    submitApplication,
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
    throw new Error("useWorkspace must be used within WorkspaceProvider.");
  return context;
}
