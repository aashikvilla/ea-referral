import { requireUser } from "@/server/auth";
import { bodyRecord } from "@/app/api/_lib";
import type {
  CreateApplicationInput,
  EligibilityAnswers,
  Relationship,
} from "@/lib/demo/types";
import { getReferralRepository } from "@/server/supabase-repository";
import { SUPPORTING_TOTAL_MAX_BYTES } from "@/server/files/contracts";
import {
  ApiError,
  assertSameOrigin,
  fail,
  json,
  parseJson,
} from "@/server/http";

const RELATIONSHIPS: readonly Relationship[] = [
  "current_ea_employee",
  "customer_client",
  "family_member",
  "former_colleague",
  "friend",
  "professional_network",
  "other",
];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(
  record: Record<string, unknown>,
  key: string,
  max: number,
  required = false,
): string {
  const value = record[key];
  if (value === undefined && !required) return "";
  if (
    typeof value !== "string" ||
    Array.from(value.trim()).length > max ||
    (required && !value.trim())
  )
    throw new ApiError(400, "invalid_request", `Enter a valid ${key}.`);
  return value.trim();
}

function onlyKeys(
  record: Record<string, unknown>,
  keys: string[],
  label: string,
) {
  if (Object.keys(record).some((key) => !keys.includes(key)))
    throw new ApiError(
      400,
      "invalid_request",
      `${label} contains unsupported fields.`,
    );
}

function parseEligibility(value: unknown): EligibilityAnswers {
  const row = bodyRecord(value);
  onlyKeys(
    row,
    [
      "previouslyApplied",
      "previouslyReferred",
      "knowsOwner",
      "inListedLocation",
    ],
    "Eligibility answers",
  );
  const nullableBoolean = (key: string): boolean | null => {
    const answer = row[key];
    if (answer !== null && typeof answer !== "boolean")
      throw new ApiError(
        400,
        "invalid_request",
        `Answer ${key} before submitting.`,
      );
    return answer;
  };
  if (typeof row.knowsOwner !== "boolean")
    throw new ApiError(
      400,
      "invalid_request",
      "Answer knowsOwner before submitting.",
    );
  return {
    previouslyApplied: nullableBoolean("previouslyApplied"),
    previouslyReferred: nullableBoolean("previouslyReferred"),
    knowsOwner: row.knowsOwner,
    inListedLocation: nullableBoolean("inListedLocation"),
  };
}

function parseLinks(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10)
    throw new ApiError(
      400,
      "invalid_request",
      "Add no more than 10 showcase links.",
    );
  return value.map((item) => {
    if (typeof item !== "string" || item.length > 2048)
      throw new ApiError(400, "invalid_request", "A showcase link is invalid.");
    let url: URL;
    try {
      url = new URL(item);
    } catch {
      throw new ApiError(
        400,
        "invalid_request",
        "Enter a full HTTPS showcase link.",
      );
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new ApiError(
        400,
        "invalid_request",
        "Showcase links must use HTTPS.",
      );
    return url.toString();
  });
}

function parseSupportIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20)
    throw new ApiError(
      400,
      "invalid_request",
      "Remove some optional supporting files.",
    );
  const ids = value.map((item) => {
    let id: unknown;
    if (typeof item === "string") {
      id = item;
    } else {
      const file = bodyRecord(item);
      onlyKeys(file, ["id"], "Supporting file reference");
      id = file.id;
    }
    if (typeof id !== "string" || !UUID.test(id))
      throw new ApiError(
        400,
        "invalid_request",
        "A supporting file reference is invalid.",
      );
    return id;
  });
  if (new Set(ids).size !== ids.length)
    throw new ApiError(
      400,
      "invalid_request",
      "A supporting file was included more than once.",
    );
  return ids;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const payload = bodyRecord(await parseJson(request, 32_000));
    onlyKeys(
      payload,
      [
        "jobId",
        "candidate",
        "eligibility",
        "relationship",
        "resumeId",
        "showcase",
      ],
      "Application",
    );
    const jobId = payload.jobId;
    if (typeof jobId !== "string" || !UUID.test(jobId))
      throw new ApiError(400, "invalid_request", "Choose a valid EA job.");
    const repo = getReferralRepository();

    const existing = await repo.getApplicationForCandidateJob(jobId, user.id);
    if (existing)
      return json(
        { ok: true, applicationId: existing.id, existing: true },
        200,
      );

    const candidate = bodyRecord(payload.candidate);
    onlyKeys(
      candidate,
      [
        "firstName",
        "lastName",
        "email",
        "phone",
        "country",
        "currentTitle",
        "currentCompany",
        "relationship",
      ],
      "Candidate details",
    );
    const firstName = text(candidate, "firstName", 100, true);
    const lastName = text(candidate, "lastName", 100, true);
    const email = text(candidate, "email", 254, true).toLowerCase();
    const phone = text(candidate, "phone", 40, true);
    const country = text(candidate, "country", 100, true);
    const currentTitle = text(candidate, "currentTitle", 200);
    const currentCompany = text(candidate, "currentCompany", 200);
    if (email !== user.email?.toLowerCase())
      throw new ApiError(
        400,
        "invalid_request",
        "Use the email address verified for this account.",
      );
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.replace(/\D/g, "").length < 7
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Enter a valid email and phone number.",
      );
    const relationshipValue = payload.relationship ?? candidate.relationship;
    if (
      typeof relationshipValue !== "string" ||
      !RELATIONSHIPS.includes(relationshipValue as Relationship)
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Choose a valid relationship.",
      );
    const relationship = relationshipValue as Relationship;
    if (
      candidate.relationship !== undefined &&
      candidate.relationship !== relationship
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Relationship answers do not match.",
      );

    const eligibility = parseEligibility(payload.eligibility);
    const showcase =
      payload.showcase === undefined ? {} : bodyRecord(payload.showcase);
    onlyKeys(showcase, ["note", "links", "files"], "Showcase details");
    const note = text(showcase, "note", 500);
    const links = parseLinks(showcase.links);
    const supportingFileIds = parseSupportIds(showcase.files);
    const resumeId = payload.resumeId;
    if (typeof resumeId !== "string" || !UUID.test(resumeId))
      throw new ApiError(
        400,
        "invalid_request",
        "A verified resume upload is required.",
      );

    const [job, slot, resume, supporting] = await Promise.all([
      repo.getJobById(jobId),
      repo.getReferralSlot(jobId),
      repo.getResumeForOwner(resumeId, user.id),
      repo.getStagedSupportFilesForOwner(supportingFileIds, user.id),
    ]);
    if (!job)
      throw new ApiError(
        404,
        "not_found",
        "The selected EA job was not found.",
      );
    const availabilityCheckedAt = Date.parse(job.availabilityCheckedAt ?? "");
    if (
      slot ||
      job.status !== "open" ||
      job.availability !== "open" ||
      !Number.isFinite(availabilityCheckedAt) ||
      Date.now() - availabilityCheckedAt > 24 * 60 * 60 * 1000
    )
      throw new ApiError(
        409,
        "conflict",
        "Intake is no longer available for this EA job.",
      );
    const documentFieldsReady = [
      "firstName",
      "lastName",
      "email",
      "phone",
    ].every((field) => resume?.parsedFields[field] === true);
    if (
      !resume ||
      resume.jobId !== jobId ||
      resume.scanStatus !== "clean" ||
      resume.parserStatus !== "ready" ||
      !documentFieldsReady
    )
      throw new ApiError(
        409,
        "conflict",
        "Upload a readable resume for this EA role with your name, email, and phone before submitting.",
      );
    if (
      supporting.length !== supportingFileIds.length ||
      supporting.some((file) => file.scanStatus !== "clean")
    )
      throw new ApiError(
        400,
        "invalid_request",
        "One or more supporting files are not available or have not passed scanning.",
      );
    const extrasSize = supporting.reduce((sum, file) => sum + file.fileSize, 0);
    if (extrasSize > SUPPORTING_TOTAL_MAX_BYTES)
      throw new ApiError(
        413,
        "invalid_request",
        "Optional supporting files must total no more than 10 MiB.",
      );

    const input: CreateApplicationInput = {
      jobId,
      candidate: {
        firstName,
        lastName,
        email,
        phone,
        country,
        currentTitle,
        currentCompany,
        relationship,
      },
      relationship,
      eligibility,
      resume: {
        fileName: resume.fileName,
        fileSize: resume.fileSize,
        fileType: resume.contentType,
        fields:
          resume.parsedFields as CreateApplicationInput["resume"]["fields"],
      },
      showcase: {
        note,
        links,
        files: supporting.map((file) => ({
          id: file.id,
          name: file.fileName,
          size: file.fileSize,
          type: file.contentType,
        })),
      },
    };
    const created = await repo.createApplication(
      { ...input, resumeId, supportingFileIds },
      user.id,
    );
    return json(
      {
        ok: true,
        applicationId: created.id,
        existing: created.existing === true,
      },
      created.existing ? 200 : 201,
    );
  } catch (error) {
    return fail(error);
  }
}
