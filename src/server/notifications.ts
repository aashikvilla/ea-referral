import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Application, Job } from "@/lib/demo/types";
import { ApiError } from "@/server/http";
import type {
  NewNotificationOutboxEntry,
  ReferralRepository,
} from "@/server/repository";

export type NotificationGroup = "referred" | "remaining";
type NotificationRecipient = {
  application: Application;
  email: string;
  firstName: string;
  job: Job;
  template: "referral_confirmed" | "slot_filled_other";
  idempotencyKey: string;
  subject: string;
  body: string;
};

export type NotificationPreview = {
  group: NotificationGroup;
  jobId: string | null;
  eligibleCount: number;
  alreadySentCount: number;
  inProgressCount: number;
  cancelledCount: number;
  providerConfigured: boolean;
  approvalToken: string;
  recipients: Array<{
    applicationId: string;
    firstName: string;
    email: string;
    jobTitle: string;
    subject: string;
    body: string;
    status: string;
    deliveryStatus: "ready" | "already_sent" | "in_progress" | "cancelled";
  }>;
};

function cleanText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

function notificationTemplate(
  group: NotificationGroup,
  firstName: string,
  job: Job,
): {
  template: NotificationRecipient["template"];
  subject: string;
  body: string;
} {
  const greeting = cleanText(firstName, 80) || "there";
  const title = cleanText(job.title, 200) || "this EA role";
  if (group === "referred") {
    return {
      template: "referral_confirmed",
      subject: `Referral confirmed for ${title}`,
      body: `Hi ${greeting},\n\nI confirmed that I submitted your referral for ${title} through EA's referral portal. This confirms the referral submission only; it does not guarantee an interview or offer.\n\nBest,\nYour EA contact`,
    };
  }
  return {
    template: "slot_filled_other",
    subject: `An update about ${title}`,
    body: `Hi ${greeting},\n\nThank you for your interest in a referral for ${title}. I confirmed a referral for this opening and can refer one person per EA job ID, so I’m unable to refer additional candidates for this role. I appreciate the time you took to apply and wish you the best.\n\nBest,\nYour EA contact`,
  };
}

function providerConfig(): { apiKey: string; fromEmail: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  return apiKey && fromEmail ? { apiKey, fromEmail } : null;
}

async function currentRecipients(
  repository: ReferralRepository,
  actorId: string,
  group: NotificationGroup,
  jobId: string | null,
): Promise<{ recipients: NotificationRecipient[]; approvalToken: string }> {
  const workspace = await repository.getWorkspace();
  const jobs = new Map(workspace.jobs.map((job) => [job.id, job]));
  const candidates = new Map(
    workspace.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const confirmedJobIds = new Set(
    workspace.slots
      .filter((slot) => slot.status === "confirmed" && slot.applicationId)
      .map((slot) => slot.jobId),
  );
  const confirmedApplicationIds = new Set(
    workspace.slots
      .filter((slot) => slot.status === "confirmed" && slot.applicationId)
      .map((slot) => slot.applicationId),
  );
  const referredApplications = workspace.applications.filter(
    (application) =>
      application.status === "referral_confirmed" &&
      confirmedApplicationIds.has(application.id),
  );
  const hasConfirmedReferral = (candidateJobId: string) =>
    confirmedJobIds.has(candidateJobId) &&
    referredApplications.some(
      (application) => application.jobId === candidateJobId,
    );
  const source = workspace.applications.filter((application) => {
    if (jobId && application.jobId !== jobId) return false;
    if (!hasConfirmedReferral(application.jobId)) return false;
    if (group === "referred")
      return (
        application.status === "referral_confirmed" &&
        confirmedApplicationIds.has(application.id)
      );
    return application.status === "slot_filled_other";
  });
  const seenEmails = new Set<string>();
  const recipients: NotificationRecipient[] = [];
  for (const application of source) {
    const candidate = candidates.get(application.candidateId);
    const job = jobs.get(application.jobId);
    const email = candidate ? safeEmail(candidate.email) : null;
    if (!candidate || !job || !email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    const template = notificationTemplate(group, candidate.firstName, job);
    recipients.push({
      application,
      email,
      firstName: cleanText(candidate.firstName, 80) || "there",
      job,
      ...template,
      idempotencyKey: `ea-notify:${group}:${job.id}:${application.id}`,
    });
  }

  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret)
    throw new ApiError(
      503,
      "unavailable",
      "Notification approval is unavailable.",
    );
  const approvalToken = createHmac("sha256", secret)
    .update(
      JSON.stringify({
        actorId,
        group,
        jobId,
        recipients: recipients.map(({ application, email, subject, body }) => ({
          applicationId: application.id,
          jobId: application.jobId,
          status: application.status,
          email,
          subject,
          body,
        })),
      }),
    )
    .digest("hex");
  return { recipients, approvalToken };
}

export async function previewNotifications(
  repository: ReferralRepository,
  actorId: string,
  group: NotificationGroup,
  jobId: string | null,
): Promise<NotificationPreview> {
  const { recipients, approvalToken } = await currentRecipients(
    repository,
    actorId,
    group,
    jobId,
  );
  const existing = await repository.listNotificationOutbox(
    recipients.map((recipient) => recipient.idempotencyKey),
  );
  const byKey = new Map(existing.map((entry) => [entry.idempotencyKey, entry]));
  const alreadySentCount = recipients.filter(
    (recipient) => byKey.get(recipient.idempotencyKey)?.status === "sent",
  ).length;
  const inProgressCount = recipients.filter(
    (recipient) => byKey.get(recipient.idempotencyKey)?.status === "sending",
  ).length;
  const cancelledCount = recipients.filter(
    (recipient) => byKey.get(recipient.idempotencyKey)?.status === "cancelled",
  ).length;
  return {
    group,
    jobId,
    eligibleCount:
      recipients.length - alreadySentCount - inProgressCount - cancelledCount,
    alreadySentCount,
    inProgressCount,
    cancelledCount,
    providerConfigured: providerConfig() !== null,
    approvalToken,
    recipients: recipients.map((recipient) => ({
      applicationId: recipient.application.id,
      firstName: recipient.firstName,
      email: recipient.email,
      jobTitle: recipient.job.title,
      subject: recipient.subject,
      body: recipient.body,
      status: recipient.application.status,
      deliveryStatus: (() => {
        const status = byKey.get(recipient.idempotencyKey)?.status;
        if (status === "sent") return "already_sent" as const;
        if (status === "sending") return "in_progress" as const;
        if (status === "cancelled") return "cancelled" as const;
        return "ready" as const;
      })(),
    })),
  };
}

export async function sendApprovedNotifications(
  repository: ReferralRepository,
  actorId: string,
  group: NotificationGroup,
  jobId: string | null,
  approvalToken: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const provider = providerConfig();
  if (!provider)
    throw new ApiError(
      503,
      "unavailable",
      "Email delivery needs RESEND_API_KEY and RESEND_FROM_EMAIL configured.",
    );

  const { recipients, approvalToken: currentToken } = await currentRecipients(
    repository,
    actorId,
    group,
    jobId,
  );
  const provided = Buffer.from(approvalToken, "utf8");
  const expected = Buffer.from(currentToken, "utf8");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw new ApiError(
      409,
      "conflict",
      "Recipients changed after preview. Review the updated notification preview before sending.",
    );
  }

  const entries: NewNotificationOutboxEntry[] = recipients.map((recipient) => ({
    idempotencyKey: recipient.idempotencyKey,
    recipientEmail: recipient.email,
    template: recipient.template,
    payload: {
      applicationId: recipient.application.id,
      jobId: recipient.job.id,
      subject: recipient.subject,
      body: recipient.body,
      approvedBy: actorId,
      approvedAt: new Date().toISOString(),
      approvalToken,
    },
  }));
  await repository.enqueueNotifications(entries);
  const stored = await repository.listNotificationOutbox(
    recipients.map((recipient) => recipient.idempotencyKey),
  );
  const byKey = new Map(stored.map((entry) => [entry.idempotencyKey, entry]));
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    const entry = byKey.get(recipient.idempotencyKey);
    if (!entry || entry.status === "sent" || entry.status === "cancelled") {
      skipped++;
      continue;
    }
    const claimed = await repository.claimNotification(entry.id);
    if (!claimed) {
      skipped++;
      continue;
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": recipient.idempotencyKey,
        },
        body: JSON.stringify({
          from: provider.fromEmail,
          to: [recipient.email],
          subject: recipient.subject,
          text: recipient.body,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Email provider rejected the message.");
      await repository.updateNotificationStatus(entry.id, "sent");
      sent++;
    } catch {
      try {
        await repository.updateNotificationStatus(entry.id, "failed");
      } catch {
        // Keep the original delivery failure as the response; the durable row
        // stays in `sending` if the status update itself is unavailable.
      }
      failed++;
    }
  }
  return { sent, failed, skipped };
}
