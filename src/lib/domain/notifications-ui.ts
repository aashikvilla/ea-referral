export type NotificationPreviewRecipient = {
  applicationId: string;
  firstName: string;
  email: string;
  jobTitle: string;
  subject: string;
  body: string;
  status: string;
  deliveryStatus: "ready" | "already_sent" | "in_progress" | "cancelled";
};

export type NotificationPreviewData = {
  group: "referred" | "remaining";
  jobId: string | null;
  eligibleCount: number;
  alreadySentCount: number;
  inProgressCount: number;
  cancelledCount: number;
  providerConfigured: boolean;
  approvalToken: string;
  recipients: NotificationPreviewRecipient[];
};

export type NotificationSendResult = {
  sent: number;
  failed: number;
  skipped: number;
  message: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function readNotificationPreview(
  value: unknown,
): NotificationPreviewData | null {
  const outer = record(value);
  const preview = record(outer?.preview);
  if (
    outer?.ok !== true ||
    !preview ||
    (preview.group !== "referred" && preview.group !== "remaining") ||
    !(preview.jobId === null || typeof preview.jobId === "string") ||
    !count(preview.eligibleCount) ||
    !count(preview.alreadySentCount) ||
    !count(preview.inProgressCount) ||
    !count(preview.cancelledCount) ||
    typeof preview.providerConfigured !== "boolean" ||
    typeof preview.approvalToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(preview.approvalToken) ||
    !Array.isArray(preview.recipients)
  )
    return null;

  const recipients: NotificationPreviewRecipient[] = [];
  for (const untrustedRecipient of preview.recipients) {
    const recipient = record(untrustedRecipient);
    if (
      !recipient ||
      [
        "applicationId",
        "firstName",
        "email",
        "jobTitle",
        "subject",
        "body",
        "status",
      ].some((key) => typeof recipient[key] !== "string") ||
      !["ready", "already_sent", "in_progress", "cancelled"].includes(
        String(recipient.deliveryStatus),
      )
    )
      return null;
    recipients.push({
      applicationId: recipient.applicationId as string,
      firstName: recipient.firstName as string,
      email: recipient.email as string,
      jobTitle: recipient.jobTitle as string,
      subject: recipient.subject as string,
      body: recipient.body as string,
      status: recipient.status as string,
      deliveryStatus:
        recipient.deliveryStatus as NotificationPreviewRecipient["deliveryStatus"],
    });
  }
  if (
    preview.eligibleCount +
      preview.alreadySentCount +
      preview.inProgressCount +
      preview.cancelledCount !==
    recipients.length
  )
    return null;

  return {
    group: preview.group,
    jobId: preview.jobId,
    eligibleCount: preview.eligibleCount,
    alreadySentCount: preview.alreadySentCount,
    inProgressCount: preview.inProgressCount,
    cancelledCount: preview.cancelledCount,
    providerConfigured: preview.providerConfigured,
    approvalToken: preview.approvalToken,
    recipients,
  };
}

export function readNotificationSendResult(
  value: unknown,
): NotificationSendResult | null {
  const result = record(value);
  if (
    result?.ok !== true ||
    !count(result.sent) ||
    !count(result.failed) ||
    !count(result.skipped) ||
    typeof result.message !== "string"
  )
    return null;
  return {
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    message: result.message,
  };
}
