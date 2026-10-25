import { bodyRecord, identifier } from "@/app/api/_lib";
import { requireAdmin } from "@/server/auth";
import {
  previewNotifications,
  sendApprovedNotifications,
} from "@/server/notifications";
import type { NotificationGroup } from "@/server/notifications";
import {
  ApiError,
  assertSameOrigin,
  fail,
  json,
  parseJson,
} from "@/server/http";
import { getReferralRepository } from "@/server/supabase-repository";

function readGroup(value: unknown): NotificationGroup {
  if (value !== "referred" && value !== "remaining")
    throw new ApiError(
      400,
      "invalid_request",
      "Choose a valid notification group.",
    );
  return value;
}

function readJobId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const jobId = identifier(value, "job ID");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  )
    throw new ApiError(400, "invalid_request", "Enter a valid job ID.");
  return jobId;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin(request);
    const body = bodyRecord(await parseJson(request, 4_000));
    const action = body.action;
    if (action !== "preview" && action !== "send")
      throw new ApiError(400, "invalid_request", "Choose preview or send.");
    const group = readGroup(body.group);
    const jobId = readJobId(body.jobId);
    const repository = getReferralRepository();

    if (action === "preview") {
      if (
        Object.keys(body).some(
          (key) => !["action", "group", "jobId"].includes(key),
        )
      )
        throw new ApiError(
          400,
          "invalid_request",
          "Preview accepts only a group and optional job ID.",
        );
      return json({
        ok: true,
        preview: await previewNotifications(repository, actor.id, group, jobId),
      });
    }

    if (
      Object.keys(body).some(
        (key) =>
          !["action", "group", "jobId", "approved", "approvalToken"].includes(
            key,
          ),
      ) ||
      body.approved !== true ||
      typeof body.approvalToken !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.approvalToken)
    ) {
      throw new ApiError(
        400,
        "invalid_request",
        "Sending requires explicit approval of a current notification preview.",
      );
    }
    const result = await sendApprovedNotifications(
      repository,
      actor.id,
      group,
      jobId,
      body.approvalToken,
    );
    return json({
      ok: true,
      ...result,
      message:
        result.failed > 0
          ? "Some notifications could not be delivered. Failed messages are available for an approved retry."
          : "Approved notifications were processed.",
    });
  } catch (error) {
    return fail(error);
  }
}
