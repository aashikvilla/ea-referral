import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth";
import { getReferralRepository } from "@/server/supabase-repository";
import { assertSameOrigin, fail, json } from "@/server/http";
import {
  cleanFileName,
  boundedFormData,
  documentType,
  SUPPORTING_MAX_BYTES,
  validateDocumentMagic,
} from "@/server/files/contracts";
import {
  HttpMalwareScanner,
  removePrivateObject,
  storePrivateObject,
} from "@/server/files/security";
import { verifyUploadIntake } from "@/server/files/intake-gate";

export const maxDuration = 15;

export async function POST(request: Request) {
  let storedPath: string | null = null;
  try {
    assertSameOrigin(request);
    const user = await requireUser(request);
    const form = await boundedFormData(request, SUPPORTING_MAX_BYTES);
    const repo = getReferralRepository();
    await verifyUploadIntake(form, repo);
    const value = form.get("file");
    if (
      !(value instanceof File) ||
      value.size < 1 ||
      value.size > SUPPORTING_MAX_BYTES
    )
      return json(
        {
          ok: false,
          code: "invalid_request",
          message: "Choose a supporting file no larger than 4 MiB.",
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

    const id = randomUUID();
    const storagePath = `${user.id}/${id}/${fileName}`;
    await storePrivateObject(storagePath, bytes, doc.contentType);
    storedPath = storagePath;
    const record = await repo.createStagedSupportFile({
      authUserId: user.id,
      storagePath,
      fileName,
      fileSize: bytes.byteLength,
      contentType: doc.contentType,
      scanStatus: scan.status,
    });
    storedPath = null;
    return json(
      {
        ok: true,
        file: {
          id: record.id,
          fileName: record.fileName,
          fileSize: record.fileSize,
          contentType: record.contentType,
          scanStatus: record.scanStatus,
        },
      },
      scan.status === "clean" ? 200 : 202,
    );
  } catch (error) {
    if (storedPath) await removePrivateObject(storedPath);
    return fail(error);
  }
}
