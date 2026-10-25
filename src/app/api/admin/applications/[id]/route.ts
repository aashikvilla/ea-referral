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
import type { UpdateApplicationInput } from "@/lib/demo/types";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/applications/[id]">,
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const { id: rawId } = await context.params;
    const id = identifier(rawId, "application ID");
    const body = bodyRecord(await parseJson(request, 4_000));
    if (
      !Object.keys(body).length ||
      Object.keys(body).some((key) => key !== "adminNote" && key !== "fitNote")
    ) {
      throw new ApiError(
        400,
        "invalid_request",
        "Only owner notes and fit summaries can be updated here.",
      );
    }
    const input: UpdateApplicationInput = {};
    for (const key of ["adminNote", "fitNote"] as const) {
      const value = optionalString(body, key, 2_000);
      if (value !== undefined) input[key] = value;
    }
    const application = await getReferralRepository().updateApplication(
      id,
      input,
      actor.id,
    );
    return json({ ok: true, message: "Owner notes updated.", application });
  } catch (error) {
    return fail(error);
  }
}
