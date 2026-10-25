import { bodyRecord, identifier, optionalString } from "@/app/api/_lib";
import { requireAdmin } from "@/server/auth";
import {
  ApiError,
  assertSameOrigin,
  fail,
  json,
  parseJson,
} from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";
import type { ApplicationStatus } from "@/lib/demo/types";

const decisions: readonly ApplicationStatus[] = [
  "processing",
  "correction_required",
  "eligibility_review",
  "needs_clarification",
  "ready_for_review",
  "shortlisted",
  "not_selected",
];

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/applications/[id]/decision">,
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const { id: rawId } = await context.params;
    const id = identifier(rawId, "application ID");
    const body = bodyRecord(await parseJson(request, 4_000));
    if (
      Object.keys(body).some((key) => key !== "status" && key !== "adminNote")
    ) {
      throw new ApiError(
        400,
        "invalid_request",
        "The decision contains unsupported fields.",
      );
    }
    const status = body.status;
    if (
      typeof status !== "string" ||
      !decisions.includes(status as ApplicationStatus)
    ) {
      throw new ApiError(
        400,
        "invalid_request",
        "Choose a supported review status.",
      );
    }
    const adminNote = optionalString(body, "adminNote", 2_000) ?? null;
    const application = await getReferralRepository().decideApplication(
      id,
      status as ApplicationStatus,
      adminNote,
      actor.id,
    );
    return json({
      ok: true,
      message: "Application status updated.",
      application,
    });
  } catch (error) {
    return fail(error);
  }
}
