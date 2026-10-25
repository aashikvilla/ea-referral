"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWorkspace } from "@/lib/demo/workspace";
import {
  readNotificationPreview,
  readNotificationSendResult,
  type NotificationPreviewData,
  type NotificationSendResult,
} from "@/lib/domain/notifications-ui";
import type { Application } from "@/lib/demo/types";

const card =
  "rounded-2xl border border-[#dce5df] bg-white shadow-[0_3px_12px_rgba(24,56,47,0.035)]";
const button =
  "inline-flex items-center justify-center rounded-xl bg-[#1c5545] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174738] disabled:cursor-not-allowed disabled:opacity-45";
const secondary =
  "inline-flex items-center justify-center rounded-xl border border-[#d5e0da] bg-white px-4 py-2.5 text-sm font-semibold text-[#28473c] transition hover:bg-[#f4f8f5] disabled:cursor-not-allowed disabled:opacity-45";
const input =
  "w-full rounded-xl border border-[#d6e1da] bg-white px-3.5 py-2.5 text-sm text-[#23382f] outline-none focus:border-[#568b73] focus:ring-2 focus:ring-[#d8ebe0]";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="border-b border-[#edf1ee] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#234338]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Notice({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${warning ? "border-[#eadbb8] bg-[#fcf6e9] text-[#785f32]" : "border-[#d5e6db] bg-[#eff7f1] text-[#426a53]"}`}
    >
      {children}
    </div>
  );
}

function DeliveryPill({
  label,
  sent = false,
}: {
  label: string;
  sent?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${sent ? "bg-[#e7f3eb] text-[#326b4d]" : "bg-[#edf1ef] text-[#5e6e65]"}`}
    >
      {label}
    </span>
  );
}

function errorMessage(body: unknown, fallback: string): string {
  return body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
    ? body.message
    : fallback;
}

function localMessage(
  group: "remaining" | "referred",
  firstName: string,
  jobTitle: string,
) {
  return group === "referred"
    ? `Hi ${firstName},\n\nI confirmed your referral submission for ${jobTitle} through EA’s referral portal. This does not guarantee an interview or offer.\n\nBest,\nYour EA contact`
    : `Hi ${firstName},\n\nThank you for your interest in ${jobTitle}. I confirmed a referral for this opening and can refer one person per EA job ID, so I’m unable to refer additional candidates for this role. I appreciate the time you took to apply.\n\nBest,\nYour EA contact`;
}

export default function NotificationReview() {
  const { jobs, candidates, applications, mode, session } = useWorkspace();
  const [jobId, setJobId] = useState("");
  const [group, setGroup] = useState<"remaining" | "referred">("remaining");
  const [preview, setPreview] = useState<NotificationPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState<NotificationSendResult | null>(
    null,
  );
  const [resultRecipients, setResultRecipients] = useState<
    NotificationPreviewData["recipients"]
  >([]);
  const previewRequestId = useRef(0);
  const connectedOwner = mode === "connected" && session?.isAdmin === true;

  const loadPreview = useCallback(async () => {
    if (!connectedOwner) return;
    const requestId = ++previewRequestId.current;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          group,
          ...(jobId ? { jobId } : {}),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      const parsed = response.ok ? readNotificationPreview(body) : null;
      if (!parsed)
        throw new Error(
          errorMessage(
            body,
            "The current notification preview could not be verified.",
          ),
        );
      if (requestId !== previewRequestId.current) return;
      setPreview(parsed);
    } catch (error) {
      if (requestId !== previewRequestId.current) return;
      setPreview(null);
      setPreviewError(
        error instanceof Error
          ? error.message
          : "The notification preview is unavailable.",
      );
    } finally {
      if (requestId === previewRequestId.current) setPreviewLoading(false);
    }
  }, [connectedOwner, group, jobId]);

  useEffect(() => {
    if (!connectedOwner) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void loadPreview();
    });
    return () => {
      active = false;
    };
  }, [connectedOwner, group, jobId, loadPreview]);

  async function approveAndSend() {
    if (!connectedOwner || !preview?.providerConfigured) return;
    const approvedPreview = preview;
    setSending(true);
    setSendError("");
    setSendResult(null);
    setResultRecipients(approvedPreview.recipients);
    setApprovalOpen(false);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "send",
          group,
          ...(jobId ? { jobId } : {}),
          approved: true,
          approvalToken: approvedPreview.approvalToken,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      const result = response.ok ? readNotificationSendResult(body) : null;
      if (!result)
        throw new Error(
          errorMessage(
            body,
            "The send result could not be verified. No successful delivery is being reported.",
          ),
        );
      setSendResult(result);
      await loadPreview();
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Sending could not be verified. No successful delivery is being reported.",
      );
    } finally {
      setSending(false);
    }
  }

  const localRecipients: Array<{
    app: Application;
    firstName: string;
    email: string;
    title: string;
    body: string;
  }> = (() => {
    const scoped = applications.filter((app) => !jobId || app.jobId === jobId);
    const confirmed = scoped.filter(
      (app) => app.status === "referral_confirmed",
    );
    const source =
      group === "referred"
        ? confirmed
        : scoped.filter(
            (app) =>
              ![
                "referral_confirmed",
                "not_selected",
                "slot_filled_other",
                "selected_pending_submission",
              ].includes(app.status),
          );
    const seen = new Set<string>();
    return source.flatMap((app) => {
      const candidate = candidates.find((item) => item.id === app.candidateId);
      const job = jobs.find((item) => item.id === app.jobId);
      const email = candidate?.email.trim().toLowerCase();
      if (!candidate || !job || !email || seen.has(email)) return [];
      seen.add(email);
      return [
        {
          app,
          firstName: candidate.firstName,
          email: candidate.email,
          title: job.title,
          body: localMessage(group, candidate.firstName || "there", job.title),
        },
      ];
    });
  })();

  const displayedRecipients =
    mode === "demo"
      ? localRecipients.map((recipient) => ({
          applicationId: recipient.app.id,
          firstName: recipient.firstName,
          email: recipient.email,
          jobTitle: recipient.title,
          subject:
            group === "referred"
              ? `Referral confirmed for ${recipient.title}`
              : `An update about ${recipient.title}`,
          body: recipient.body,
          status: recipient.app.status,
          deliveryStatus: "ready" as const,
        }))
      : connectedOwner
        ? (preview?.recipients ?? [])
        : [];
  const readyCount =
    mode === "demo" ? localRecipients.length : (preview?.eligibleCount ?? 0);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="mb-7">
        <p className="text-[11px] font-bold tracking-[0.17em] text-[#648274] uppercase">
          Owner workspace · Communications
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#18382f] sm:text-[2.15rem]">
          Notification review
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7b73]">
          {mode === "demo"
            ? "Preview fictional local messages. The browser demo never sends email."
            : "Review current database recipients and message text before approving email delivery."}
        </p>
      </div>

      {mode === "demo" ? (
        <div className="mb-5">
          <Notice warning>
            Demo mode uses fictional local records only. Sending is disabled and
            nothing is queued or delivered.
          </Notice>
        </div>
      ) : !connectedOwner ? (
        <div className="mb-5">
          <Notice warning>
            Notification review requires a verified owner session. No messages
            have been queued or sent.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <Panel title="Recipients">
          <label className="mb-3 block text-xs font-semibold text-[#63756b]">
            Job
            <select
              className={`${input} mt-1`}
              value={jobId}
              onChange={(event) => {
                setJobId(event.target.value);
                setPreview(null);
                setSendResult(null);
                setResultRecipients([]);
                setSendError("");
                setApprovalOpen(false);
              }}
            >
              <option value="">All jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-4 block text-xs font-semibold text-[#63756b]">
            Message group
            <select
              className={`${input} mt-1`}
              value={group}
              onChange={(event) => {
                setGroup(event.target.value as "remaining" | "referred");
                setPreview(null);
                setSendResult(null);
                setResultRecipients([]);
                setSendError("");
                setApprovalOpen(false);
              }}
            >
              <option value="remaining">Other applicants</option>
              <option value="referred">Referred candidate</option>
            </select>
          </label>

          {mode === "connected" && previewLoading ? (
            <p className="text-sm text-[#74827a]" role="status">
              Loading current recipients…
            </p>
          ) : null}
          {mode === "connected" && previewError ? (
            <p className="text-sm text-[#984b3e]" role="alert">
              {previewError}
            </p>
          ) : null}
          {mode === "connected" && !connectedOwner ? (
            <p className="text-sm text-[#74827a]">
              Sign in with the verified owner account to load recipients.
            </p>
          ) : null}
          {mode === "connected" &&
          connectedOwner &&
          !previewLoading &&
          !previewError &&
          !displayedRecipients.length ? (
            <p className="text-sm text-[#74827a]">
              The server found no current recipients in this group.
            </p>
          ) : null}
          <p className="mt-3 mb-2 text-xs text-[#87938c]">
            {mode === "demo"
              ? `${localRecipients.length} fictional sample recipients`
              : `${preview?.eligibleCount ?? 0} ready · ${preview?.alreadySentCount ?? 0} already sent · ${preview?.inProgressCount ?? 0} in progress`}
          </p>
          <div className="max-h-[520px] space-y-2 overflow-auto">
            {displayedRecipients.map((recipient) => (
              <div
                key={recipient.applicationId}
                className="rounded-xl border border-[#edf1ee] p-3"
              >
                <p className="text-sm font-medium text-[#385548]">
                  {recipient.firstName} · {recipient.jobTitle}
                </p>
                <p className="mt-1 text-xs text-[#87938c]">{recipient.email}</p>
                {mode === "connected" && (
                  <div className="mt-2">
                    <DeliveryPill
                      label={recipient.deliveryStatus.replaceAll("_", " ")}
                      sent={recipient.deliveryStatus === "already_sent"}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Message previews">
            {mode === "connected" && previewLoading ? (
              <p className="text-sm text-[#74827a]" role="status">
                Loading server-generated message previews…
              </p>
            ) : null}
            {mode === "connected" && previewError ? (
              <Notice warning>
                {previewError} No send action is available until a current
                preview loads.
              </Notice>
            ) : null}
            {mode === "connected" && !connectedOwner ? (
              <p className="text-sm text-[#74827a]">
                Owner access is required to load server-generated messages.
              </p>
            ) : null}
            {mode === "connected" && preview && !preview.providerConfigured && (
              <div className="mb-4">
                <Notice warning>
                  Email sending is not configured. The server will not queue or
                  report delivery until provider settings are present.
                </Notice>
              </div>
            )}
            {!displayedRecipients.length &&
            !(mode === "connected" && previewLoading) ? (
              <p className="text-sm text-[#74827a]">
                No message previews for this group.
              </p>
            ) : null}
            <div className="space-y-3">
              {displayedRecipients.map((recipient) => (
                <article
                  key={recipient.applicationId}
                  className="rounded-xl border border-[#e7ece8] bg-[#fbfcfb] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#385548]">
                        To: {recipient.firstName} · {recipient.email}
                      </p>
                      <p className="mt-1 text-xs text-[#849188]">
                        {recipient.subject}
                      </p>
                    </div>
                    <DeliveryPill
                      label={recipient.status.replaceAll("_", " ")}
                    />
                  </div>
                  <pre className="font-sans text-sm leading-7 whitespace-pre-wrap text-[#53665b]">
                    {recipient.body}
                  </pre>
                </article>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#87938c]">
                {mode === "demo"
                  ? "Local sample preview · no messages queued"
                  : "Server preview is bound to this recipient and message snapshot."}
              </p>
              {mode === "connected" && connectedOwner && (
                <div className="flex gap-2">
                  <button
                    className={secondary}
                    disabled={previewLoading || sending}
                    onClick={() => void loadPreview()}
                  >
                    Refresh preview
                  </button>
                  <button
                    className={button}
                    disabled={
                      !preview?.providerConfigured ||
                      !readyCount ||
                      previewLoading ||
                      sending
                    }
                    onClick={() => setApprovalOpen(true)}
                  >
                    {sending ? "Sending…" : "Review and approve send"}
                  </button>
                </div>
              )}
              {mode === "demo" && (
                <button
                  className={button}
                  disabled
                  title="Demo mode never sends email"
                >
                  Send disabled
                </button>
              )}
            </div>
          </Panel>

          {sendError && (
            <div role="alert">
              <Notice warning>
                {sendError} No successful delivery is reported from an
                unavailable or invalid response.
              </Notice>
            </div>
          )}
          {sendResult && connectedOwner && (
            <Panel title="Latest send result">
              <Notice>
                Server report: {sendResult.sent} sent, {sendResult.failed}{" "}
                failed, {sendResult.skipped} skipped. Email delivery does not
                change candidate statuses.
              </Notice>
              {sendResult.failed > 0 && (
                <p className="mt-3 text-sm leading-6 text-[#785f32]">
                  The API reports {sendResult.failed} failure(s) but does not
                  identify failed recipient IDs. Each person below is shown as
                  sent only if the refreshed outbox preview confirms it; the
                  rest remain unconfirmed.
                </p>
              )}
              <div className="mt-4 space-y-2">
                {resultRecipients.map((recipient) => {
                  const latest = preview?.recipients.find(
                    (item) => item.applicationId === recipient.applicationId,
                  );
                  const sent = latest?.deliveryStatus === "already_sent";
                  const label = sent
                    ? "Sent"
                    : latest?.deliveryStatus === "in_progress"
                      ? "Sending"
                      : latest?.deliveryStatus === "cancelled"
                        ? "Cancelled"
                        : sendResult.failed
                          ? "Delivery not confirmed"
                          : "Not sent";
                  return (
                    <div
                      key={recipient.applicationId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#edf1ee] px-3 py-2"
                    >
                      <span className="text-sm text-[#385548]">
                        {recipient.firstName} · {recipient.email}
                      </span>
                      <DeliveryPill label={label} sent={sent} />
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {approvalOpen && preview && connectedOwner && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#17352e]/35 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-approval-title"
            className={`${card} w-full max-w-xl p-6`}
          >
            <p className="text-[11px] font-bold tracking-[0.17em] text-[#648274] uppercase">
              Explicit send approval
            </p>
            <h2
              id="notification-approval-title"
              className="mt-2 text-xl font-semibold text-[#244638]"
            >
              Approve {preview.eligibleCount} email
              {preview.eligibleCount === 1 ? "" : "s"}?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6b7b72]">
              The server will use current database recipients for{" "}
              {group === "referred"
                ? "the referred candidate"
                : "other applicants"}
              {jobId
                ? ` on ${jobs.find((job) => job.id === jobId)?.title ?? "the selected job"}`
                : " across all jobs"}
              . It will verify this exact preview again before queueing. Email
              delivery does not change candidate statuses.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#385548]">
              {preview.eligibleCount} ready · {preview.alreadySentCount} already
              sent · {preview.inProgressCount} in progress
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className={secondary}
                disabled={sending}
                onClick={() => setApprovalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={button}
                disabled={sending || !preview.providerConfigured}
                onClick={() => void approveAndSend()}
              >
                {sending ? "Sending…" : "Approve and send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
