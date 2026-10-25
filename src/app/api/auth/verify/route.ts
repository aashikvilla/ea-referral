import {
  assertSameOrigin,
  fail,
  json,
  parseJson,
  ApiError,
} from "@/server/http";
import {
  authRequest,
  safeNext,
  setSessionCookies,
} from "@/server/auth-session";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await parseJson(request, 3_000);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApiError(
        400,
        "invalid_request",
        "Enter the verification code.",
      );
    const values = body as Record<string, unknown>;
    const email =
      typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
    const token = typeof values.token === "string" ? values.token.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6,8}$/.test(token))
      throw new ApiError(
        400,
        "invalid_request",
        "Enter a valid email and verification code.",
      );
    const result = await authRequest<TokenResponse>("verify", {
      method: "POST",
      body: JSON.stringify({ email, token, type: "email" }),
    });
    if (
      typeof result.access_token !== "string" ||
      !result.access_token ||
      result.access_token.length > 8192 ||
      typeof result.refresh_token !== "string" ||
      !result.refresh_token ||
      result.refresh_token.length > 8192
    )
      throw new ApiError(
        401,
        "unauthorized",
        "That code could not be verified. Request a new one and try again.",
      );
    const response = json({ ok: true, next: safeNext(values.next) });
    setSessionCookies(
      response,
      result as Required<
        Pick<TokenResponse, "access_token" | "refresh_token">
      > &
        TokenResponse,
    );
    return response;
  } catch (error) {
    return fail(error);
  }
}
