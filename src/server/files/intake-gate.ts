import "server-only";
import { ApiError } from "@/server/http";
import type { ReferralRepository } from "@/server/repository";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyUploadIntake(
  form: FormData,
  repository: ReferralRepository,
): Promise<string> {
  const jobId = form.get("jobId");
  if (typeof jobId !== "string" || !UUID.test(jobId))
    throw new ApiError(
      400,
      "invalid_request",
      "Choose an open EA role before uploading files.",
    );
  const rawEligibility = form.get("eligibility");
  if (typeof rawEligibility !== "string" || rawEligibility.length > 1_000)
    throw new ApiError(
      400,
      "invalid_request",
      "Complete the eligibility questions before uploading files.",
    );
  let eligibility: unknown;
  try {
    eligibility = JSON.parse(rawEligibility) as unknown;
  } catch {
    throw new ApiError(
      400,
      "invalid_request",
      "Eligibility answers are invalid.",
    );
  }
  if (
    !eligibility ||
    typeof eligibility !== "object" ||
    Array.isArray(eligibility)
  )
    throw new ApiError(
      400,
      "invalid_request",
      "Eligibility answers are invalid.",
    );
  const answers = eligibility as Record<string, unknown>;
  const keys = [
    "previouslyApplied",
    "previouslyReferred",
    "knowsOwner",
    "inListedLocation",
  ];
  if (
    Object.keys(answers).length !== keys.length ||
    Object.keys(answers).some((key) => !keys.includes(key)) ||
    keys.some((key) =>
      key === "knowsOwner"
        ? typeof answers[key] !== "boolean"
        : answers[key] !== null && typeof answers[key] !== "boolean",
    )
  )
    throw new ApiError(
      400,
      "invalid_request",
      "Answer each eligibility question before uploading files.",
    );
  if (
    answers.previouslyApplied ||
    answers.previouslyReferred ||
    answers.knowsOwner
  )
    throw new ApiError(
      403,
      "forbidden",
      "This request cannot continue through public intake.",
    );

  const [job, slot] = await Promise.all([
    repository.getJobById(jobId),
    repository.getReferralSlot(jobId),
  ]);
  if (!job)
    throw new ApiError(404, "not_found", "The selected EA role was not found.");
  const checkedAt = Date.parse(job.availabilityCheckedAt ?? "");
  if (
    slot ||
    job.status !== "open" ||
    job.availability !== "open" ||
    !Number.isFinite(checkedAt) ||
    Date.now() - checkedAt > 24 * 60 * 60 * 1000
  )
    throw new ApiError(
      409,
      "conflict",
      "This EA role is not accepting uploads right now.",
    );
  return jobId;
}
