import type {
  CreateJobInput,
  JobAvailability,
  JobStatus,
  UpdateJobInput,
} from "@/lib/demo/types";
import {
  normalizeCanonicalJobId,
  validateEaJobUrl,
} from "@/lib/domain/validation";
import { ApiError } from "@/server/http";

export function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(
      400,
      "invalid_request",
      "Request body must be an object.",
    );
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = record[key];
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new ApiError(400, "invalid_request", `Enter a valid ${key}.`);
  }
  return value.trim();
}

export function optionalString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ApiError(400, "invalid_request", `Enter a valid ${key}.`);
  }
  return value.trim();
}

function readLocations(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some(
      (item) => typeof item !== "string" || !item.trim() || item.length > 120,
    )
  ) {
    throw new ApiError(
      400,
      "invalid_request",
      "Add one or more role locations, each under 120 characters.",
    );
  }
  return value.map((item) => (item as string).trim());
}

export function createJobInput(
  record: Record<string, unknown>,
): CreateJobInput {
  const canonicalInput = requiredString(record, "canonicalJobId", 500);
  const canonicalJobId = normalizeCanonicalJobId(canonicalInput);
  if (!canonicalJobId)
    throw new ApiError(
      400,
      "invalid_request",
      "Enter a numeric EA job ID or official EA careers job URL.",
    );
  const rawOfficialUrl = requiredString(record, "officialUrl", 2048);
  if (!validateEaJobUrl(rawOfficialUrl))
    throw new ApiError(
      400,
      "invalid_request",
      "Use an official EA careers job URL.",
    );
  const officialUrl =
    new URL(rawOfficialUrl).origin + new URL(rawOfficialUrl).pathname;
  if (normalizeCanonicalJobId(officialUrl) !== canonicalJobId)
    throw new ApiError(
      400,
      "invalid_request",
      "The official EA job URL must match the EA job ID.",
    );
  const locations = readLocations(record.locations);
  return {
    canonicalJobId,
    title: requiredString(record, "title", 200),
    team: requiredString(record, "team", 200),
    location: requiredString(record, "location", 200),
    locations,
    employmentType: requiredString(record, "employmentType", 100),
    officialUrl,
    description: requiredString(record, "description", 50_000),
  };
}

const jobUpdateKeys = new Set([
  "canonicalJobId",
  "title",
  "team",
  "location",
  "locations",
  "employmentType",
  "officialUrl",
  "description",
  "status",
  "availability",
]);

export function updateJobInput(
  record: Record<string, unknown>,
): UpdateJobInput {
  if (
    !Object.keys(record).length ||
    Object.keys(record).some((key) => !jobUpdateKeys.has(key))
  ) {
    throw new ApiError(
      400,
      "invalid_request",
      "The job update contains unsupported fields.",
    );
  }
  const result: UpdateJobInput = {};
  if ("canonicalJobId" in record) {
    const value = requiredString(record, "canonicalJobId", 500);
    const canonicalJobId = normalizeCanonicalJobId(value);
    if (!canonicalJobId)
      throw new ApiError(
        400,
        "invalid_request",
        "Enter a numeric EA job ID or official EA careers job URL.",
      );
    result.canonicalJobId = canonicalJobId;
  }
  for (const key of [
    "title",
    "team",
    "location",
    "employmentType",
    "description",
  ] as const) {
    const max =
      key === "description" ? 50_000 : key === "employmentType" ? 100 : 200;
    const value = optionalString(record, key, max);
    if (value !== undefined) result[key] = value;
  }
  if ("locations" in record) result.locations = readLocations(record.locations);
  if ("officialUrl" in record) {
    const rawOfficialUrl = requiredString(record, "officialUrl", 2048);
    if (!validateEaJobUrl(rawOfficialUrl))
      throw new ApiError(
        400,
        "invalid_request",
        "Use an official EA careers job URL.",
      );
    const officialUrl =
      new URL(rawOfficialUrl).origin + new URL(rawOfficialUrl).pathname;
    if (
      "canonicalJobId" in result &&
      normalizeCanonicalJobId(officialUrl) !== result.canonicalJobId
    )
      throw new ApiError(
        400,
        "invalid_request",
        "The official EA job URL must match the EA job ID.",
      );
    result.officialUrl = officialUrl;
  }
  if ("status" in record) {
    const status = record.status;
    const allowed: JobStatus[] = ["draft", "open", "paused", "closed"];
    if (typeof status !== "string" || !allowed.includes(status as JobStatus)) {
      throw new ApiError(
        400,
        "invalid_request",
        "Choose a valid job intake status.",
      );
    }
    result.status = status as JobStatus;
  }
  if ("availability" in record) {
    const availability = record.availability;
    const allowed: JobAvailability[] = ["open", "closed", "unknown"];
    if (
      typeof availability !== "string" ||
      !allowed.includes(availability as JobAvailability)
    ) {
      throw new ApiError(
        400,
        "invalid_request",
        "Choose open, closed, or unknown availability.",
      );
    }
    result.availability = availability as JobAvailability;
  }
  return result;
}

export function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    /[\u0000-\u001f/\\]/.test(value)
  ) {
    throw new ApiError(400, "invalid_request", `Enter a valid ${label}.`);
  }
  return value;
}
