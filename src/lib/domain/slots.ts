import type { Application, Job, ReferralSlot } from "@/lib/demo/types";

export function getReferralSlot(
  job: Job,
  applications: Application[],
): ReferralSlot {
  const confirmed = applications.find(
    (app) => app.jobId === job.id && app.status === "referral_confirmed",
  );
  if (confirmed)
    return {
      jobId: job.id,
      status: "confirmed",
      applicationId: confirmed.id,
      updatedAt: confirmed.submittedAt,
    };
  const reserved = applications.find(
    (app) =>
      app.jobId === job.id && app.status === "selected_pending_submission",
  );
  if (reserved)
    return {
      jobId: job.id,
      status: "reserved",
      applicationId: reserved.id,
      updatedAt: reserved.submittedAt,
    };
  return { jobId: job.id, status: "available", updatedAt: job.updatedAt };
}

export function isIntakeAvailable(
  job: Job,
  applications: Application[],
  now: Date = new Date(),
): boolean {
  const slot = getReferralSlot(job, applications);
  const availabilityCheckedAt = job.availabilityCheckedAt
    ? Date.parse(job.availabilityCheckedAt)
    : Number.NaN;
  return (
    slot.status === "available" &&
    job.status === "open" &&
    job.availability === "open" &&
    Number.isFinite(availabilityCheckedAt) &&
    availabilityCheckedAt >= now.getTime() - 24 * 60 * 60 * 1000
  );
}

export type ReferralTransitionAction = "reserve" | "release" | "confirm";
export function transitionReferralSlot(
  job: Job,
  applications: Application[],
  action: ReferralTransitionAction,
  applicationId?: string,
  now: Date = new Date(),
): { ok: boolean; message: string; job: Job; applications: Application[] } {
  const target = applicationId
    ? applications.find(
        (app) => app.id === applicationId && app.jobId === job.id,
      )
    : applications.find(
        (app) =>
          app.jobId === job.id && app.status === "selected_pending_submission",
      );
  const nowIso = now.toISOString();
  if (action === "reserve") {
    if (!target)
      return {
        ok: false,
        message: "Choose an application for this job.",
        job,
        applications,
      };
    if (!isIntakeAvailable(job, applications, now))
      return {
        ok: false,
        message: "The referral slot is not available.",
        job,
        applications,
      };
    const answers = target.eligibility;
    const eligibilityReady =
      answers.previouslyApplied === false &&
      answers.previouslyReferred === false &&
      !answers.knowsOwner &&
      answers.inListedLocation === true;
    if (
      !["ready_for_review", "shortlisted"].includes(target.status) ||
      !target.resumeReady ||
      !eligibilityReady
    )
      return {
        ok: false,
        message: "The application is not ready and eligible for reservation.",
        job,
        applications,
      };
    return {
      ok: true,
      message: "Slot reserved.",
      job: { ...job, status: "paused", updatedAt: nowIso },
      applications: applications.map((app) =>
        app.id === target.id
          ? { ...app, status: "selected_pending_submission" }
          : app,
      ),
    };
  }
  if (!target || target.status !== "selected_pending_submission")
    return {
      ok: false,
      message: "There is no matching reserved application.",
      job,
      applications,
    };
  if (action === "release")
    return {
      ok: true,
      message: "Reservation released.",
      job: {
        ...job,
        status:
          job.availability === "closed"
            ? "closed"
            : job.availability === "open" &&
                job.availabilityCheckedAt !== null &&
                Date.parse(job.availabilityCheckedAt) >=
                  now.getTime() - 24 * 60 * 60 * 1000
              ? "open"
              : "paused",
        updatedAt: nowIso,
      },
      applications: applications.map((app) =>
        app.id === target.id ? { ...app, status: "ready_for_review" } : app,
      ),
    };
  return {
    ok: true,
    message: "Referral confirmed.",
    job: { ...job, status: "referred", updatedAt: nowIso },
    applications: applications.map((app) =>
      app.jobId !== job.id
        ? app
        : app.id === target.id
          ? { ...app, status: "referral_confirmed" }
          : ![
                "referral_confirmed",
                "not_selected",
                "slot_filled_other",
              ].includes(app.status)
            ? { ...app, status: "slot_filled_other" }
            : app,
    ),
  };
}
