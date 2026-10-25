import { requireAdmin } from "@/server/auth";
import { assertSameOrigin, fail, json, parseJson } from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return json({
      ok: true,
      requests: await getReferralRepository().listDeletionRequests(),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin(request);
    const body: unknown = await parseJson(request, 4_000);
    const id =
      body &&
      typeof body === "object" &&
      "id" in body &&
      typeof body.id === "string"
        ? body.id
        : "";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return json(
        { ok: false, message: "A deletion request ID is required." },
        400,
      );
    const repository = getReferralRepository();
    await repository.deleteCandidateStorage(id);
    await repository.processCandidateDeletion(id, admin.id);
    return json({ ok: true, id, status: "completed" });
  } catch (error) {
    return fail(error);
  }
}
