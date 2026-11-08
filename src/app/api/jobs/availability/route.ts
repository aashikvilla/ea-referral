import { bodyRecord, requiredString } from "@/app/api/_lib";
import { normalizeCanonicalJobId } from "@/lib/domain/validation";
import { checkEaListingAvailability } from "@/server/ea-listing-availability";
import { ApiError, fail, json, parseJson } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = bodyRecord(await parseJson(request, 4_000));
    if (
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "canonicalJobId")
    ) {
      throw new ApiError(
        400,
        "invalid_request",
        "Send only a canonical EA job ID.",
      );
    }

    const submittedId = requiredString(body, "canonicalJobId", 128);
    const canonicalJobId = normalizeCanonicalJobId(submittedId);
    if (!canonicalJobId || !/^EA:\d{1,32}$/.test(canonicalJobId))
      throw new ApiError(
        400,
        "invalid_request",
        "Enter a numeric EA job ID or official EA careers job URL.",
      );

    const availability = await checkEaListingAvailability(canonicalJobId);
    return json({ ok: true, ...availability });
  } catch (error) {
    return fail(error);
  }
}
