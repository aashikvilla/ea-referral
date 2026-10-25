import "server-only";
import { ApiError } from "@/server/http";

export type ServerConfig = {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  adminUserId: string;
  appOrigin: string;
  mode: "demo" | "connected";
};

function isConfiguredPlaceholder(value: string): boolean {
  return /replace_me|your-project-ref|example\.com/i.test(value);
}

export function readServerConfig(): ServerConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const adminUserId = process.env.ADMIN_USER_ID?.trim();
  const appOrigin = process.env.APP_ORIGIN?.trim();
  const mode =
    process.env.EA_REFERRAL_MODE?.trim() === "connected" ? "connected" : "demo";
  if (
    !supabaseUrl ||
    !publishableKey ||
    !secretKey ||
    !adminUserId ||
    !appOrigin
  )
    return null;
  if (
    [supabaseUrl, publishableKey, secretKey, adminUserId, appOrigin].some(
      isConfiguredPlaceholder,
    )
  )
    return null;
  try {
    const url = new URL(supabaseUrl);
    const origin = new URL(appOrigin);
    const safeUrl = (value: URL) =>
      (value.protocol === "https:" && !value.username && !value.password) ||
      (value.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname) &&
        !value.username &&
        !value.password);
    if (!safeUrl(url) || !safeUrl(origin)) return null;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        adminUserId,
      )
    )
      return null;
    return {
      supabaseUrl: url.origin,
      publishableKey,
      secretKey,
      adminUserId,
      appOrigin: origin.origin,
      mode,
    };
  } catch {
    return null;
  }
}

export function requireServerConfig(): ServerConfig {
  const config = readServerConfig();
  if (!config || config.mode !== "connected")
    throw new ApiError(
      503,
      "unavailable",
      "Connected server services are not configured.",
    );
  return config;
}
