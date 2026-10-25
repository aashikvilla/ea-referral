import assert from "node:assert/strict";
import test from "node:test";

import {
  readNotificationPreview,
  readNotificationSendResult,
} from "../src/lib/domain/notifications-ui.ts";

const recipient = {
  applicationId: "app-1",
  firstName: "Alex",
  email: "alex@example.invalid",
  jobTitle: "Data Science Intern",
  subject: "Referral confirmed",
  body: "Hi Alex",
  status: "referral_confirmed",
  deliveryStatus: "already_sent",
};

test("notification page accepts only complete server previews", () => {
  const preview = readNotificationPreview({
    ok: true,
    preview: {
      group: "referred",
      jobId: null,
      eligibleCount: 0,
      alreadySentCount: 1,
      inProgressCount: 0,
      cancelledCount: 0,
      providerConfigured: true,
      approvalToken: "a".repeat(64),
      recipients: [recipient],
    },
  });
  assert.equal(preview?.recipients[0].email, recipient.email);
  assert.equal(preview?.recipients[0].deliveryStatus, "already_sent");
  assert.equal(
    readNotificationPreview({
      ok: true,
      preview: {
        group: "referred",
        jobId: null,
        eligibleCount: 1,
        alreadySentCount: 0,
        inProgressCount: 0,
        cancelledCount: 0,
        providerConfigured: true,
        approvalToken: "a".repeat(64),
        recipients: [],
      },
    }),
    null,
  );
});

test("an unavailable or invalid send response cannot be presented as sent", () => {
  assert.equal(
    readNotificationSendResult({
      ok: false,
      code: "unavailable",
      message: "Email delivery is not configured.",
    }),
    null,
  );
  assert.equal(
    readNotificationSendResult({
      ok: true,
      sent: "1",
      failed: 0,
      skipped: 0,
      message: "done",
    }),
    null,
  );
  assert.deepEqual(
    readNotificationSendResult({
      ok: true,
      sent: 1,
      failed: 0,
      skipped: 0,
      message: "done",
    }),
    { sent: 1, failed: 0, skipped: 0, message: "done" },
  );
});
