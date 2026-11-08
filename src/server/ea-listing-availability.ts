import {
  normalizeCanonicalJobId,
  validateEaJobUrl,
} from "@/lib/domain/validation";

export type EaListingAvailabilityStatus = "open" | "closed" | "unknown";

export type EaListingAvailabilityReason =
  "active_listing" | "expired_listing" | "listing_not_found" | "unverifiable";

export type EaListingAvailability = {
  canonicalJobId: string;
  status: EaListingAvailabilityStatus;
  checkedAt: string;
  source: "official" | "unknown";
  reason: EaListingAvailabilityReason;
};

type CheckOptions = {
  fetcher?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
};

const EA_ORIGIN = "https://jobs.ea.com";
const MAX_HTML_BYTES = 1_048_576;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const CANONICAL_JOB_ID = /^EA:(\d{1,32})$/;

function result(
  canonicalJobId: string,
  checkedAt: string,
  status: EaListingAvailabilityStatus,
  source: EaListingAvailability["source"],
  reason: EaListingAvailabilityReason,
): EaListingAvailability {
  return { canonicalJobId, checkedAt, status, source, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validCanonicalJobId(value: string): boolean {
  return CANONICAL_JOB_ID.test(value);
}

function makeListingUrl(canonicalJobId: string): URL | null {
  const match = CANONICAL_JOB_ID.exec(canonicalJobId);
  if (!match) return null;
  return new URL(`${EA_ORIGIN}/en_US/careers/JobDetail/${match[1]}`);
}

function isSafeListingUrl(url: URL, canonicalJobId: string): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname === "jobs.ea.com" &&
    (!url.port || url.port === "443") &&
    !url.username &&
    !url.password &&
    !url.hash &&
    url.href.length <= 2048 &&
    validateEaJobUrl(url.href) &&
    normalizeCanonicalJobId(url.href) === canonicalJobId
  );
}

async function readBoundedHtml(response: Response): Promise<string | null> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const contentLength = Number(lengthHeader);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_HTML_BYTES
    ) {
      await discardResponseBody(response);
      return null;
    }
  }

  const body = response.body;
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

async function discardResponseBody(response: Response): Promise<boolean> {
  try {
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

function isJobPosting(value: Record<string, unknown>): boolean {
  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];
  return types.some(
    (type) =>
      typeof type === "string" &&
      (type === "JobPosting" || type.endsWith("/JobPosting")),
  );
}

function collectJobPostings(
  value: unknown,
  postings: Record<string, unknown>[],
) {
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, postings);
    return;
  }
  if (!isRecord(value)) return;

  if (isJobPosting(value)) postings.push(value);
  for (const item of Object.values(value)) collectJobPostings(item, postings);
}

function identifierMatches(value: unknown, canonicalJobId: string): boolean {
  if (typeof value === "string") {
    if (/^(?:EA:)?\d+$/i.test(value)) {
      return normalizeCanonicalJobId(value) === canonicalJobId;
    }
    return normalizeCanonicalJobId(value) === canonicalJobId;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return normalizeCanonicalJobId(String(value)) === canonicalJobId;
  }
  if (Array.isArray(value))
    return value.some((item) => identifierMatches(item, canonicalJobId));
  if (!isRecord(value)) return false;

  return ["value", "url", "@id", "identifier"].some((key) =>
    identifierMatches(value[key], canonicalJobId),
  );
}

function matchesCanonicalJob(
  posting: Record<string, unknown>,
  canonicalJobId: string,
): boolean {
  return ["url", "@id", "identifier"].some((key) =>
    identifierMatches(posting[key], canonicalJobId),
  );
}

function structuredPostings(html: string): Record<string, unknown>[] {
  const postings: Record<string, unknown>[] = [];
  const scriptPattern =
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const json = match[1]?.trim();
    if (!json) continue;
    try {
      collectJobPostings(JSON.parse(json) as unknown, postings);
    } catch {
      // Another valid JSON-LD block can still establish the listing status.
    }
  }
  return postings;
}

function looksLikeChallenge(html: string): boolean {
  const visibleText = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .slice(0, 50_000);
  return /access denied|request (?:was )?blocked|verify (?:that )?you are (?:human|not a robot)|checking your browser|unusual traffic|captcha challenge|just a moment/i.test(
    visibleText,
  );
}

function classifyPostingEvidence(
  html: string,
  canonicalJobId: string,
  now: number,
): "open" | "closed" | "unknown" {
  const postings = structuredPostings(html).filter((posting) =>
    matchesCanonicalJob(posting, canonicalJobId),
  );
  if (postings.length === 0) return "unknown";

  const expiryStates = postings.map((posting) => {
    const validThrough = posting.validThrough;
    if (typeof validThrough !== "string" || !validThrough.trim())
      return "unknown";
    const expiresAt = Date.parse(validThrough);
    if (!Number.isFinite(expiresAt)) return "unknown";
    return expiresAt <= now ? "closed" : "open";
  });

  if (expiryStates.every((state) => state === "closed")) return "closed";
  if (expiryStates.every((state) => state === "open")) return "open";
  return "unknown";
}

function availabilityFromEvidence(
  canonicalJobId: string,
  checkedAt: string,
  html: string,
  now: number,
): EaListingAvailability {
  if (looksLikeChallenge(html))
    return result(
      canonicalJobId,
      checkedAt,
      "unknown",
      "unknown",
      "unverifiable",
    );

  const status = classifyPostingEvidence(html, canonicalJobId, now);
  if (status === "open")
    return result(
      canonicalJobId,
      checkedAt,
      "open",
      "official",
      "active_listing",
    );
  if (status === "closed")
    return result(
      canonicalJobId,
      checkedAt,
      "closed",
      "official",
      "expired_listing",
    );
  return result(
    canonicalJobId,
    checkedAt,
    "unknown",
    "unknown",
    "unverifiable",
  );
}

/**
 * Checks public EA job listing evidence only. It does not read or mutate
 * referral records, and uncertain responses deliberately remain unknown.
 */
export async function checkEaListingAvailability(
  canonicalJobId: string,
  options: CheckOptions = {},
): Promise<EaListingAvailability> {
  const now = options.now ?? new Date();
  const checkedAt = now.toISOString();
  if (!validCanonicalJobId(canonicalJobId))
    return result(
      canonicalJobId,
      checkedAt,
      "unknown",
      "unknown",
      "unverifiable",
    );

  const startUrl = makeListingUrl(canonicalJobId);
  if (!startUrl || !isSafeListingUrl(startUrl, canonicalJobId))
    return result(
      canonicalJobId,
      checkedAt,
      "unknown",
      "unknown",
      "unverifiable",
    );

  const fetcher = options.fetcher ?? fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const visited = new Set<string>();
  let currentUrl = startUrl;

  try {
    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount++
    ) {
      if (!isSafeListingUrl(currentUrl, canonicalJobId))
        return result(
          canonicalJobId,
          checkedAt,
          "unknown",
          "unknown",
          "unverifiable",
        );
      if (visited.has(currentUrl.href))
        return result(
          canonicalJobId,
          checkedAt,
          "unknown",
          "unknown",
          "unverifiable",
        );
      visited.add(currentUrl.href);

      const response = await fetcher(currentUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
          "User-Agent": "EA-Referral-Assistant/1.0",
        },
        cache: "no-store",
        redirect: "manual",
        signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!(await discardResponseBody(response))) break;
        if (redirectCount === MAX_REDIRECTS)
          return result(
            canonicalJobId,
            checkedAt,
            "unknown",
            "unknown",
            "unverifiable",
          );
        const location = response.headers.get("location");
        if (!location || location.length > 2048)
          return result(
            canonicalJobId,
            checkedAt,
            "unknown",
            "unknown",
            "unverifiable",
          );
        const nextUrl = new URL(location, currentUrl);
        if (!isSafeListingUrl(nextUrl, canonicalJobId))
          return result(
            canonicalJobId,
            checkedAt,
            "unknown",
            "unknown",
            "unverifiable",
          );
        currentUrl = nextUrl;
        continue;
      }

      if (response.status === 404 || response.status === 410) {
        await discardResponseBody(response);
        return result(
          canonicalJobId,
          checkedAt,
          "closed",
          "official",
          "listing_not_found",
        );
      }

      if (!response.ok) {
        await discardResponseBody(response);
        break;
      }
      const contentType = response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();
      if (
        contentType !== "text/html" &&
        contentType !== "application/xhtml+xml"
      ) {
        await discardResponseBody(response);
        break;
      }

      const html = await readBoundedHtml(response);
      if (html === null) break;
      return availabilityFromEvidence(
        canonicalJobId,
        checkedAt,
        html,
        now.getTime(),
      );
    }
  } catch {
    // Network errors, proxy blocks, and timeouts cannot establish closure.
  }

  return result(
    canonicalJobId,
    checkedAt,
    "unknown",
    "unknown",
    "unverifiable",
  );
}
