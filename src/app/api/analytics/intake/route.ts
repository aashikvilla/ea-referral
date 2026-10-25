import { bodyRecord, identifier } from "@/app/api/_lib";
import { checkEligibility } from "@/lib/domain/eligibility";
import type { EligibilityAnswers } from "@/lib/demo/types";
import { requireUser } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import {
  ApiError,
  assertSameOrigin,
  fail,
  json,
  parseJson,
} from "@/server/http";
import type { FunnelEvent } from "@/server/repository";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTS = [
  "candidate_role_view",
  "intake_started",
  "quick_checks_passed",
] as const;

function parseAnswers(value: unknown): EligibilityAnswers {
  const row = bodyRecord(value);
  const fields = [
    "previouslyApplied",
    "previouslyReferred",
    "knowsOwner",
    "inListedLocation",
  ];
  if (
    Object.keys(row).length !== fields.length ||
    Object.keys(row).some((key) => !fields.includes(key)) ||
    typeof row.knowsOwner !== "boolean" ||
    fields
      .filter((field) => field !== "knowsOwner")
      .some((field) => row[field] !== null && typeof row[field] !== "boolean")
  )
    throw new ApiError(
      400,
      "invalid_request",
      "Answer each eligibility question first.",
    );
  return {
    previouslyApplied: row.previouslyApplied as boolean | null,
    previouslyReferred: row.previouslyReferred as boolean | null,
    knowsOwner: row.knowsOwner,
    inListedLocation: row.inListedLocation as boolean | null,
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const body = bodyRecord(await parseJson(request, 4_000));
    if (
      Object.keys(body).some(
        (key) => !["jobId", "event", "eligibility"].includes(key),
      ) ||
      typeof body.event !== "string" ||
      !EVENTS.includes(body.event as (typeof EVENTS)[number])
    )
      throw new ApiError(
        400,
        "invalid_request",
        "The intake event is invalid.",
      );
    const event = body.event as FunnelEvent;
    const jobId = identifier(body.jobId, "job ID");
    if (!UUID.test(jobId))
      throw new ApiError(400, "invalid_request", "The job ID is invalid.");
    const repository = getReferralRepository();
    const [job, slot] = await Promise.all([
      repository.getJobById(jobId),
      repository.getReferralSlot(jobId),
    ]);
    if (!job || job.status === "draft")
      throw new ApiError(404, "not_found", "This EA role was not found.");

    if (event === "quick_checks_passed") {
      const answers = parseAnswers(body.eligibility);
      const checkedAt = Date.parse(job.availabilityCheckedAt ?? "");
      if (
        slot ||
        job.status !== "open" ||
        job.availability !== "open" ||
        !Number.isFinite(checkedAt) ||
        Date.now() - checkedAt > 24 * 60 * 60 * 1000 ||
        checkEligibility(job, answers) !== "eligible"
      )
        throw new ApiError(
          400,
          "invalid_request",
          "Quick checks are not complete.",
        );
    } else if (body.eligibility !== undefined) {
      throw new ApiError(
        400,
        "invalid_request",
        "The intake event contains unsupported data.",
      );
    }

    await repository.recordFunnelEvent(event, jobId, user.id);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
