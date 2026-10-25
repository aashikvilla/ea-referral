import { requireUser } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { assertSameOrigin, ApiError, fail, json } from "@/server/http";
import {
  documentType,
  parseContacts,
  RESUME_MAX_BYTES,
  validateDocumentMagic,
  type ParsedContact,
} from "@/server/files/contracts";
import { PdfDocxParser } from "@/server/files/parser";
import { HttpMalwareScanner, readPrivateObject } from "@/server/files/security";
import type { ResumeRecordInput } from "@/server/repository";

export const maxDuration = 15;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = getReferralRepository();
    const resume = await repo.getResumeForOwner(id, user.id);
    if (!resume)
      throw new ApiError(404, "not_found", "Resume upload was not found.");
    const doc = documentType(resume.fileName, resume.contentType);
    const bytes = await readPrivateObject(resume.storagePath, RESUME_MAX_BYTES);
    validateDocumentMagic(bytes, doc);
    const scan = await new HttpMalwareScanner().scan(
      bytes,
      resume.fileName,
      doc.contentType,
    );
    let parsed: ParsedContact = {
      fields: { firstName: null, lastName: null, email: null, phone: null },
      flags: { firstName: false, lastName: false, email: false, phone: false },
      ready: false,
    };
    let parserStatus: ResumeRecordInput["parserStatus"] = "unavailable";
    if (scan.status === "clean") {
      try {
        parsed = parseContacts(
          await new PdfDocxParser().extractText(bytes, doc),
        );
        parserStatus = parsed.ready ? "ready" : "correction_required";
      } catch {
        parserStatus = "correction_required";
      }
    } else if (scan.status === "malicious") {
      parserStatus = "failed";
    }
    const updated = await repo.updateResumeValidation(id, user.id, {
      parserStatus,
      parsedFields: parsed.flags,
      scanStatus: scan.status === "malicious" ? "rejected" : scan.status,
    });
    return json(
      {
        ok: true,
        resume: {
          id: updated.id,
          fileName: updated.fileName,
          fileSize: updated.fileSize,
          contentType: updated.contentType,
          version: updated.version,
          parserStatus: updated.parserStatus,
          scanStatus: updated.scanStatus,
          readiness: {
            ready:
              updated.parserStatus === "ready" &&
              updated.scanStatus === "clean" &&
              Object.values(updated.parsedFields).every(Boolean),
            fields: updated.parsedFields,
            missingFields: Object.entries(updated.parsedFields)
              .filter(([, present]) => !present)
              .map(([field]) => field),
          },
          extracted: parsed.fields,
        },
      },
      scan.status === "clean" ? 200 : 202,
    );
  } catch (error) {
    return fail(error);
  }
}
