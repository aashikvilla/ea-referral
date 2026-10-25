import { bodyRecord, identifier } from "@/app/api/_lib";
import { requireAdmin } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { assessWithGateway, redactAssessmentText } from "@/server/assessment";
import {
  ApiError,
  assertSameOrigin,
  fail,
  json,
  parseJson,
} from "@/server/http";
import {
  documentType,
  RESUME_MAX_BYTES,
  validateDocumentMagic,
} from "@/server/files/contracts";
import { PdfDocxParser } from "@/server/files/parser";
import { readPrivateObject } from "@/server/files/security";

export const maxDuration = 30;

/** Owner-triggered advisory assessment; never changes an application or decision. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const body = bodyRecord(await parseJson(request, 2_000));
    if (
      Object.keys(body).length !== 1 ||
      typeof body.applicationId !== "string"
    )
      throw new ApiError(
        400,
        "invalid_request",
        "Choose one application to assess.",
      );
    const applicationId = identifier(body.applicationId, "application ID");

    const repo = getReferralRepository();
    const workspace = await repo.getWorkspace();
    const application = workspace.applications.find(
      (item) => item.id === applicationId,
    );
    if (!application)
      throw new ApiError(404, "not_found", "The application was not found.");
    const job = workspace.jobs.find((item) => item.id === application.jobId);
    const candidate = workspace.candidates.find(
      (item) => item.id === application.candidateId,
    );
    if (!job || !candidate || !application.resumeId)
      throw new ApiError(
        409,
        "conflict",
        "The required job or resume is unavailable.",
      );
    if (!application.resumeReady)
      throw new ApiError(
        409,
        "conflict",
        "Resume readiness must be complete first.",
      );
    if (!job.description.trim())
      throw new ApiError(
        409,
        "conflict",
        "The job description is unavailable.",
      );

    const resume = await repo.getResumeById(application.resumeId);
    if (!resume || resume.jobId !== job.id || resume.scanStatus !== "clean")
      throw new ApiError(
        409,
        "conflict",
        "A clean resume is unavailable for assessment.",
      );
    const document = documentType(resume.fileName, resume.contentType);
    const bytes = await readPrivateObject(resume.storagePath, RESUME_MAX_BYTES);
    validateDocumentMagic(bytes, document);
    const extractedText = await new PdfDocxParser().extractText(
      bytes,
      document,
    );
    const resumeText = redactAssessmentText(extractedText, {
      email: candidate.email,
      phone: candidate.phone,
      name: `${candidate.firstName} ${candidate.lastName}`,
    });
    const jobDescription = redactAssessmentText(job.description, {});
    const result = await assessWithGateway({
      resumeText,
      jobDescription,
      model: process.env.AI_GATEWAY_MODEL,
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });
    if (result.status === "available") {
      await repo.recordAssessmentAudit({
        actorId: actor.id,
        jobId: job.id,
        applicationId: application.id,
        modelId: result.audit.returnedModel,
        promptVersion: result.audit.promptVersion,
        schemaVersion: result.audit.schemaVersion,
        evidenceCoveragePercent: result.evidenceCoveragePercent,
      });
    }
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
