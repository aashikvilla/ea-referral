import { bodyRecord, identifier } from "@/app/api/_lib";
import { checkEligibility } from "@/lib/domain/eligibility";
import { normalizeCanonicalJobId } from "@/lib/domain/validation";
import { getReferralRepository } from "@/server/supabase-repository";
import { ApiError, fail, json, parseJson } from "@/server/http";

function eligibilityAnswers(value: unknown) {
  const record = bodyRecord(value);
  const boolOrUnknown = (key: string): boolean | null => {
    const answer = record[key];
    if (answer === null || typeof answer === "boolean") return answer;
    throw new ApiError(
      400,
      "invalid_request",
      `Enter a valid ${key} response.`,
    );
  };
  if (typeof record.knowsOwner !== "boolean")
    throw new ApiError(
      400,
      "invalid_request",
      "Enter a valid knowsOwner response.",
    );
  return {
    previouslyApplied: boolOrUnknown("previouslyApplied"),
    previouslyReferred: boolOrUnknown("previouslyReferred"),
    knowsOwner: record.knowsOwner,
    inListedLocation: boolOrUnknown("inListedLocation"),
  };
}

export async function POST(request: Request) {
  try {
    const body = bodyRecord(await parseJson(request, 4_000));
    const job =
      "jobId" in body
        ? await getReferralRepository().getJobById(
            identifier(body.jobId, "job ID"),
          )
        : "canonicalJobId" in body
          ? await (async () => {
              const canonical = normalizeCanonicalJobId(
                identifier(body.canonicalJobId, "EA job ID"),
              );
              if (!canonical)
                throw new ApiError(
                  400,
                  "invalid_request",
                  "Enter a numeric EA job ID or official EA careers job URL.",
                );
              return getReferralRepository().getJobByCanonicalJobId(canonical);
            })()
          : null;
    if (!job)
      throw new ApiError(404, "not_found", "This EA job was not found.");
    if (job.status === "draft")
      throw new ApiError(404, "not_found", "This EA job was not found.");
    const answers = eligibilityAnswers(body.eligibility);
    const repository = getReferralRepository();
    const slot = await repository.getReferralSlot(job.id);
    if (slot?.status === "confirmed" || job.status === "referred")
      return json({ ok: true, available: false, reason: "already_referred" });
    if (slot?.status === "reserved")
      return json({ ok: true, available: false, reason: "temporarily_paused" });
    if (job.availability === "closed" || job.status === "closed")
      return json({ ok: true, available: false, reason: "job_closed" });
    if (
      job.availability !== "open" ||
      !job.availabilityCheckedAt ||
      !Number.isFinite(Date.parse(job.availabilityCheckedAt)) ||
      Date.now() - Date.parse(job.availabilityCheckedAt) > 24 * 60 * 60 * 1000
    )
      return json({
        ok: true,
        available: false,
        reason: "job_availability_unknown",
      });
    if (job.status !== "open")
      return json({ ok: true, available: false, reason: "intake_paused" });
    const outcome = checkEligibility(job, answers);
    return json({
      ok: true,
      available: outcome === "eligible",
      reason: outcome,
    });
  } catch (error) {
    return fail(error);
  }
}
