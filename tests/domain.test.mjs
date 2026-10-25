import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionApplicationStatus,
  checkEligibility,
} from "../src/lib/domain/eligibility.ts";
import {
  averageMatchComponents,
  calculateEvidenceCoverage,
} from "../src/lib/domain/scoring.ts";
import {
  getReferralSlot,
  isIntakeAvailable,
  transitionReferralSlot,
} from "../src/lib/domain/slots.ts";
import {
  hasDuplicateApplication,
  normalizeCanonicalJobId,
  validateApplicationInput,
  validateEaJobUrl,
} from "../src/lib/domain/validation.ts";
import {
  demoApplications,
  demoCandidates,
  demoJobs,
  getDemoJobsForSession,
} from "../src/lib/demo/fixtures.ts";

const fixtureOpenJob = demoJobs.find((job) => job.id === "job-508741");
const testNow = new Date("2026-10-24T12:00:00.000Z");
const openJob = {
  ...fixtureOpenJob,
  availabilityCheckedAt: "2026-10-24T11:00:00.000Z",
};
const unknownJob = demoJobs.find((job) => job.id === "job-509182");
const confirmedJob = demoJobs.find((job) => job.id === "job-507316");

function applicationInput(overrides = {}) {
  return {
    jobId: "job-508741",
    candidate: {
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex@example.invalid",
      phone: "+1 555 010 0100",
      country: "Canada",
      currentTitle: "Engineer",
      currentCompany: "Example Studio",
      relationship: "professional_network",
    },
    eligibility: {
      previouslyApplied: false,
      previouslyReferred: false,
      knowsOwner: false,
      inListedLocation: true,
    },
    relationship: "professional_network",
    resume: {
      fileName: "resume.pdf",
      fileSize: 1024,
      fileType: "application/pdf",
      fields: { firstName: true, lastName: true, email: true, phone: true },
    },
    ...overrides,
  };
}

test("canonical EA job IDs normalize across numeric, prefixed, and official localized URLs", () => {
  assert.equal(normalizeCanonicalJobId("508741"), "EA:508741");
  assert.equal(normalizeCanonicalJobId("EA:508741"), "EA:508741");
  assert.equal(
    normalizeCanonicalJobId(
      "https://jobs.ea.com/en_US/careers/JobDetail/508741",
    ),
    "EA:508741",
  );
  assert.equal(
    normalizeCanonicalJobId(
      "https://jobs.ea.com/fr_FR/careers/JobDetail/508741",
    ),
    "EA:508741",
  );
  assert.equal(normalizeCanonicalJobId("not-a-job"), null);
  assert.equal(
    normalizeCanonicalJobId("508741?redirect=https://example.com"),
    null,
  );
});

test("official job URL validation accepts official HTTPS URLs and rejects deceptive hosts", () => {
  assert.equal(
    validateEaJobUrl("https://jobs.ea.com/en_US/careers/JobDetail/508741"),
    true,
  );
  assert.equal(
    validateEaJobUrl(
      "https://jobs.ea.com/fr_FR/careers/JobDetail/some-role/508741",
    ),
    true,
  );
  for (const url of [
    "http://jobs.ea.com/en_US/careers/JobDetail/508741",
    "https://evil.jobs.ea.com/en_US/careers/JobDetail/508741",
    "https://jobs.ea.com.evil.invalid/en_US/careers/JobDetail/508741",
    "https://jobs.ea.com@evil.invalid/en_US/careers/JobDetail/508741",
    "https://jobs.ea.com:444/en_US/careers/JobDetail/508741",
    "https://ea.com/en_US/careers/JobDetail/508741",
    "https://jobs.ea.com/en_US/careers/job/508741",
  ])
    assert.equal(validateEaJobUrl(url), false, url);
});

test("eligibility stops known cases and routes unknown answers to owner review", () => {
  const clear = {
    previouslyApplied: false,
    previouslyReferred: false,
    knowsOwner: false,
    inListedLocation: true,
  };
  assert.equal(checkEligibility(confirmedJob, clear), "already_referred");
  assert.equal(
    checkEligibility(openJob, { ...clear, previouslyApplied: true }),
    "already_applied",
  );
  assert.equal(
    checkEligibility(openJob, { ...clear, previouslyReferred: true }),
    "already_referred",
  );
  assert.equal(
    checkEligibility(openJob, { ...clear, knowsOwner: true }),
    "known_person",
  );
  assert.equal(
    checkEligibility(openJob, { ...clear, inListedLocation: false }),
    "location_review",
  );
  assert.equal(
    checkEligibility(openJob, { ...clear, previouslyApplied: null }),
    "needs_owner_review",
  );
  assert.equal(
    checkEligibility(openJob, { ...clear, inListedLocation: null }),
    "needs_owner_review",
  );
});

test("showcase note counts Unicode code points and permits exactly 500", () => {
  assert.equal(
    validateApplicationInput(
      applicationInput({ showcase: { note: "😀".repeat(500) } }),
    ),
    null,
  );
  assert.match(
    validateApplicationInput(
      applicationInput({ showcase: { note: "😀".repeat(501) } }),
    ),
    /500/,
  );
});

test("showcase files may total exactly 10 MiB but not exceed the limit", () => {
  const limit = 10 * 1024 * 1024;
  assert.equal(
    validateApplicationInput(
      applicationInput({
        showcase: {
          files: [
            { name: "a.pdf", size: limit - 1 },
            { name: "b.txt", size: 1 },
          ],
        },
      }),
    ),
    null,
  );
  assert.match(
    validateApplicationInput(
      applicationInput({
        showcase: { files: [{ name: "a.pdf", size: limit + 1 }] },
      }),
    ),
    /10 MB/,
  );
  for (const file of [
    { name: "archive.zip", size: 128 },
    { name: "payload.exe", size: 128 },
  ]) {
    assert.notEqual(
      validateApplicationInput(
        applicationInput({ showcase: { files: [file] } }),
      ),
      null,
      file.name,
    );
  }
  for (const size of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.notEqual(
      validateApplicationInput(
        applicationInput({
          showcase: { files: [{ name: "sample.pdf", size }] },
        }),
      ),
      null,
      String(size),
    );
  }
});

test("evidence coverage uses weighted evidence only; optional participation is not a score input", () => {
  const requirements = [
    { category: "mandatory", supported: true },
    { category: "relevantWork", supported: true },
    { category: "preferred", supported: false },
    { category: "achievements", supported: false },
  ];
  assert.equal(calculateEvidenceCoverage(requirements), 75);
  const submitted = demoApplications[0];
  const skippedShowcase = {
    ...submitted,
    showcase: { note: "", links: [], files: [] },
  };
  const requirementsFrom = (application) =>
    application.requirements.map(({ category, met }) => ({
      category,
      supported: met,
    }));
  assert.equal(
    calculateEvidenceCoverage(requirementsFrom(submitted)),
    calculateEvidenceCoverage(requirementsFrom(skippedShowcase)),
  );
  assert.equal(calculateEvidenceCoverage([]), 0);
  assert.equal(
    calculateEvidenceCoverage([{ category: "mandatory", supported: true }]),
    45,
  );
  assert.equal(
    calculateEvidenceCoverage([{ category: "relevantWork", supported: true }]),
    30,
  );
  assert.equal(
    calculateEvidenceCoverage([{ category: "preferred", supported: true }]),
    15,
  );
  assert.equal(
    calculateEvidenceCoverage([{ category: "achievements", supported: true }]),
    10,
  );
  assert.equal(
    averageMatchComponents({
      mandatory: 100,
      relevantWork: 0,
      preferred: 0,
      achievements: 0,
    }),
    45,
  );
  assert.equal(
    averageMatchComponents({
      mandatory: 0,
      relevantWork: 100,
      preferred: 0,
      achievements: 0,
    }),
    30,
  );
  assert.equal(
    averageMatchComponents({
      mandatory: 80,
      relevantWork: 70,
      preferred: 60,
      achievements: 50,
    }),
    71,
  );
});

test("confirmed and reserved referrals close intake, and unknown job availability stays blocked", () => {
  assert.deepEqual(getReferralSlot(confirmedJob, demoApplications), {
    jobId: confirmedJob.id,
    status: "confirmed",
    applicationId: "app-mateo",
    updatedAt: "2026-10-14T10:00:00.000Z",
  });
  assert.equal(isIntakeAvailable(confirmedJob, demoApplications), false);
  assert.equal(isIntakeAvailable(unknownJob, []), false);
  assert.equal(
    isIntakeAvailable({ ...openJob, availability: "closed" }, []),
    false,
  );
  assert.equal(isIntakeAvailable({ ...openJob, status: "paused" }, []), false);

  const reserved = {
    ...demoApplications[0],
    id: "pending",
    jobId: openJob.id,
    status: "selected_pending_submission",
  };
  assert.equal(getReferralSlot(openJob, [reserved]).status, "reserved");
  assert.equal(isIntakeAvailable(openJob, [reserved]), false);
  assert.equal(isIntakeAvailable(openJob, []), true);
  assert.equal(isIntakeAvailable(openJob, [], testNow), true);
  assert.equal(
    isIntakeAvailable(
      { ...openJob, availabilityCheckedAt: "2026-10-23T11:59:59.999Z" },
      [],
      testNow,
    ),
    false,
  );
  assert.equal(
    isIntakeAvailable({ ...openJob, availabilityCheckedAt: null }, [], testNow),
    false,
  );
});

test("demo session refreshes only the fictional open role availability timestamp", () => {
  const checkedAt = testNow.toISOString();
  const jobs = getDemoJobsForSession(checkedAt);
  const refreshedOpen = jobs.find((job) => job.id === openJob.id);
  const unknown = jobs.find((job) => job.id === unknownJob.id);
  const referred = jobs.find((job) => job.id === confirmedJob.id);

  assert.equal(refreshedOpen.availabilityCheckedAt, checkedAt);
  assert.equal(isIntakeAvailable(refreshedOpen, [], testNow), true);
  assert.equal(unknown.availabilityCheckedAt, null);
  assert.equal(isIntakeAvailable(unknown, [], testNow), false);
  assert.equal(
    referred.availabilityCheckedAt,
    confirmedJob.availabilityCheckedAt,
  );
});

test("one job cannot project a second active referral slot when duplicate applications exist", () => {
  const confirmed = {
    ...demoApplications[0],
    id: "confirmed",
    jobId: openJob.id,
    status: "referral_confirmed",
  };
  const reserved = {
    ...demoApplications[1],
    id: "reserved",
    jobId: openJob.id,
    status: "selected_pending_submission",
  };
  const slot = getReferralSlot(openJob, [reserved, confirmed]);
  assert.equal(slot.status, "confirmed");
  assert.equal(slot.applicationId, "confirmed");
  assert.equal(isIntakeAvailable(openJob, [reserved, confirmed]), false);
});

test("generic application status updates cannot confirm or reopen a referral slot", () => {
  assert.equal(
    canTransitionApplicationStatus(
      "selected_pending_submission",
      "referral_confirmed",
    ),
    false,
  );
  assert.equal(
    canTransitionApplicationStatus("referral_confirmed", "ready_for_review"),
    false,
  );
  assert.equal(
    canTransitionApplicationStatus(
      "referral_confirmed",
      "selected_pending_submission",
    ),
    false,
  );
  assert.equal(
    canTransitionApplicationStatus("ready_for_review", "shortlisted"),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus("ready_for_review", "correction_required"),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus("shortlisted", "correction_required"),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus(
      "needs_clarification",
      "correction_required",
    ),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus(
      "selected_pending_submission",
      "correction_required",
    ),
    false,
  );
  assert.equal(
    canTransitionApplicationStatus("referral_confirmed", "correction_required"),
    false,
  );
});

test("duplicate application guard matches normalized email only within the same job", () => {
  const candidate = {
    ...demoCandidates[0],
    id: "candidate-dup",
    email: " Person@Example.Invalid ",
  };
  const existing = {
    ...demoApplications[0],
    id: "app-dup",
    jobId: "job-508741",
    candidateId: candidate.id,
  };
  assert.equal(
    hasDuplicateApplication(
      "job-508741",
      "person@example.invalid",
      [existing],
      [candidate],
    ),
    true,
  );
  assert.equal(
    hasDuplicateApplication(
      "job-509182",
      "person@example.invalid",
      [existing],
      [candidate],
    ),
    false,
  );
  assert.equal(
    hasDuplicateApplication(
      "job-508741",
      "other@example.invalid",
      [existing],
      [candidate],
    ),
    false,
  );
});

test("slot transitions reserve once, reject a competing reservation, then release or confirm", () => {
  const candidateOne = {
    ...demoApplications[0],
    id: "candidate-one",
    jobId: openJob.id,
    status: "ready_for_review",
  };
  const candidateTwo = {
    ...demoApplications[1],
    id: "candidate-two",
    jobId: openJob.id,
    status: "shortlisted",
  };
  const candidateThree = {
    ...demoApplications[0],
    id: "candidate-three",
    jobId: openJob.id,
    status: "ready_for_review",
  };
  const applications = [candidateOne, candidateTwo, candidateThree];
  const reserve = transitionReferralSlot(
    openJob,
    applications,
    "reserve",
    candidateOne.id,
    testNow,
  );
  assert.equal(reserve.ok, true);
  assert.equal(reserve.job.status, "paused");
  assert.equal(
    reserve.applications.find(({ id }) => id === candidateOne.id).status,
    "selected_pending_submission",
  );
  assert.equal(isIntakeAvailable(reserve.job, reserve.applications), false);

  for (const ineligible of [
    { ...candidateOne, status: "submitted" },
    { ...candidateOne, resumeReady: false },
    {
      ...candidateOne,
      eligibility: { ...candidateOne.eligibility, previouslyApplied: null },
    },
    {
      ...candidateOne,
      eligibility: { ...candidateOne.eligibility, previouslyReferred: true },
    },
  ]) {
    const rejected = transitionReferralSlot(
      openJob,
      [ineligible],
      "reserve",
      ineligible.id,
      testNow,
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.job.status, openJob.status);
  }

  const competingReserve = transitionReferralSlot(
    reserve.job,
    reserve.applications,
    "reserve",
    candidateTwo.id,
    testNow,
  );
  assert.equal(competingReserve.ok, false);
  assert.equal(
    competingReserve.applications.filter(
      ({ status }) => status === "selected_pending_submission",
    ).length,
    1,
  );

  const release = transitionReferralSlot(
    reserve.job,
    reserve.applications,
    "release",
    candidateOne.id,
    testNow,
  );
  assert.equal(release.ok, true);
  assert.equal(release.job.status, "open");
  assert.equal(
    release.applications.find(({ id }) => id === candidateOne.id).status,
    "ready_for_review",
  );
  assert.equal(isIntakeAvailable(release.job, release.applications), true);

  const reserveAgain = transitionReferralSlot(
    release.job,
    release.applications,
    "reserve",
    candidateOne.id,
    testNow,
  );
  const confirm = transitionReferralSlot(
    reserveAgain.job,
    reserveAgain.applications,
    "confirm",
    candidateOne.id,
    testNow,
  );
  assert.equal(confirm.ok, true);
  assert.equal(confirm.job.status, "referred");
  assert.equal(
    confirm.applications.find(({ id }) => id === candidateOne.id).status,
    "referral_confirmed",
  );
  assert.equal(
    confirm.applications.find(({ id }) => id === candidateTwo.id).status,
    "slot_filled_other",
  );
  assert.equal(
    confirm.applications.find(({ id }) => id === candidateThree.id).status,
    "slot_filled_other",
  );
  assert.equal(
    getReferralSlot(confirm.job, confirm.applications).status,
    "confirmed",
  );
  assert.equal(
    transitionReferralSlot(
      confirm.job,
      confirm.applications,
      "release",
      candidateOne.id,
    ).ok,
    false,
  );
  assert.equal(
    transitionReferralSlot(
      confirm.job,
      confirm.applications,
      "confirm",
      candidateOne.id,
    ).ok,
    false,
  );
});

test("release keeps closed, unknown, and stale jobs unavailable", () => {
  const reservation = {
    ...demoApplications[0],
    id: "reserved-app",
    jobId: openJob.id,
    status: "selected_pending_submission",
  };
  const cases = [
    [{ ...openJob, availability: "closed" }, "closed"],
    [{ ...openJob, availability: "unknown" }, "paused"],
    [
      { ...openJob, availabilityCheckedAt: "2026-10-23T11:59:59.999Z" },
      "paused",
    ],
  ];

  for (const [job, expectedStatus] of cases) {
    const result = transitionReferralSlot(
      { ...job, status: "paused" },
      [reservation],
      "release",
      reservation.id,
      testNow,
    );
    assert.equal(result.ok, true);
    assert.equal(result.job.status, expectedStatus);
    assert.equal(
      isIntakeAvailable(result.job, result.applications, testNow),
      false,
    );
  }
});

test("confirmation closes every nonfinal application while preserving final states", () => {
  const statuses = [
    "submitted",
    "processing",
    "correction_required",
    "eligibility_review",
    "needs_clarification",
    "ready_for_review",
    "shortlisted",
    "not_selected",
    "slot_filled_other",
  ];
  const reserved = {
    ...demoApplications[0],
    id: "reserved-app",
    jobId: openJob.id,
    status: "selected_pending_submission",
  };
  const others = statuses.map((status) => ({
    ...demoApplications[1],
    id: `other-${status}`,
    jobId: openJob.id,
    status,
  }));
  const result = transitionReferralSlot(
    { ...openJob, status: "paused" },
    [reserved, ...others],
    "confirm",
    reserved.id,
    testNow,
  );
  assert.equal(result.ok, true);
  for (const app of result.applications.filter(
    ({ id }) => id !== reserved.id,
  )) {
    const expected = ["not_selected", "slot_filled_other"].includes(
      app.id.slice(6),
    )
      ? app.id.slice(6)
      : "slot_filled_other";
    assert.equal(app.status, expected, app.id);
  }
});
