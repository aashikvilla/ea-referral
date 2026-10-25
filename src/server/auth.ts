import { readServerConfig, requireServerConfig } from "@/server/config";
import { ApiError } from "@/server/http";

export type VerifiedUser = {
  id: string;
  email: string | null;
  emailVerified: boolean;
};
export const ACCESS_COOKIE = "ea_referral_access_token";
export const REFRESH_COOKIE = "ea_referral_refresh_token";

function cookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export async function requireUser(request: Request): Promise<VerifiedUser> {
  const config = requireServerConfig();
  const bearer = /^Bearer ([\w.-]+)$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  const token = bearer ?? cookieValue(request, ACCESS_COOKIE);
  if (!token || token.length > 8192)
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      throw new ApiError(
        401,
        "unauthorized",
        "Your session could not be verified.",
      );
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== "object" ||
      !("id" in value) ||
      typeof value.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(value.id)
    ) {
      throw new ApiError(
        401,
        "unauthorized",
        "Your session could not be verified.",
      );
    }
    const email =
      "email" in value && typeof value.email === "string" ? value.email : null;
    const emailVerified =
      ("email_confirmed_at" in value &&
        typeof value.email_confirmed_at === "string") ||
      ("confirmed_at" in value && typeof value.confirmed_at === "string");
    if (!email || !emailVerified)
      throw new ApiError(
        403,
        "forbidden",
        "Verify your email address to continue.",
      );
    return { id: value.id, email, emailVerified };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "unavailable",
      "Authentication could not be reached.",
    );
  }
}

export async function requireAdmin(request: Request): Promise<VerifiedUser> {
  const user = await requireUser(request);
  if (user.id !== requireServerConfig().adminUserId)
    throw new ApiError(
      403,
      "forbidden",
      "This action is restricted to the owner.",
    );
  return user;
}

export async function getSessionSummary(request: Request): Promise<{
  configured: boolean;
  authenticated: boolean;
  user: { id: string; email: string | null } | null;
  isAdmin: boolean;
}> {
  const config = readServerConfig();
  if (!config || config.mode !== "connected")
    return {
      configured: false,
      authenticated: false,
      user: null,
      isAdmin: false,
    };
  try {
    const user = await requireUser(request);
    return {
      configured: true,
      authenticated: true,
      user: { id: user.id, email: user.email },
      isAdmin: user.id === config.adminUserId,
    };
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    )
      return {
        configured: true,
        authenticated: false,
        user: null,
        isAdmin: false,
      };
    throw error;
  }
}
