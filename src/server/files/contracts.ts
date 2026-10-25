import { ApiError } from "@/server/http";

// Stay below the managed serverless request body limit, including multipart headers.
export const RESUME_MAX_BYTES = 4 * 1024 * 1024;
export const SUPPORTING_MAX_BYTES = 4 * 1024 * 1024;
export const SUPPORTING_TOTAL_MAX_BYTES = 10 * 1024 * 1024;
export const MULTIPART_OVERHEAD_MAX_BYTES = 128 * 1024;

export type SupportedDocument = {
  extension: "pdf" | "docx";
  contentType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
};

const DOCUMENTS: Record<string, SupportedDocument> = {
  pdf: { extension: "pdf", contentType: "application/pdf" },
  "application/pdf": { extension: "pdf", contentType: "application/pdf" },
  docx: {
    extension: "docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

export type ContactFields = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export type ParsedContact = {
  fields: ContactFields;
  flags: Record<keyof ContactFields, boolean>;
  ready: boolean;
};

export function cleanFileName(value: string): string {
  const name = value
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .trim()
    .slice(-160);
  if (!name || name === "." || name === "..")
    throw new ApiError(400, "invalid_request", "Choose a valid file name.");
  return name;
}

export function documentType(
  fileName: string,
  mimeType: string,
): SupportedDocument {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const normalizedMime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const byExtension = DOCUMENTS[extension];
  const byMime = DOCUMENTS[normalizedMime];
  if (!byExtension || !byMime || byExtension.extension !== byMime.extension) {
    throw new ApiError(
      415,
      "invalid_request",
      "Upload a PDF or DOCX file whose name and file type match.",
    );
  }
  return byExtension;
}

export function validateDocumentMagic(
  bytes: Uint8Array,
  document: SupportedDocument,
): void {
  const isPdf =
    bytes.byteLength >= 8 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d &&
    (bytes[5] === 0x31 || bytes[5] === 0x32) &&
    bytes[6] === 0x2e;
  const isZip =
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  if (
    (document.extension === "pdf" && !isPdf) ||
    (document.extension === "docx" && !isZip)
  ) {
    throw new ApiError(
      415,
      "invalid_request",
      "The uploaded file content does not match its PDF or DOCX type.",
    );
  }
}

export async function boundedFormData(
  request: Request,
  maxFileBytes: number,
): Promise<FormData> {
  const maxBytes = maxFileBytes + MULTIPART_OVERHEAD_MAX_BYTES;
  const lengthHeader = request.headers.get("content-length");
  if (
    lengthHeader &&
    (!/^\d+$/.test(lengthHeader) ||
      !Number.isSafeInteger(Number(lengthHeader)) ||
      Number(lengthHeader) > maxBytes)
  ) {
    throw new ApiError(
      413,
      "invalid_request",
      "The uploaded file is too large.",
    );
  }
  if (!request.body)
    throw new ApiError(400, "invalid_request", "Upload form data is empty.");
  const reader = request.body.getReader();
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
        "The uploaded file is too large.",
      );
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    });
    return await bounded.formData();
  } catch {
    throw new ApiError(400, "invalid_request", "Upload form data is invalid.");
  }
}

export function parseContacts(text: string): ParsedContact {
  const content = text
    .normalize("NFKC")
    .replace(/\u0000/g, " ")
    .slice(0, 2_000_000);
  const lines = content
    .split(/[\r\n]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const labeled = (labels: string[]) => {
    const labelPattern = new RegExp(
      `^(?:${labels.join("|")})\\s*[:：-]\\s*(.{1,80})$`,
      "i",
    );
    for (const line of lines) {
      const match = labelPattern.exec(line);
      if (match) return match[1].trim().split(/[|,;]/)[0]?.trim() ?? null;
    }
    return null;
  };

  const emailMatch = content.match(
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/i,
  );
  const labeledPhone = lines.find((line) =>
    /^(?:phone|mobile|telephone|tel)\s*[:：-]/i.test(line),
  );
  const phonePattern =
    /(?:\+\s*\d{1,3}[ .-]?)?(?:\(\d{2,4}\)|\d{2,4})[ .-]?\d{3}[ .-]?\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?|\b\d{10,15}\b/i;
  const phoneMatch =
    labeledPhone?.match(phonePattern) ?? content.match(phonePattern);
  let firstName = labeled(["first(?:\\s+name)?", "given(?:\\s+name)?"]);
  let lastName = labeled([
    "last(?:\\s+name)?",
    "family(?:\\s+name)?",
    "surname",
  ]);
  if (!firstName || !lastName) {
    const headingLines = lines.slice(0, 8).map((line) =>
      line
        .replace(emailMatch?.[0] ?? "", " ")
        .replace(phoneMatch?.[0] ?? "", " ")
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/[|•,;]/g, " ")
        .trim(),
    );
    const headings = headingLines.filter((line) => {
      if (
        line.length > 80 ||
        /[@\d]|resume|curriculum|profile|linkedin|portfolio/i.test(line)
      )
        return false;
      const words = line.split(/\s+/);
      const likelyJobTitle =
        /\b(?:software|senior|junior|principal|lead|staff|engineer|developer|manager|designer|director|analyst|consultant|architect|scientist|producer|artist|intern|specialist|coordinator|recruiter|marketing|product|operations|technology|human|resources|business)\b/i;
      return (
        words.length === 2 &&
        !likelyJobTitle.test(line) &&
        words.every((word) => /^[\p{L}][\p{L}'’.-]*$/u.test(word))
      );
    });
    const heading = emailMatch && phoneMatch ? headings[0] : undefined;
    if (heading) {
      const words = heading.split(/\s+/);
      firstName ??= words[0] ?? null;
      lastName ??= words[words.length - 1] ?? null;
    }
  }
  const fields: ContactFields = {
    firstName,
    lastName,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0]?.trim() ?? null,
  };
  const flags = {
    firstName: Boolean(fields.firstName),
    lastName: Boolean(fields.lastName),
    email: Boolean(fields.email),
    phone: Boolean(fields.phone && fields.phone.replace(/\D/g, "").length >= 7),
  };
  return { fields, flags, ready: Object.values(flags).every(Boolean) };
}
