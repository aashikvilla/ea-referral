import { requireAdmin } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { fail, json } from "@/server/http";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const workspace = await getReferralRepository().getWorkspace();
    return json(workspace);
  } catch (error) {
    return fail(error);
  }
}
