import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  previewNotifications,
  sendApprovedNotifications,
} from "../src/server/notifications.ts";
import { POST as adminNotifications } from "../src/app/api/admin/notifications/route.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const JOB_ID = "00000000-0000-4000-8000-000000000010";

function fixtureRepository() {
  const queue = new Map();
  const workspace = {
    jobs: [
      {
        id: JOB_ID,
        title: "Data Science Intern",
        canonicalJobId: "EA:123",
      },
    ],
    candidates: [
      { id: "candidate-1", firstName: "Alex", email: "alex@example.invalid" },
      { id: "candidate-2", firstName: "Sam", email: "sam@example.invalid" },
      { id: "candidate-3", firstName: "Jo", email: "jo@example.invalid" },
      { id: "candidate-4", firstName: "Lee", email: "lee@example.invalid" },
    ],
    applications: [
      {
        id: "app-referred",
        jobId: JOB_ID,
        candidateId: "candidate-1",
        status: "referral_confirmed",
      },
      {
        id: "app-other",
        jobId: JOB_ID,
        candidateId: "candidate-2",
        status: "slot_filled_other",
      },
      {
        id: "app-declined",
        jobId: JOB_ID,
        candidateId: "candidate-3",
        status: "not_selected",
      },
      {
        id: "app-unconfirmed",
        jobId: JOB_ID,
        candidateId: "candidate-4",
        status: "referral_confirmed",
      },
    ],
    slots: [
      { jobId: JOB_ID, status: "confirmed", applicationId: "app-referred" },
    ],
  };
  return {
    queue,
    workspace,
    async getWorkspace() {
      return workspace;
    },
    async listNotificationOutbox(keys) {
      return [...queue.values()].filter((entry) =>
        keys.includes(entry.idempotencyKey),
      );
    },
    async enqueueNotifications(entries) {
      for (const entry of entries) {
        if (!queue.has(entry.idempotencyKey)) {
          queue.set(entry.idempotencyKey, {
            id: `outbox-${queue.size + 1}`,
            idempotencyKey: entry.idempotencyKey,
            status: "pending",
            payload: entry.payload,
          });
        }
      }
    },
    async claimNotification(id) {
      const entry = [...queue.values()].find((value) => value.id === id);
      if (!entry || !["pending", "failed"].includes(entry.status)) return false;
      entry.status = "sending";
      return true;
    },
    async updateNotificationStatus(id, status) {
      const entry = [...queue.values()].find((value) => value.id === id);
      if (entry) entry.status = status;
    },
  };
}

function configureEmail() {
  process.env.EA_REFERRAL_MODE = "connected";
  process.env.SUPABASE_URL = "https://demo-project.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_value";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_value";
  process.env.ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
  process.env.APP_ORIGIN = "https://referral.example.invalid";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "EA Referrals <referrals@example.invalid>";
}

test("notification API requires owner authentication before reading or sending", async () => {
  configureEmail();
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/auth\/v1\/user$/);
    return Response.json({
      id: "00000000-0000-4000-8000-000000000002",
      email: "other@example.invalid",
      email_confirmed_at: "2026-10-24T00:00:00.000Z",
    });
  };
  const response = await adminNotifications(
    new Request("https://referral.example.invalid/api/admin/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://referral.example.invalid",
        authorization: "Bearer signed.jwt.token",
      },
      body: JSON.stringify({
        action: "send",
        group: "referred",
        approved: true,
        approvalToken: "a".repeat(64),
      }),
    }),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "forbidden");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("preview only includes recipients whose confirmed referral state is current", async () => {
  const repository = fixtureRepository();
  configureEmail();
  const referred = await previewNotifications(
    repository,
    "owner",
    "referred",
    JOB_ID,
  );
  const remaining = await previewNotifications(
    repository,
    "owner",
    "remaining",
    JOB_ID,
  );

  assert.equal(referred.providerConfigured, true);
  assert.deepEqual(
    referred.recipients.map((recipient) => recipient.email),
    ["alex@example.invalid"],
  );
  assert.match(
    referred.recipients[0].body,
    /confirmed that I submitted your referral/,
  );
  assert.deepEqual(
    remaining.recipients.map((recipient) => recipient.email),
    ["sam@example.invalid"],
  );
  assert.match(
    remaining.recipients[0].body,
    /I confirmed a referral for this opening/,
  );
  assert.doesNotMatch(
    remaining.recipients[0].body,
    /I referred you|I submitted your referral/,
  );
});

test("sending requires a current preview approval and keeps application statuses unchanged", async () => {
  const repository = fixtureRepository();
  configureEmail();
  const preview = await previewNotifications(
    repository,
    "owner",
    "remaining",
    JOB_ID,
  );
  repository.workspace.applications.push({
    id: "app-added-after-preview",
    jobId: JOB_ID,
    candidateId: "candidate-3",
    status: "slot_filled_other",
  });
  await assert.rejects(
    sendApprovedNotifications(
      repository,
      "owner",
      "remaining",
      JOB_ID,
      preview.approvalToken,
    ),
    /Recipients changed after preview/,
  );
  assert.equal(repository.queue.size, 0);
  assert.equal(
    repository.workspace.applications.find((app) => app.id === "app-referred")
      .status,
    "referral_confirmed",
  );
});

test("failed delivery remains retryable through its idempotent outbox row", async () => {
  const repository = fixtureRepository();
  configureEmail();
  const preview = await previewNotifications(
    repository,
    "owner",
    "remaining",
    JOB_ID,
  );
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return calls.length === 1
      ? new Response("provider error", { status: 500 })
      : Response.json({ id: "resend-message" });
  };

  const failed = await sendApprovedNotifications(
    repository,
    "owner",
    "remaining",
    JOB_ID,
    preview.approvalToken,
  );
  assert.deepEqual(failed, { sent: 0, failed: 1, skipped: 0 });
  assert.equal([...repository.queue.values()][0].status, "failed");

  const retried = await sendApprovedNotifications(
    repository,
    "owner",
    "remaining",
    JOB_ID,
    preview.approvalToken,
  );
  assert.deepEqual(retried, { sent: 1, failed: 0, skipped: 0 });
  assert.equal([...repository.queue.values()][0].status, "sent");
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(
    calls[0].init.headers["Idempotency-Key"],
    calls[1].init.headers["Idempotency-Key"],
  );
  assert.equal(JSON.parse(calls[1].init.body).to[0], "sam@example.invalid");

  const afterSent = await previewNotifications(
    repository,
    "owner",
    "remaining",
    JOB_ID,
  );
  assert.equal(afterSent.eligibleCount, 0);
  assert.equal(afterSent.alreadySentCount, 1);
});

test("send refuses to queue anything until both Resend settings exist", async () => {
  const repository = fixtureRepository();
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_value";
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  const preview = await previewNotifications(
    repository,
    "owner",
    "referred",
    JOB_ID,
  );
  assert.equal(preview.providerConfigured, false);
  await assert.rejects(
    sendApprovedNotifications(
      repository,
      "owner",
      "referred",
      JOB_ID,
      preview.approvalToken,
    ),
    /RESEND_API_KEY and RESEND_FROM_EMAIL/,
  );
  assert.equal(repository.queue.size, 0);
});
