export type JobAvailability = "open" | "closed" | "unknown";
export type JobStatus = "draft" | "open" | "paused" | "closed" | "referred";
export type SlotStatus = "available" | "reserved" | "confirmed";

export type ApplicationStatus =
  | "submitted"
  | "processing"
  | "correction_required"
  | "eligibility_review"
  | "needs_clarification"
  | "ready_for_review"
  | "shortlisted"
  | "selected_pending_submission"
  | "referral_confirmed"
  | "not_selected"
  | "slot_filled_other";

export type Relationship =
  | "current_ea_employee"
  | "customer_client"
  | "family_member"
  | "former_colleague"
  | "friend"
  | "professional_network"
  | "other";

export type EligibilityAnswers = {
  previouslyApplied: boolean | null;
  previouslyReferred: boolean | null;
  knowsOwner: boolean;
  inListedLocation: boolean | null;
};

export type Job = {
  id: string;
  canonicalJobId: string;
  title: string;
  team: string;
  location: string;
  locations: string[];
  employmentType: string;
  officialUrl: string;
  description: string;
  status: JobStatus;
  availability: JobAvailability;
  availabilityCheckedAt: string | null;
  availabilitySource?: "manual" | "official" | "unknown";
  availabilityReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  currentTitle: string;
  currentCompany: string;
  relationship: Relationship;
};

export type MatchBreakdown = {
  mandatory: number;
  relevantWork: number;
  preferred: number;
  achievements: number;
};

export type Application = {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  submittedAt: string;
  eligibility: EligibilityAnswers;
  resumeId?: string;
  resumeReady: boolean;
  resumeFields: {
    firstName: boolean;
    lastName: boolean;
    email: boolean;
    phone: boolean;
  };
  resume: {
    fileName: string;
    fileSize: number;
    fileType: string;
    version: number;
    uploadedAt: string;
  };
  correctionFields: string[];
  matchScore: number;
  match: MatchBreakdown;
  matchSummary: string;
  evidence: string[];
  requirements: {
    label: string;
    category: keyof MatchBreakdown;
    weight: number;
    evidence: string;
    citation: string;
    met: boolean;
  }[];
  showcase: {
    note: string;
    links: string[];
    files: { id?: string; name: string; size: number; type?: string }[];
  };
  note?: string;
  fitNote?: string;
  projectLinks: string[];
  adminNote?: string;
};

export type CreateJobInput = Pick<
  Job,
  | "canonicalJobId"
  | "title"
  | "team"
  | "location"
  | "locations"
  | "employmentType"
  | "officialUrl"
  | "description"
>;
export type UpdateJobInput = Partial<
  CreateJobInput &
    Pick<
      Job,
      | "status"
      | "availability"
      | "availabilityCheckedAt"
      | "availabilitySource"
      | "availabilityReason"
    >
>;
export type CreateApplicationInput = {
  jobId: string;
  candidate: Omit<Candidate, "id">;
  eligibility: EligibilityAnswers;
  relationship: Relationship;
  resume: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fields: Application["resumeFields"];
  };
  showcase?: {
    note?: string;
    links?: string[];
    files?: { id?: string; name: string; size: number; type?: string }[];
  };
};
export type UpdateApplicationInput = Partial<
  Pick<
    Application,
    "status" | "adminNote" | "fitNote" | "note" | "showcase" | "eligibility"
  >
>;

export type ReferralSlot = {
  jobId: string;
  status: SlotStatus;
  applicationId?: string;
  updatedAt: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  label: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
  jobId?: string;
  applicationId?: string;
};

export type ActionResult =
  { ok: true; message: string } | { ok: false; message: string };
export type WorkspaceMode = "demo" | "connected";
export type WorkspaceSession = {
  user: { id: string; email: string } | null;
  isAdmin: boolean;
} | null;
