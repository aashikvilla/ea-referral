import { bodyRecord, identifier } from "@/app/api/_lib";
import { requireAdmin } from "@/server/auth";
import {
  ApiError,
  assertSameOrigin,
  fail,
  json,
  parseJson,
} from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

type ReferralAction = "reserve" | "release" | "confirm";

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/referrals/[action]">,
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const { action: rawAction } = await context.params;
    if (
      rawAction !== "reserve" &&
      rawAction !== "release" &&
      rawAction !== "confirm"
    ) {
      throw new ApiError(404, "not_found", "Referral action not found.");
    }
    const action: ReferralAction = rawAction;
    const body = bodyRecord(await parseJson(request, 4_000));
    const jobId = identifier(body.jobId, "job ID");
    let slot;
    if (action === "release") {
      if (Object.keys(body).some((key) => key !== "jobId"))
        throw new ApiError(
          400,
          "invalid_request",
          "Release accepts only a job ID.",
        );
      slot = await getReferralRepository().releaseReferral(jobId, actor.id);
    } else {
      if (
        Object.keys(body).some(
          (key) => key !== "jobId" && key !== "applicationId",
        )
      )
        throw new ApiError(
          400,
          "invalid_request",
          "The referral action contains unsupported fields.",
        );
      const applicationId = identifier(body.applicationId, "application ID");
      slot =
        action === "reserve"
          ? await getReferralRepository().reserveReferral(
              jobId,
              applicationId,
              actor.id,
            )
          : await getReferralRepository().confirmReferral(
              jobId,
              applicationId,
              actor.id,
            );
    }
    return json({
      ok: true,
      message:
        action === "confirm"
          ? "Referral marked as manually confirmed."
          : `Referral slot ${action}d.`,
      slot,
    });
  } catch (error) {
    return fail(error);
  }
}
