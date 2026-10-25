import { bodyRecord, identifier, updateJobInput } from "@/app/api/_lib";
import { requireAdmin } from "@/server/auth";
import { assertSameOrigin, fail, json, parseJson } from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/jobs/[id]">,
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const { id: rawId } = await context.params;
    const id = identifier(rawId, "job ID");
    const input = updateJobInput(bodyRecord(await parseJson(request, 60_000)));
    const job = await getReferralRepository().updateJob(id, input, actor.id);
    return json({ ok: true, message: "Job updated.", job });
  } catch (error) {
    return fail(error);
  }
}
