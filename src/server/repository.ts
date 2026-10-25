import type {
  ActivityEvent,
  Application,
  ApplicationStatus,
  Candidate,
  CreateApplicationInput,
  CreateJobInput,
  EligibilityAnswers,
  FunnelMetrics,
  Job,
  ReferralSlot,
  UpdateApplicationInput,
  UpdateJobInput,
} from "@/lib/demo/types";

export type WorkspaceSnapshot = {
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  activity: ActivityEvent[];
  slots: ReferralSlot[];
  funnelMetrics: FunnelMetrics;
};
export type FunnelEvent =
  "candidate_role_view" | "intake_started" | "quick_checks_passed";
export type CandidateStatusSummary = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  submittedAt: string;
  jobTitle: string;
  eligibility?: EligibilityAnswers;
};
export type VerifiedApplicationInput = CreateApplicationInput & {
  resumeId: string;
  supportingFileIds?: string[];
};

export type ResumeRecordInput = {
  authUserId: string;
  jobId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  version: number;
  parserStatus:
    "pending" | "ready" | "correction_required" | "unavailable" | "failed";
  parsedFields: Record<string, boolean>;
  scanStatus: "quarantined" | "clean" | "rejected";
};
export type SupportingFileRecordInput = Omit<
  ResumeRecordInput,
  "jobId" | "version" | "parserStatus" | "parsedFields"
>;
export type ResumeRecord = ResumeRecordInput & {
  id: string;
  createdAt: string;
};
export type SupportingFileRecord = SupportingFileRecordInput & {
  id: string;
  createdAt: string;
};
export type DeletionRequestSummary = {
  id: string;
  requestedAt: string;
  status: "pending" | "completed" | "rejected";
  completedAt: string | null;
};

export type NotificationOutboxEntry = {
  id: string;
  idempotencyKey: string;
  status: "pending" | "sending" | "sent" | "failed" | "cancelled";
  payload: Record<string, unknown>;
};

export type NewNotificationOutboxEntry = {
  idempotencyKey: string;
  recipientEmail: string;
  template: "referral_confirmed" | "slot_filled_other";
  payload: Record<string, unknown>;
};

export type AssessmentAuditInput = {
  actorId: string;
  jobId: string;
  applicationId: string;
  modelId: string;
  promptVersion: string;
  schemaVersion: string;
  evidenceCoveragePercent: number;
};

export interface ReferralRepository {
  createResume(input: ResumeRecordInput): Promise<ResumeRecord>;
  getResumeForOwner(
    id: string,
    authUserId: string,
  ): Promise<ResumeRecord | null>;
  getResumeById(id: string): Promise<ResumeRecord | null>;
  updateResumeValidation(
    id: string,
    authUserId: string,
    patch: Pick<
      ResumeRecordInput,
      "parserStatus" | "parsedFields" | "scanStatus"
    >,
  ): Promise<ResumeRecord>;
  createStagedSupportFile(
    input: SupportingFileRecordInput,
  ): Promise<SupportingFileRecord>;
  getStagedSupportFilesForOwner(
    ids: string[],
    authUserId: string,
  ): Promise<SupportingFileRecord[]>;
  getSupportingFileForOwner(
    id: string,
    authUserId: string,
  ): Promise<SupportingFileRecord | null>;
  getSupportingFileById(id: string): Promise<SupportingFileRecord | null>;
  requestCandidateDeletion(
    authUserId: string,
  ): Promise<Pick<DeletionRequestSummary, "id" | "requestedAt" | "status">>;
  listDeletionRequests(): Promise<DeletionRequestSummary[]>;
  deleteCandidateStorage(requestId: string): Promise<void>;
  processCandidateDeletion(requestId: string, actorId: string): Promise<void>;
  listJobs(publicOnly?: boolean): Promise<Job[]>;
  getReferralSlot(jobId: string): Promise<ReferralSlot | null>;
  getJobById(id: string): Promise<Job | null>;
  getJobByCanonicalJobId(canonicalJobId: string): Promise<Job | null>;
  createJob(input: CreateJobInput, actorId: string): Promise<Job>;
  updateJob(id: string, input: UpdateJobInput, actorId: string): Promise<Job>;
  getWorkspace(): Promise<WorkspaceSnapshot>;
  getApplicationsForJob(jobId: string): Promise<Application[]>;
  getApplication(id: string): Promise<Application | null>;
  getApplicationForCandidateJob(
    jobId: string,
    candidateAuthUserId: string,
  ): Promise<Application | null>;
  createApplication(
    input: VerifiedApplicationInput,
    actorId: string,
  ): Promise<{ id: string; existing?: boolean }>;
  updateApplication(
    id: string,
    input: UpdateApplicationInput,
    actorId: string,
  ): Promise<Application>;
  recordAssessmentAudit(input: AssessmentAuditInput): Promise<void>;
  decideApplication(
    id: string,
    status: ApplicationStatus,
    adminNote: string | null,
    actorId: string,
  ): Promise<Application>;
  reserveReferral(
    jobId: string,
    applicationId: string,
    actorId: string,
  ): Promise<ReferralSlot>;
  releaseReferral(jobId: string, actorId: string): Promise<ReferralSlot>;
  confirmReferral(
    jobId: string,
    applicationId: string,
    actorId: string,
  ): Promise<ReferralSlot>;
  getCandidateStatus(
    applicationId: string,
    candidateAuthUserId: string,
  ): Promise<Pick<
    Application,
    "id" | "jobId" | "status" | "submittedAt"
  > | null>;
  listCandidateStatuses(
    candidateAuthUserId: string,
  ): Promise<CandidateStatusSummary[]>;
  recordFunnelEvent(
    event: FunnelEvent,
    jobId: string,
    candidateAuthUserId: string,
  ): Promise<void>;
  listNotificationOutbox(
    idempotencyKeys: string[],
  ): Promise<NotificationOutboxEntry[]>;
  enqueueNotifications(entries: NewNotificationOutboxEntry[]): Promise<void>;
  claimNotification(id: string): Promise<boolean>;
  updateNotificationStatus(
    id: string,
    status: "sent" | "failed",
  ): Promise<void>;
}
