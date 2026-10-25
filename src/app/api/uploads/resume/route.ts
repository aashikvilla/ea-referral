import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { assertSameOrigin, fail, json } from "@/server/http";
import {
  cleanFileName,
  boundedFormData,
  documentType,
  parseContacts,
  RESUME_MAX_BYTES,
  validateDocumentMagic,
  type ParsedContact,
} from "@/server/files/contracts";
import { PdfDocxParser } from "@/server/files/parser";
import { verifyUploadIntake } from "@/server/files/intake-gate";
import {
  HttpMalwareScanner,
  removePrivateObject,
  storePrivateObject,
} from "@/server/files/security";
import type { ResumeRecordInput } from "@/server/repository";

export const maxDuration = 15;

const EMPTY_FLAGS = {
  firstName: false,
  lastName: false,
  email: false,
  phone: false,
};

export async function POST(request: Request) {
  let storedPath: string | null = null;
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const form = await boundedFormData(request, RESUME_MAX_BYTES);
    const repo = getReferralRepository();
    const jobId = await verifyUploadIntake(form, repo);
    const value = form.get("file");
    if (
      !(value instanceof File) ||
      value.size < 1 ||
      value.size > RESUME_MAX_BYTES
    )
      return json(
        {
          ok: false,
          code: "invalid_request",
          message: "Choose a resume no larger than 4 MiB.",
        },
        413,
      );
    const fileName = cleanFileName(value.name);
    const doc = documentType(fileName, value.type);
    const bytes = new Uint8Array(await value.arrayBuffer());
    validateDocumentMagic(bytes, doc);

    const scan = await new HttpMalwareScanner().scan(
      bytes,
      fileName,
      doc.contentType,
    );
    if (scan.status === "malicious")
      return json(
        {
          ok: false,
          code: "invalid_request",
          message: "The uploaded file did not pass the malware scan.",
        },
        422,
      );

    let parsed: ParsedContact = {
      fields: { firstName: null, lastName: null, email: null, phone: null },
      flags: EMPTY_FLAGS,
      ready: false,
    };
    let parserStatus: ResumeRecordInput["parserStatus"] = "unavailable";
    if (scan.status === "clean") {
      try {
        const text = await new PdfDocxParser().extractText(bytes, doc);
        parsed = parseContacts(text);
        parserStatus = parsed.ready ? "ready" : "correction_required";
      } catch {
        parserStatus = "correction_required";
      }
    }

    const id = randomUUID();
    const storagePath = `${user.id}/${id}/${fileName}`;
    await storePrivateObject(storagePath, bytes, doc.contentType);
    storedPath = storagePath;
    const record = await repo.createResume({
      authUserId: user.id,
      jobId,
      storagePath,
      fileName,
      fileSize: bytes.byteLength,
      contentType: doc.contentType,
      version: 1,
      parserStatus,
      parsedFields: parsed.flags,
      scanStatus: scan.status,
    });
    storedPath = null;
    const missingFields = Object.entries(parsed.flags)
      .filter(([, present]) => !present)
      .map(([field]) => field);
    return json(
      {
        ok: true,
        resume: {
          id: record.id,
          fileName: record.fileName,
          fileSize: record.fileSize,
          contentType: record.contentType,
          version: record.version,
          parserStatus: record.parserStatus,
          scanStatus: record.scanStatus,
          readiness: {
            ready:
              record.parserStatus === "ready" &&
              record.scanStatus === "clean" &&
              Object.values(record.parsedFields).every(Boolean),
            fields: record.parsedFields,
            missingFields,
          },
          extracted: parsed.fields,
        },
      },
      scan.status === "clean" ? 200 : 202,
    );
  } catch (error) {
    if (storedPath) await removePrivateObject(storedPath);
    return fail(error);
  }
}
