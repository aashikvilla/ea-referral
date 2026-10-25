import type {
  Application,
  Candidate,
  CreateApplicationInput,
} from "@/lib/demo/types";

export const MAX_NOTE_LENGTH = 500;
export const MAX_SHOWCASE_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_SHOWCASE_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);
const SUPPORTED_RESUME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const SHOWCASE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function validateEaJobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      url.hostname === "jobs.ea.com" &&
      /^\/(?:[a-z]{2}_[A-Z]{2}\/)?careers\/JobDetail\/(?:[A-Za-z0-9-]+\/)?\d+\/?$/i.test(
        url.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function normalizeCanonicalJobId(value: string): string | null {
  const normalized = value.trim();
  const direct = /^(?:EA:)?(\d+)$/i.exec(normalized);
  if (direct) return `EA:${direct[1]}`;
  if (!validateEaJobUrl(normalized)) return null;
  const match = /\/(\d+)\/?$/.exec(new URL(normalized).pathname);
  return match ? `EA:${match[1]}` : null;
}

export function validateApplicationInput(
  input: CreateApplicationInput,
): string | null {
  if (!input.jobId.trim()) return "Choose a job before continuing.";
  if (!input.candidate.firstName.trim() || !input.candidate.lastName.trim())
    return "Enter your first and last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.candidate.email))
    return "Enter a valid email address.";
  if (!input.resume.fileName || input.resume.fileSize <= 0)
    return "Add a resume to continue.";
  if (Object.values(input.resume.fields).some((field) => !field))
    return "Your resume needs readable first name, last name, email, and phone fields.";
  if (Array.from(input.showcase?.note ?? "").length > MAX_NOTE_LENGTH)
    return `Keep the optional note to ${MAX_NOTE_LENGTH} characters or fewer.`;
  if (!input.candidate.country.trim()) return "Choose your country.";
  if (input.candidate.phone.replace(/\D/g, "").length < 7)
    return "Enter a valid phone number.";
  const resumeExtension = input.resume.fileName.split(".").pop()?.toLowerCase();
  if (!(
    resumeExtension &&
    SUPPORTED_RESUME_TYPES[resumeExtension] === input.resume.fileType
  ))
    return "Use a PDF or DOCX resume with a matching file type.";
  if (!Number.isFinite(input.resume.fileSize) || input.resume.fileSize <= 0)
    return "Check the resume file size and try again.";
  const fileBytes =
    input.showcase?.files?.reduce((sum, file) => sum + file.size, 0) ?? 0;
  if (fileBytes > MAX_SHOWCASE_FILE_BYTES)
    return "Optional showcase files must total 10 MB or less.";
  for (const file of input.showcase?.files ?? []) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !SUPPORTED_SHOWCASE_EXTENSIONS.has(extension))
      return "Use PDF, DOCX, TXT, PNG, JPG, JPEG, or WEBP for optional work samples.";
    if (!Number.isFinite(file.size) || file.size <= 0)
      return "Check each optional file size and try again.";
    if (file.type && file.type !== SHOWCASE_TYPES[extension])
      return "Make sure each optional file name and type match.";
  }
  for (const link of input.showcase?.links ?? []) {
    try {
      const url = new URL(link);
      if (url.protocol !== "https:")
        return "Use secure HTTPS links for optional work samples.";
    } catch {
      return "Check the optional work sample link and try again.";
    }
  }
  return null;
}

export function hasDuplicateApplication(
  jobId: string,
  email: string,
  applications: Application[],
  candidates: Candidate[],
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return applications.some(
    (application) =>
      application.jobId === jobId &&
      candidates.some(
        (candidate) =>
          candidate.id === application.candidateId &&
          candidate.email.trim().toLowerCase() === normalizedEmail,
      ),
  );
}
