import { requireUser } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { requireServerConfig } from "@/server/config";
import { ApiError, fail, json } from "@/server/http";
import { createPrivateSignedUrl } from "@/server/files/security";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new ApiError(
        403,
        "forbidden",
        "Cross-site file access is not allowed.",
      );
    const user = await requireUser(request);
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))
      throw new ApiError(404, "not_found", "The file was not found.");
    const repo = getReferralRepository();
    const admin = user.id === requireServerConfig().adminUserId;
    const resume = admin
      ? await repo.getResumeById(id)
      : await repo.getResumeForOwner(id, user.id);
    if (resume) {
      if (resume.scanStatus !== "clean")
        throw new ApiError(
          409,
          "conflict",
          "This resume is quarantined and cannot be downloaded.",
        );
      return json({
        ok: true,
        url: await createPrivateSignedUrl(resume.storagePath),
        expiresIn: 60,
      });
    }
    const supporting = admin
      ? await repo.getSupportingFileById(id)
      : await repo.getSupportingFileForOwner(id, user.id);
    if (!supporting || supporting.scanStatus !== "clean")
      throw new ApiError(404, "not_found", "The file was not found.");
    return json({
      ok: true,
      url: await createPrivateSignedUrl(supporting.storagePath),
      expiresIn: 60,
    });
  } catch (error) {
    return fail(error);
  }
}
