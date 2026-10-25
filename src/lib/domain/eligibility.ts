import type {
  ApplicationStatus,
  EligibilityAnswers,
  Job,
} from "@/lib/demo/types";

export type EligibilityOutcome =
  | "eligible"
  | "already_applied"
  | "already_referred"
  | "known_person"
  | "location_review"
  | "needs_owner_review";

export function checkEligibility(
  job: Job,
  answers: EligibilityAnswers,
): EligibilityOutcome {
  if (job.status === "referred") return "already_referred";
  if (job.status === "paused") return "needs_owner_review";
  if (answers.previouslyReferred) return "already_referred";
  if (answers.previouslyApplied) return "already_applied";
  if (answers.previouslyApplied === null || answers.previouslyReferred === null)
    return "needs_owner_review";
  if (answers.knowsOwner) return "known_person";
  if (answers.inListedLocation === false) return "location_review";
  if (answers.inListedLocation === null) return "needs_owner_review";
  return "eligible";
}

const allowedApplicationTransitions: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  submitted: [
    "processing",
    "correction_required",
    "eligibility_review",
    "ready_for_review",
  ],
  processing: ["correction_required", "eligibility_review", "ready_for_review"],
  correction_required: ["processing", "ready_for_review"],
  eligibility_review: ["ready_for_review", "needs_clarification"],
  needs_clarification: ["ready_for_review", "correction_required"],
  ready_for_review: [
    "needs_clarification",
    "shortlisted",
    "not_selected",
    "correction_required",
  ],
  shortlisted: [
    "ready_for_review",
    "needs_clarification",
    "not_selected",
    "correction_required",
  ],
  selected_pending_submission: [],
  referral_confirmed: [],
  not_selected: [],
  slot_filled_other: [],
};

export function canTransitionApplicationStatus(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return allowedApplicationTransitions[from].includes(to);
}
