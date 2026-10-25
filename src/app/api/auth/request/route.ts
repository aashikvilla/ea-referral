import {
  assertSameOrigin,
  fail,
  json,
  parseJson,
  ApiError,
} from "@/server/http";
import { authRequest } from "@/server/auth-session";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await parseJson(request, 2_000);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError(400, "invalid_request", "Enter your email address.");
    const email = (body as Record<string, unknown>).email;
    if (
      typeof email !== "string" ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Enter a valid email address.",
      );
    await authRequest("otp", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    return json({
      ok: true,
      message:
        "If this address can sign in, a verification code has been sent.",
    });
  } catch (error) {
    return fail(error);
  }
}
