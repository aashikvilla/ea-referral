import type {
  ActivityEvent,
  Application,
  ApplicationStatus,
  Candidate,
  CreateJobInput,
  Job,
  ReferralSlot,
  UpdateApplicationInput,
  UpdateJobInput,
} from "@/lib/demo/types";
import "server-only";
import { requireServerConfig } from "@/server/config";
import { ApiError } from "@/server/http";
import type {
  CandidateStatusSummary,
  DeletionRequestSummary,
  ReferralRepository,
  ResumeRecord,
  ResumeRecordInput,
  SupportingFileRecord,
  SupportingFileRecordInput,
  VerifiedApplicationInput,
  WorkspaceSnapshot,
} from "@/server/repository";

type Row = Record<string, unknown>;
const STATUS: readonly ApplicationStatus[] = [
  "submitted",
  "processing",
  "correction_required",
  "eligibility_review",
  "needs_clarification",
  "ready_for_review",
  "shortlisted",
  "selected_pending_submission",
  "referral_confirmed",
  "not_selected",
  "slot_filled_other",
];
const RELATIONSHIPS = [
  "current_ea_employee",
  "customer_client",
  "family_member",
  "former_colleague",
  "friend",
  "professional_network",
  "other",
] as const;

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const number = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const obj = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const bool = (value: unknown): boolean => value === true;
const boolOrNull = (value: unknown): boolean | null =>
  value === true || value === false ? value : null;

function toJob(row: Row): Job {
  return {
    id: text(row.id),
    canonicalJobId: text(row.canonical_job_id),
    title: text(row.title),
    team: text(row.team),
    location: text(row.location),
    locations: arr(row.locations).filter(
      (v): v is string => typeof v === "string",
    ),
    employmentType: text(row.employment_type),
    officialUrl: text(row.official_url),
    description: text(row.description),
    status: text(row.status, "draft") as Job["status"],
    availability: text(row.availability, "unknown") as Job["availability"],
    availabilityCheckedAt:
      typeof row.availability_checked_at === "string"
        ? row.availability_checked_at
        : null,
    availabilitySource: text(
      row.availability_source,
      "unknown",
    ) as Job["availabilitySource"],
    availabilityReason: text(row.availability_reason),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function toCandidate(row: Row): Candidate {
  return {
    id: text(row.id),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    email: text(row.email),
    phone: text(row.phone),
    country: text(row.country),
    currentTitle: text(row.current_title),
    currentCompany: text(row.current_company),
    relationship: text(row.relationship, "other") as Candidate["relationship"],
  };
}

function toApplication(row: Row): Application {
  const eligibility = obj(row.eligibility);
  const resume = obj(row.resume);
  const fields = obj(resume.fields);
  const showcase = obj(row.showcase);
  const match = obj(row.match);
  return {
    id: text(row.id),
    jobId: text(row.job_id),
    candidateId: text(row.candidate_id),
    status: text(row.status, "submitted") as ApplicationStatus,
    submittedAt: text(row.submitted_at),
    ...(typeof row.resume_id === "string" ? { resumeId: row.resume_id } : {}),
    eligibility: {
      previouslyApplied: boolOrNull(eligibility.previouslyApplied),
      previouslyReferred: boolOrNull(eligibility.previouslyReferred),
      knowsOwner: bool(eligibility.knowsOwner),
      inListedLocation: boolOrNull(eligibility.inListedLocation),
    },
    resumeReady: row.resume_ready === true,
    resumeFields: {
      firstName: bool(fields.firstName),
      lastName: bool(fields.lastName),
      email: bool(fields.email),
      phone: bool(fields.phone),
    },
    resume: {
      fileName: text(resume.fileName),
      fileSize: number(resume.fileSize),
      fileType: text(resume.fileType),
      version: number(resume.version, 1),
      uploadedAt: text(resume.uploadedAt),
    },
    correctionFields: arr(row.correction_fields).filter(
      (v): v is string => typeof v === "string",
    ),
    matchScore: number(row.match_score),
    match: {
      mandatory: number(match.mandatory),
      relevantWork: number(match.relevantWork),
      preferred: number(match.preferred),
      achievements: number(match.achievements),
    },
    matchSummary: text(
      row.match_summary,
      "Assessment unavailable; owner review required.",
    ),
    evidence: arr(row.evidence).filter(
      (v): v is string => typeof v === "string",
    ),
    requirements: arr(row.requirements) as Application["requirements"],
    showcase: {
      note: text(showcase.note),
      links: arr(showcase.links).filter(
        (v): v is string => typeof v === "string",
      ),
      files: arr(showcase.files).filter(
        (v): v is { id?: string; name: string; size: number; type?: string } =>
          !!v &&
          typeof v === "object" &&
          typeof (v as Row).name === "string" &&
          typeof (v as Row).size === "number",
      ),
    },
    note: typeof row.note === "string" ? row.note : undefined,
    fitNote: typeof row.fit_note === "string" ? row.fit_note : undefined,
    projectLinks: arr(showcase.links).filter(
      (v): v is string => typeof v === "string",
    ),
    adminNote: typeof row.admin_note === "string" ? row.admin_note : undefined,
  };
}

function queryValue(value: string): string {
  return encodeURIComponent(value);
}

export class SupabaseReferralRepository implements ReferralRepository {
  private readonly config = requireServerConfig();
  private readonly base = `${this.config.supabaseUrl}/rest/v1`;

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    try {
      const authHeaders: Record<string, string> = {
        apikey: this.config.secretKey,
        "Content-Type": "application/json",
      };
      // Opaque sb_secret keys are gateway credentials, not JWTs. Legacy
      // service_role keys remain valid JWTs for Authorization.
      if (!this.config.secretKey.startsWith("sb_secret_")) {
        authHeaders.Authorization = `Bearer ${this.config.secretKey}`;
      }
      const response = await fetch(`${this.base}/${path}`, {
        ...init,
        headers: { ...authHeaders, ...(init.headers ?? {}) },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const body = await response.text();
      let parsed: unknown = null;
      if (body) {
        try {
          parsed = JSON.parse(body) as unknown;
        } catch {
          parsed = null;
        }
      }
      if (!response.ok) {
        const providerCode = text(obj(parsed).code);
        const status =
          providerCode === "23505"
            ? 409
            : providerCode === "P0002"
              ? 404
              : providerCode === "22023"
                ? 400
                : 503;
        const code =
          status === 409
            ? "conflict"
            : status === 404
              ? "not_found"
              : status === 400
                ? "invalid_request"
                : "unavailable";
        const message =
          status === 409
            ? "The requested change conflicts with current referral data."
            : status === 404
              ? "The requested record was not found."
              : status === 400
                ? "The request violates a referral workflow rule."
                : "The data service is temporarily unavailable.";
        throw new ApiError(status, code, message);
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "unavailable",
        "The data service is temporarily unavailable.",
      );
    }
  }

  private async rows(path: string): Promise<Row[]> {
    const value = await this.request(path);
    return Array.isArray(value)
      ? value.filter((row): row is Row => !!row && typeof row === "object")
      : [];
  }

  private async rpc(name: string, args: Row): Promise<unknown> {
    return this.request(`rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  }

  async requestCandidateDeletion(
    authUserId: string,
  ): Promise<Pick<DeletionRequestSummary, "id" | "requestedAt" | "status">> {
    const row = obj(
      await this.rpc("ea_referral_request_deletion", {
        p_auth_user_id: authUserId,
      }),
    );
    if (typeof row.id !== "string")
      throw new ApiError(
        503,
        "unavailable",
        "The deletion request could not be saved.",
      );
    return {
      id: text(row.id),
      requestedAt: text(row.requested_at),
      status: text(row.status, "pending") as
        "pending" | "completed" | "rejected",
    };
  }

  async listDeletionRequests(): Promise<DeletionRequestSummary[]> {
    const rows = await this.rows(
      "ea_referral_deletion_requests?select=id,requested_at,status,completed_at&order=requested_at.desc&limit=100",
    );
    return rows.map((row) => ({
      id: text(row.id),
      requestedAt: text(row.requested_at),
      status: text(row.status, "pending") as DeletionRequestSummary["status"],
      completedAt:
        typeof row.completed_at === "string" ? row.completed_at : null,
    }));
  }

  async deleteCandidateStorage(requestId: string): Promise<void> {
    const value = await this.rpc("ea_referral_deletion_paths", {
      p_request_id: requestId,
    });
    const paths = Array.isArray(value) ? value.map(obj) : [];
    const grouped = new Map<string, string[]>();
    for (const row of paths) {
      const bucket = text(row.bucket);
      const storagePath = text(row.storage_path);
      if (bucket !== "ea_referral_resumes" || !storagePath)
        throw new ApiError(
          503,
          "unavailable",
          "Private files could not be identified for deletion.",
        );
      grouped.set(bucket, [...(grouped.get(bucket) ?? []), storagePath]);
    }
    for (const [bucket, prefixes] of grouped) {
      const headers: Record<string, string> = {
        apikey: this.config.secretKey,
        "Content-Type": "application/json",
      };
      if (!this.config.secretKey.startsWith("sb_secret_"))
        headers.Authorization = `Bearer ${this.config.secretKey}`;
      const response = await fetch(
        `${this.config.supabaseUrl}/storage/v1/object/${bucket}`,
        {
          method: "DELETE",
          headers,
          body: JSON.stringify({ prefixes }),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok)
        throw new ApiError(
          503,
          "unavailable",
          "Private files could not be deleted; the request remains pending for retry.",
        );
    }
  }

  async processCandidateDeletion(
    requestId: string,
    actorId: string,
  ): Promise<void> {
    await this.rpc("ea_referral_process_deletion", {
      p_request_id: requestId,
      p_actor_id: actorId,
    });
  }

  private toResume(row: Row): ResumeRecord {
    return {
      id: text(row.id),
      authUserId: text(row.auth_user_id),
      jobId: text(row.job_id),
      storagePath: text(row.storage_path),
      fileName: text(row.file_name),
      fileSize: number(row.file_size),
      contentType: text(row.content_type),
      version: number(row.version),
      parserStatus: text(
        row.parser_status,
        "pending",
      ) as ResumeRecord["parserStatus"],
      parsedFields: obj(row.parsed_fields) as Record<string, boolean>,
      scanStatus: text(
        row.scan_status,
        "quarantined",
      ) as ResumeRecord["scanStatus"],
      createdAt: text(row.created_at),
    };
  }

  private toSupportingFile(row: Row): SupportingFileRecord {
    return {
      id: text(row.id),
      authUserId: text(row.auth_user_id),
      storagePath: text(row.storage_path),
      fileName: text(row.file_name),
      fileSize: number(row.file_size),
      contentType: text(row.content_type),
      scanStatus: text(
        row.scan_status,
        "quarantined",
      ) as SupportingFileRecord["scanStatus"],
      createdAt: text(row.created_at),
    };
  }

  async createResume(input: ResumeRecordInput): Promise<ResumeRecord> {
    const row = obj(
      await this.rpc("ea_referral_create_resume", { p_input: input }),
    );
    if (typeof row.id !== "string")
      throw new ApiError(
        503,
        "unavailable",
        "Resume metadata could not be saved.",
      );
    return this.toResume(row);
  }

  async getResumeForOwner(
    id: string,
    authUserId: string,
  ): Promise<ResumeRecord | null> {
    const rows = await this.rows(
      `ea_referral_resumes?select=*&id=eq.${queryValue(id)}&auth_user_id=eq.${queryValue(authUserId)}&limit=1`,
    );
    return rows[0] ? this.toResume(rows[0]) : null;
  }

  async getResumeById(id: string): Promise<ResumeRecord | null> {
    const rows = await this.rows(
      `ea_referral_resumes?select=*&id=eq.${queryValue(id)}&limit=1`,
    );
    return rows[0] ? this.toResume(rows[0]) : null;
  }

  async updateResumeValidation(
    id: string,
    authUserId: string,
    patch: Pick<
      ResumeRecordInput,
      "parserStatus" | "parsedFields" | "scanStatus"
    >,
  ): Promise<ResumeRecord> {
    const row = obj(
      await this.rpc("ea_referral_validate_resume", {
        p_resume_id: id,
        p_auth_user_id: authUserId,
        p_patch: patch,
      }),
    );
    if (typeof row.id !== "string")
      throw new ApiError(404, "not_found", "Resume upload was not found.");
    return this.toResume(row);
  }

  async createStagedSupportFile(
    input: SupportingFileRecordInput,
  ): Promise<SupportingFileRecord> {
    const row = obj(
      await this.rpc("ea_referral_create_supporting_file", { p_input: input }),
    );
    if (typeof row.id !== "string")
      throw new ApiError(
        503,
        "unavailable",
        "Supporting file metadata could not be saved.",
      );
    return this.toSupportingFile(row);
  }

  async getStagedSupportFilesForOwner(
    ids: string[],
    authUserId: string,
  ): Promise<SupportingFileRecord[]> {
    if (!ids.length) return [];
    const rows = await this.rows(
      `ea_referral_supporting_files?select=*&id=in.(${ids.map(queryValue).join(",")})&auth_user_id=eq.${queryValue(authUserId)}&application_id=is.null`,
    );
    return rows.map((row) => this.toSupportingFile(row));
  }

  async getSupportingFileForOwner(
    id: string,
    authUserId: string,
  ): Promise<SupportingFileRecord | null> {
    const rows = await this.rows(
      `ea_referral_supporting_files?select=*&id=eq.${queryValue(id)}&auth_user_id=eq.${queryValue(authUserId)}&limit=1`,
    );
    return rows[0] ? this.toSupportingFile(rows[0]) : null;
  }

  async getSupportingFileById(
    id: string,
  ): Promise<SupportingFileRecord | null> {
    const rows = await this.rows(
      `ea_referral_supporting_files?select=*&id=eq.${queryValue(id)}&limit=1`,
    );
    return rows[0] ? this.toSupportingFile(rows[0]) : null;
  }

  async listJobs(publicOnly = false): Promise<Job[]> {
    if (publicOnly) {
      const value = await this.rpc("ea_referral_public_jobs", {});
      return (Array.isArray(value) ? value : []).map((row) => toJob(obj(row)));
    }
    return (
      await this.rows("ea_referral_jobs?select=*&order=updated_at.desc")
    ).map(toJob);
  }

  async getReferralSlot(jobId: string): Promise<ReferralSlot | null> {
    const rows = await this.rows(
      `ea_referral_slots?select=job_id,application_id,status,updated_at&job_id=eq.${queryValue(jobId)}&limit=1`,
    );
    return rows[0] ? this.toSlot(rows[0]) : null;
  }

  async getJobById(id: string): Promise<Job | null> {
    const rows = await this.rows(
      `ea_referral_jobs?select=*&id=eq.${queryValue(id)}&limit=1`,
    );
    return rows[0] ? toJob(rows[0]) : null;
  }

  async getJobByCanonicalJobId(canonicalJobId: string): Promise<Job | null> {
    const rows = await this.rows(
      `ea_referral_jobs?select=*&canonical_job_id=eq.${queryValue(canonicalJobId)}&limit=1`,
    );
    return rows[0] ? toJob(rows[0]) : null;
  }

  async createJob(input: CreateJobInput, actorId: string): Promise<Job> {
    const value = await this.rpc("ea_referral_create_job", {
      p_actor_id: actorId,
      p_job: input,
    });
    return toJob(obj(value));
  }

  async updateJob(
    id: string,
    input: UpdateJobInput,
    actorId: string,
  ): Promise<Job> {
    return toJob(
      obj(
        await this.rpc("ea_referral_update_job", {
          p_actor_id: actorId,
          p_job_id: id,
          p_patch: input,
        }),
      ),
    );
  }

  async getWorkspace(): Promise<WorkspaceSnapshot> {
    const [jobRows, candidateRows, applicationRows, eventRows, slotRows] =
      await Promise.all([
        this.rows("ea_referral_jobs?select=*&order=updated_at.desc"),
        this.rows("ea_referral_candidates?select=*&order=created_at.desc"),
        this.rows("ea_referral_applications?select=*&order=submitted_at.desc"),
        this.rows(
          "ea_referral_events?select=*&order=created_at.desc&limit=500",
        ),
        this.rows("ea_referral_slots?select=*&order=updated_at.desc"),
      ]);
    return {
      jobs: jobRows.map(toJob),
      candidates: candidateRows.map(toCandidate),
      applications: applicationRows.map(toApplication),
      activity: eventRows.map((row): ActivityEvent => ({
        id: text(row.id),
        at: text(row.created_at),
        label: text(row.label),
        detail: text(row.detail),
        tone: text(row.tone, "neutral") as ActivityEvent["tone"],
        jobId: typeof row.job_id === "string" ? row.job_id : undefined,
        applicationId:
          typeof row.application_id === "string"
            ? row.application_id
            : undefined,
      })),
      slots: slotRows.map((row): ReferralSlot => ({
        jobId: text(row.job_id),
        status:
          text(row.status, "available") === "confirmed"
            ? "confirmed"
            : "reserved",
        applicationId: text(row.application_id) || undefined,
        updatedAt: text(row.updated_at),
      })),
    };
  }

  async getApplicationsForJob(jobId: string): Promise<Application[]> {
    return (
      await this.rows(
        `ea_referral_applications?select=*&job_id=eq.${queryValue(jobId)}&order=submitted_at.desc`,
      )
    ).map(toApplication);
  }

  async getApplication(id: string): Promise<Application | null> {
    const rows = await this.rows(
      `ea_referral_applications?select=*&id=eq.${queryValue(id)}&limit=1`,
    );
    return rows[0] ? toApplication(rows[0]) : null;
  }

  async getApplicationForCandidateJob(
    jobId: string,
    candidateAuthUserId: string,
  ): Promise<Application | null> {
    const rows = await this.rows(
      `ea_referral_applications?select=*&job_id=eq.${queryValue(jobId)}&user_id=eq.${queryValue(candidateAuthUserId)}&limit=1`,
    );
    return rows[0] ? toApplication(rows[0]) : null;
  }

  async createApplication(
    input: VerifiedApplicationInput,
    actorId: string,
  ): Promise<{ id: string; existing?: boolean }> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.resumeId,
      )
    )
      throw new ApiError(
        400,
        "invalid_request",
        "A verified resume upload is required.",
      );
    const value = obj(
      await this.rpc("ea_referral_submit_application", {
        p_actor_id: actorId,
        p_input: input,
      }),
    );
    if (typeof value.id !== "string")
      throw new ApiError(
        503,
        "unavailable",
        "Application submission could not be completed.",
      );
    return { id: value.id, existing: value.existing === true };
  }

  async updateApplication(
    id: string,
    input: UpdateApplicationInput,
    actorId: string,
  ): Promise<Application> {
    return toApplication(
      obj(
        await this.rpc("ea_referral_update_application", {
          p_actor_id: actorId,
          p_application_id: id,
          p_patch: input,
        }),
      ),
    );
  }

  async decideApplication(
    id: string,
    status: ApplicationStatus,
    adminNote: string | null,
    actorId: string,
  ): Promise<Application> {
    if (!STATUS.includes(status))
      throw new ApiError(
        400,
        "invalid_request",
        "Application status is invalid.",
      );
    return toApplication(
      obj(
        await this.rpc("ea_referral_decide_application", {
          p_actor_id: actorId,
          p_application_id: id,
          p_status: status,
          p_admin_note: adminNote,
        }),
      ),
    );
  }

  async reserveReferral(
    jobId: string,
    applicationId: string,
    actorId: string,
  ): Promise<ReferralSlot> {
    return this.toSlot(
      await this.rpc("ea_referral_reserve", {
        p_actor_id: actorId,
        p_job_id: jobId,
        p_application_id: applicationId,
      }),
    );
  }

  async releaseReferral(jobId: string, actorId: string): Promise<ReferralSlot> {
    return this.toSlot(
      await this.rpc("ea_referral_release", {
        p_actor_id: actorId,
        p_job_id: jobId,
      }),
    );
  }

  async confirmReferral(
    jobId: string,
    applicationId: string,
    actorId: string,
  ): Promise<ReferralSlot> {
    return this.toSlot(
      await this.rpc("ea_referral_confirm", {
        p_actor_id: actorId,
        p_job_id: jobId,
        p_application_id: applicationId,
      }),
    );
  }

  async getCandidateStatus(
    applicationId: string,
    candidateAuthUserId: string,
  ): Promise<Pick<
    Application,
    "id" | "jobId" | "status" | "submittedAt"
  > | null> {
    const rows = await this.rows(
      `ea_referral_applications?select=id,job_id,status,submitted_at&user_id=eq.${queryValue(candidateAuthUserId)}&id=eq.${queryValue(applicationId)}&limit=1`,
    );
    const row = rows[0];
    return row
      ? {
          id: text(row.id),
          jobId: text(row.job_id),
          status: text(row.status, "submitted") as ApplicationStatus,
          submittedAt: text(row.submitted_at),
        }
      : null;
  }

  async listCandidateStatuses(
    candidateAuthUserId: string,
  ): Promise<CandidateStatusSummary[]> {
    const apps = await this.rows(
      `ea_referral_applications?select=id,job_id,status,submitted_at,eligibility&user_id=eq.${queryValue(candidateAuthUserId)}&order=submitted_at.desc`,
    );
    if (!apps.length) return [];
    const ids = [
      ...new Set(apps.map((row) => text(row.job_id)).filter(Boolean)),
    ];
    const jobs = await this.rows(
      `ea_referral_jobs?select=id,title&id=in.(${ids.map(queryValue).join(",")})`,
    );
    const titles = new Map(jobs.map((job) => [text(job.id), text(job.title)]));
    return apps.map((row) => {
      const status = text(row.status, "submitted") as ApplicationStatus;
      const eligibilityRow = obj(row.eligibility);
      const eligibility = {
        previouslyApplied: boolOrNull(eligibilityRow.previouslyApplied),
        previouslyReferred: boolOrNull(eligibilityRow.previouslyReferred),
        knowsOwner: bool(eligibilityRow.knowsOwner),
        inListedLocation: boolOrNull(eligibilityRow.inListedLocation),
      };
      return {
        id: text(row.id),
        jobId: text(row.job_id),
        status,
        submittedAt: text(row.submitted_at),
        jobTitle: titles.get(text(row.job_id)) ?? "EA role",
        ...(status === "correction_required" || status === "needs_clarification"
          ? { eligibility }
          : {}),
      };
    });
  }

  private toSlot(value: unknown): ReferralSlot {
    const row = obj(value);
    const status = text(row.status);
    return {
      jobId: text(row.job_id),
      status:
        status === "confirmed"
          ? "confirmed"
          : status === "available"
            ? "available"
            : "reserved",
      applicationId: text(row.application_id) || undefined,
      updatedAt: text(row.updated_at),
    };
  }
}

export function getReferralRepository(): ReferralRepository {
  return new SupabaseReferralRepository();
}

export function domainEnums() {
  return { relationships: RELATIONSHIPS, statuses: STATUS };
}
