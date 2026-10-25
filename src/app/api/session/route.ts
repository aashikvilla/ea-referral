import { getSessionSummary } from "@/server/auth";
import { fail, json } from "@/server/http";
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

export async function GET(request: Request) {
  try {
    let session = await getSessionSummary(request);
    if (session.configured && !session.authenticated) {
      const token = refreshToken(request);
      if (token && token.length <= 8192) {
        try {
          const refreshed = await authRequest<TokenResponse>(
            "token?grant_type=refresh_token",
            { method: "POST", body: JSON.stringify({ refresh_token: token }) },
          );
          if (
            typeof refreshed.access_token === "string" &&
            refreshed.access_token.length > 0 &&
            refreshed.access_token.length <= 8192 &&
            typeof refreshed.refresh_token === "string" &&
            refreshed.refresh_token.length > 0 &&
            refreshed.refresh_token.length <= 8192
          ) {
            const sessionRequest = new Request(request, {
              headers: new Headers(request.headers),
            });
            sessionRequest.headers.set(
              "authorization",
              `Bearer ${refreshed.access_token}`,
            );
            session = await getSessionSummary(sessionRequest);
            const finalResponse = json(session);
            setSessionCookies(
              finalResponse,
              refreshed as TokenResponse & {
                access_token: string;
                refresh_token: string;
              },
            );
            return finalResponse;
          }
        } catch {
          /* A stale refresh token leaves the user signed out. */
        }
      }
    }
    return json(session);
  } catch (error) {
    return fail(error);
  }
}
