import "server-only";
import { requireServerConfig } from "@/server/config";
import { ApiError } from "@/server/http";

const BUCKET = "ea_referral_resumes";

function storageUrl(path: string): string {
  const config = requireServerConfig();
  return `${config.supabaseUrl}/storage/v1/${path}`;
}

function storageHeaders(extra: HeadersInit = {}): Headers {
  const config = requireServerConfig();
  const headers = new Headers(extra);
  headers.set("apikey", config.secretKey);
  if (!config.secretKey.startsWith("sb_secret_"))
    headers.set("Authorization", `Bearer ${config.secretKey}`);
  return headers;
}

export async function storePrivateObject(
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  let response: Response;
  try {
    response = await fetch(storageUrl(`object/${BUCKET}/${encoded}`), {
      method: "POST",
      headers: storageHeaders({
        "Content-Type": contentType,
        "x-upsert": "false",
      }),
      body: Buffer.from(bytes),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      503,
      "unavailable",
      "Private file storage is unavailable.",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      503,
      "unavailable",
      "Private file storage rejected the upload.",
    );
  }
}

export async function removePrivateObject(path: string): Promise<void> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  try {
    await fetch(storageUrl(`object/${BUCKET}/${encoded}`), {
      method: "DELETE",
      headers: storageHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // A failed cleanup remains private and can be removed by retention work.
  }
}

export async function createPrivateSignedUrl(path: string): Promise<string> {
  const config = requireServerConfig();
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  let response: Response;
  try {
    response = await fetch(storageUrl(`object/sign/${BUCKET}/${encoded}`), {
      method: "POST",
      headers: storageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: 60 }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new ApiError(
      503,
      "unavailable",
      "A private download link is unavailable.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      503,
      "unavailable",
      "A private download link is unavailable.",
    );
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("signedURL" in body) ||
    typeof body.signedURL !== "string"
  ) {
    throw new ApiError(
      503,
      "unavailable",
      "A private download link is unavailable.",
    );
  }
  const signedPath = body.signedURL.startsWith("/storage/v1/")
    ? body.signedURL
    : body.signedURL.startsWith("/")
      ? `/storage/v1${body.signedURL}`
      : body.signedURL;
  const signed = signedPath.startsWith("/")
    ? new URL(signedPath, config.supabaseUrl).toString()
    : body.signedURL;
  const target = new URL(signed);
  if (target.origin !== config.supabaseUrl)
    throw new ApiError(
      503,
      "unavailable",
      "A private download link is unavailable.",
    );
  return signed;
}

export async function readPrivateObject(
  path: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  let response: Response;
  try {
    response = await fetch(
      storageUrl(`object/authenticated/${BUCKET}/${encoded}`),
      {
        headers: storageHeaders(),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    throw new ApiError(
      503,
      "unavailable",
      "Private file storage is unavailable.",
    );
  }
  if (!response.ok || !response.body)
    throw new ApiError(
      503,
      "unavailable",
      "The private file could not be read.",
    );
  const advertisedLength = Number(response.headers.get("content-length") ?? 0);
  if (advertisedLength > maxBytes)
    throw new ApiError(
      413,
      "invalid_request",
      "The private file exceeds the processing limit.",
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError(
        413,
        "invalid_request",
        "The private file exceeds the processing limit.",
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
