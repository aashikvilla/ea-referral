import { assertSameOrigin, fail, json, ApiError } from "@/server/http";
import {
  authRequest,
  refreshToken,
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
    const token = refreshToken(request);
    if (!token || token.length > 8192)
      throw new ApiError(401, "unauthorized", "Sign in again to continue.");
    const result = await authRequest<TokenResponse>(
      "token?grant_type=refresh_token",
      { method: "POST", body: JSON.stringify({ refresh_token: token }) },
    );
    if (
      typeof result.access_token !== "string" ||
      !result.access_token ||
      result.access_token.length > 8192 ||
      typeof result.refresh_token !== "string" ||
      !result.refresh_token ||
      result.refresh_token.length > 8192
    )
      throw new ApiError(401, "unauthorized", "Sign in again to continue.");
    const response = json({ ok: true });
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
