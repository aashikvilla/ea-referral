import { bodyRecord, createJobInput } from "@/app/api/_lib";
import { requireAdmin } from "@/server/auth";
import { assertSameOrigin, fail, json, parseJson } from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const input = createJobInput(bodyRecord(await parseJson(request, 60_000)));
    const job = await getReferralRepository().createJob(input, actor.id);
    return json({ ok: true, message: "Job added.", job }, 201);
  } catch (error) {
    return fail(error);
  }
}
