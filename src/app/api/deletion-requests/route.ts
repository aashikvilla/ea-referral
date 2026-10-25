import { requireUser } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { requireServerConfig } from "@/server/config";
import { assertSameOrigin, fail, json } from "@/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    if (user.id === requireServerConfig().adminUserId)
      return json(
        {
          ok: false,
          message:
            "Owner data deletion is not available through candidate requests.",
        },
        403,
      );
    const result = await getReferralRepository().requestCandidateDeletion(
      user.id,
    );
    return json({ ok: true, request: result }, 202);
  } catch (error) {
    return fail(error);
  }
}
