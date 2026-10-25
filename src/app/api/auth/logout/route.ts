import { assertSameOrigin, fail, json } from "@/server/http";
import {
  authRequest,
  clearSessionCookies,
  sessionToken,
} from "@/server/auth-session";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = sessionToken(request);
    if (token)
      await authRequest("logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    const response = json({ ok: true });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    return fail(error);
  }
}
