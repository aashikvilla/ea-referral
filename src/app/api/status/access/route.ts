import { ApiError, assertSameOrigin, fail, parseJson } from "@/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await parseJson(request, 2_000);
    throw new ApiError(
      503,
      "unavailable",
      "Candidate status email verification is not configured. No message was sent.",
    );
  } catch (error) {
    return fail(error);
  }
}
