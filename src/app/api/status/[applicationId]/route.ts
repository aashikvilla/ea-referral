import { requireUser } from "@/server/auth";
import { identifier } from "@/app/api/_lib";
import { ApiError, fail, json } from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

export async function GET(
  request: Request,
  context: RouteContext<"/api/status/[applicationId]">,
) {
  try {
    const user = await requireUser(request);
    const { applicationId: rawId } = await context.params;
    const applicationId = identifier(rawId, "application ID");
    const status = await getReferralRepository().getCandidateStatus(
      applicationId,
      user.id,
    );
    if (!status)
      throw new ApiError(
        404,
        "not_found",
        "This candidate status could not be found.",
      );
    return json({ ok: true, status });
  } catch (error) {
    return fail(error);
  }
}
