import "server-only";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/server/auth";
import { requireServerConfig } from "@/server/config";
import { ApiError } from "@/server/http";

type SessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

export function safeNext(value: unknown, fallback = "/status"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://local.invalid");
    return url.origin === "https://local.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function authHeaders() {
  const config = requireServerConfig();
  return { apikey: config.publishableKey, "Content-Type": "application/json" };
}

export async function authRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = requireServerConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const status =
      response.status === 400 || response.status === 422
        ? 400
        : response.status === 401
          ? 401
          : 503;
    throw new ApiError(
      status,
      status === 401
        ? "unauthorized"
        : status === 400
          ? "invalid_request"
          : "unavailable",
      status === 401
        ? "That code could not be verified. Request a new one and try again."
        : "Authentication request could not be completed.",
    );
  }
  return value as T;
}

function cookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function setSessionCookies(response: Response, tokens: SessionTokens) {
  if (tokens.access_token.length > 8192 || tokens.refresh_token.length > 8192)
    throw new Error("The authentication response is invalid.");
  const requestedLifetime =
    typeof tokens.expires_in === "number" &&
    Number.isFinite(tokens.expires_in) &&
    tokens.expires_in > 0
      ? tokens.expires_in
      : 3600;
  const lifetime = Math.max(60, Math.min(requestedLifetime, 60 * 60 * 24 * 30));
  response.headers.append(
    "Set-Cookie",
    cookie(ACCESS_COOKIE, tokens.access_token, lifetime),
  );
  response.headers.append(
    "Set-Cookie",
    cookie(REFRESH_COOKIE, tokens.refresh_token, 60 * 60 * 24 * 30),
  );
}

export function clearSessionCookies(response: Response) {
  response.headers.append("Set-Cookie", cookie(ACCESS_COOKIE, "", 0));
  response.headers.append("Set-Cookie", cookie(REFRESH_COOKIE, "", 0));
}

export function requestCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

export function sessionToken(request: Request) {
  return requestCookie(request, ACCESS_COOKIE);
}
export function refreshToken(request: Request) {
  return requestCookie(request, REFRESH_COOKIE);
}
