import { requireUser } from "@/server/auth";
import { fail, json } from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const statuses = await getReferralRepository().listCandidateStatuses(
      user.id,
    );
    return json({ ok: true, statuses });
  } catch (error) {
    return fail(error);
  }
}
