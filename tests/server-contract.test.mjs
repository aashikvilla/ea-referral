import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { POST as createJob } from "../src/app/api/admin/jobs/route.ts";
import { POST as processDeletion } from "../src/app/api/admin/deletion-requests/route.ts";
import { POST as submitApplication } from "../src/app/api/applications/route.ts";
import { POST as validateResume } from "../src/app/api/resumes/[id]/validate/route.ts";
import { POST as requestCandidateStatusAccess } from "../src/app/api/status/access/route.ts";
import { POST as recordIntakeAnalytics } from "../src/app/api/analytics/intake/route.ts";
import { createJobInput } from "../src/app/api/_lib.ts";
import {
  ACCESS_COOKIE,
  getSessionSummary,
  requireAdmin,
  requireUser,
} from "../src/server/auth.ts";
import { ApiError, parseJson } from "../src/server/http.ts";
import { SupabaseReferralRepository } from "../src/server/supabase-repository.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";

function configure(mode = "connected") {
  process.env.EA_REFERRAL_MODE = mode;
  process.env.SUPABASE_URL = "https://demo-project.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_value";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_value";
  process.env.ADMIN_USER_ID = ADMIN_ID;
  process.env.APP_ORIGIN = "https://referral.example.invalid";
}

function fakeAuthFetch(id = ADMIN_ID) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/auth/v1/user")) {
      return Response.json({
        id,
        email: "owner@example.invalid",
        email_confirmed_at: "2026-10-24T00:00:00.000Z",
      });
    }
    throw new Error(`Unexpected network request: ${String(input)}`);
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("connected config is explicit; demo mode reports no authenticated session", async () => {
  configure("demo");
  assert.deepEqual(
    await getSessionSummary(
      new Request("https://referral.example.invalid/api/auth/session"),
    ),
    {
      configured: false,
      authenticated: false,
      user: null,
      isAdmin: false,
    },
  );
});

test("intake analytics require same-origin verified auth and reject invalid funnel claims", async () => {
  configure();
  const noToken = await recordIntakeAnalytics(
    new Request("https://referral.example.invalid/api/analytics/intake", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://referral.example.invalid",
      },
      body: JSON.stringify({
        jobId: "00000000-0000-4000-8000-000000000010",
        event: "candidate_role_view",
      }),
    }),
  );
  assert.equal(noToken.status, 401);

  globalThis.fetch = async () => {
    throw new Error("Auth provider is unavailable in this contract test.");
  };
  const unauthenticated = await recordIntakeAnalytics(
    new Request("https://referral.example.invalid/api/analytics/intake", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://referral.example.invalid",
        authorization: "Bearer signed.jwt.token",
      },
      body: JSON.stringify({
        jobId: "00000000-0000-4000-8000-000000000010",
        event: "quick_checks_passed",
        eligibility: {
          previouslyApplied: true,
          previouslyReferred: false,
          knowsOwner: false,
          inListedLocation: true,
        },
      }),
    }),
  );
  assert.equal(unauthenticated.status, 503);
});

test("connected workspace funnel metrics count unique candidate-role keys for 30 days", async () => {
  configure();
  const samples = [
    [],
    [],
    [],
    [],
    [],
    [
      { kind: "candidate_role_view", session_key: "visit-a" },
      { kind: "candidate_role_view", session_key: "visit-a" },
      { kind: "candidate_role_view", session_key: "visit-b" },
      { kind: "intake_started", session_key: "visit-a" },
      { kind: "quick_checks_passed", session_key: "visit-a" },
      { kind: "quick_checks_passed", session_key: "visit-a" },
      { kind: "application_submitted", application_id: "app-a" },
      { kind: "referral_confirmed", application_id: "app-b" },
    ],
  ];
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    const url = String(input);
    const index = url.includes("session_key")
      ? 5
      : url.includes("ea_referral_slots?")
        ? 4
        : calls.length - 1;
    return Response.json(samples[index] ?? []);
  };
  const workspace = await new SupabaseReferralRepository().getWorkspace();
  assert.deepEqual(workspace.funnelMetrics, {
    verifiedRoleVisits: 2,
    intakeStarts: 1,
    quickChecksPassed: 1,
    requestsSubmitted: 1,
    referralsConfirmed: 1,
  });
  const analyticsQuery = calls.find((url) =>
    url.includes("ea_referral_events?select=kind"),
  );
  assert.match(analyticsQuery, /created_at=gte\./);
  assert.match(analyticsQuery, /limit=10000/);
});

test("intake analytics only records eligible, verified candidate-role events", async () => {
  configure();
  const jobId = "00000000-0000-4000-8000-000000000010";
  const jobRow = {
    id: jobId,
    canonical_job_id: "EA:508741",
    title: "Gameplay Engineer",
    team: "EA SPORTS",
    location: "Vancouver, BC",
    locations: ["Vancouver, BC"],
    employment_type: "Full time",
    official_url: "https://jobs.ea.com/en_US/careers/JobDetail/508741",
    description: "Build game features.",
    status: "open",
    availability: "open",
    availability_checked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const inserted = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user"))
      return Response.json({
        id: OTHER_ID,
        email: "candidate@example.invalid",
        email_confirmed_at: "2026-10-24T00:00:00.000Z",
      });
    if (url.includes("ea_referral_jobs?")) return Response.json([jobRow]);
    if (url.includes("ea_referral_slots?")) return Response.json([]);
    if (url.includes("ea_referral_events?select=id")) return Response.json([]);
    if (url.endsWith("/ea_referral_events") && init.method === "POST") {
      inserted.push(JSON.parse(init.body));
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected analytics request: ${url}`);
  };

  const rejected = await recordIntakeAnalytics(
    new Request("https://referral.example.invalid/api/analytics/intake", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://referral.example.invalid",
        authorization: "Bearer signed.jwt.token",
      },
      body: JSON.stringify({
        jobId,
        event: "quick_checks_passed",
        eligibility: {
          previouslyApplied: true,
          previouslyReferred: false,
          knowsOwner: false,
          inListedLocation: true,
        },
      }),
    }),
  );
  assert.equal(rejected.status, 400);
  assert.equal(inserted.length, 0);

  const accepted = await recordIntakeAnalytics(
    new Request("https://referral.example.invalid/api/analytics/intake", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://referral.example.invalid",
        authorization: "Bearer signed.jwt.token",
      },
      body: JSON.stringify({ jobId, event: "candidate_role_view" }),
    }),
  );
  assert.equal(accepted.status, 200);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].kind, "candidate_role_view");
  assert.equal(inserted[0].job_id, jobId);
  assert.match(inserted[0].session_key, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(inserted[0]).includes(OTHER_ID), false);
});

test("missing access token is rejected without making an auth request", async () => {
  configure();
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("No request should be sent without a token");
  };
  await assert.rejects(
    requireUser(
      new Request("https://referral.example.invalid/api/admin/workspace"),
    ),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(called, false);
});

test("owner token is verified remotely and admin identity is matched to configured owner", async () => {
  configure();
  const calls = fakeAuthFetch();
  const user = await requireAdmin(
    new Request("https://referral.example.invalid/api/admin/workspace", {
      headers: { cookie: `${ACCESS_COOKIE}=signed.jwt.token` },
    }),
  );
  assert.equal(user.id, ADMIN_ID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://demo-project.supabase.co/auth/v1/user");
  assert.equal(calls[0].init.headers.apikey, "sb_publishable_test_value");
  assert.equal(calls[0].init.headers.Authorization, "Bearer signed.jwt.token");
  assert.notEqual(calls[0].init.headers.apikey, "sb_secret_test_value");

  fakeAuthFetch(OTHER_ID);
  await assert.rejects(
    requireAdmin(
      new Request("https://referral.example.invalid/api/admin/workspace", {
        headers: { authorization: "Bearer signed.jwt.token" },
      }),
    ),
    (error) => error instanceof ApiError && error.status === 403,
  );

  globalThis.fetch = async () =>
    Response.json({ id: ADMIN_ID, email: "owner@example.invalid" });
  await assert.rejects(
    requireAdmin(
      new Request("https://referral.example.invalid/api/admin/workspace", {
        headers: { authorization: "Bearer signed.jwt.token" },
      }),
    ),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test("auth provider failures return unavailable errors while invalid sessions stay hidden", async () => {
  configure();
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  await assert.rejects(
    requireUser(
      new Request("https://referral.example.invalid/api/admin/workspace", {
        headers: { authorization: "Bearer signed.jwt.token" },
      }),
    ),
    (error) => error instanceof ApiError && error.status === 503,
  );
  await assert.rejects(
    getSessionSummary(
      new Request("https://referral.example.invalid/api/auth/session", {
        headers: { authorization: "Bearer signed.jwt.token" },
      }),
    ),
    (error) => error instanceof ApiError && error.status === 503,
  );
  globalThis.fetch = async () =>
    Response.json({ message: "invalid token" }, { status: 401 });
  assert.deepEqual(
    await getSessionSummary(
      new Request("https://referral.example.invalid/api/auth/session", {
        headers: { authorization: "Bearer signed.jwt.token" },
      }),
    ),
    {
      configured: true,
      authenticated: false,
      user: null,
      isAdmin: false,
    },
  );
});

test("request parser rejects wrong media type, malformed JSON, and oversized bodies", async () => {
  await assert.rejects(
    parseJson(
      new Request("https://referral.example.invalid/api/jobs", {
        method: "POST",
        body: "{}",
      }),
    ),
    (error) => error instanceof ApiError && error.status === 415,
  );
  await assert.rejects(
    parseJson(
      new Request("https://referral.example.invalid/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    ),
    (error) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(
    parseJson(
      new Request("https://referral.example.invalid/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ long: "x".repeat(500) }),
      }),
      100,
    ),
    (error) => error instanceof ApiError && error.status === 413,
  );
});

test("job request validation accepts canonical EA details and rejects URL lookalikes or extra fields", () => {
  const valid = createJobInput({
    canonicalJobId: "508741",
    title: "Gameplay Engineer",
    team: "EA SPORTS",
    location: "Vancouver, BC",
    locations: ["Vancouver, BC"],
    employmentType: "Full time",
    officialUrl: "https://jobs.ea.com/en_US/careers/JobDetail/508741",
    description: "Build game features.",
  });
  assert.equal(valid.canonicalJobId, "EA:508741");
  assert.throws(
    () =>
      createJobInput({
        canonicalJobId: "508741",
        title: "Gameplay Engineer",
        team: "EA SPORTS",
        location: "Vancouver, BC",
        locations: ["Vancouver, BC"],
        employmentType: "Full time",
        officialUrl:
          "https://jobs.ea.com.example.invalid/en_US/careers/JobDetail/508741",
        description: "Build game features.",
      }),
    ApiError,
  );
});

test("admin job API checks owner before mutation and validates payload before repository access", async () => {
  configure();
  let requests = 0;
  globalThis.fetch = async (input) => {
    requests += 1;
    if (String(input).endsWith("/auth/v1/user"))
      return Response.json({
        id: ADMIN_ID,
        email: "owner@example.invalid",
        email_confirmed_at: "2026-10-24T00:00:00.000Z",
      });
    throw new Error("Repository should not be reached for invalid job input");
  };
  const request = new Request(
    "https://referral.example.invalid/api/admin/jobs",
    {
      method: "POST",
      headers: {
        origin: "https://referral.example.invalid",
        "content-type": "application/json",
        authorization: "Bearer signed.jwt.token",
      },
      body: JSON.stringify({ canonicalJobId: "bad-id" }),
    },
  );
  const response = await createJob(request);
  assert.equal(response.status, 400);
  assert.equal((await response.clone().json()).ok, false);
  assert.equal(requests, 1);

  requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("Unauthenticated mutation must not call any backend");
  };
  const unauthenticated = await createJob(
    new Request("https://referral.example.invalid/api/admin/jobs", {
      method: "POST",
      headers: {
        origin: "https://referral.example.invalid",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.clone().json()).code, "unauthorized");
  assert.equal(requests, 0);
});

test("connected candidate submission accepts a verified resume and persists only through the submission RPC", async () => {
  configure();
  const candidateId = "00000000-0000-4000-8000-000000000003";
  const jobId = "00000000-0000-4000-8000-000000000010";
  const resumeId = "00000000-0000-4000-8000-000000000011";
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/auth/v1/user"))
      return Response.json({
        id: candidateId,
        email: "candidate@example.invalid",
        email_confirmed_at: "2026-10-24T00:00:00.000Z",
      });
    if (url.includes("ea_referral_applications?")) return Response.json([]);
    if (url.includes("ea_referral_slots?")) return Response.json([]);
    if (url.includes("ea_referral_jobs?"))
      return Response.json([
        {
          id: jobId,
          canonical_job_id: "EA:508741",
          title: "Gameplay Engineer",
          status: "open",
          availability: "open",
          availability_checked_at: new Date().toISOString(),
        },
      ]);
    if (url.includes("ea_referral_resumes?"))
      return Response.json([
        {
          id: resumeId,
          auth_user_id: candidateId,
          job_id: jobId,
          storage_path: `${candidateId}/${resumeId}/resume.pdf`,
          file_name: "resume.pdf",
          file_size: 1024,
          content_type: "application/pdf",
          version: 1,
          parser_status: "ready",
          parsed_fields: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
          scan_status: "clean",
          created_at: new Date().toISOString(),
        },
      ]);
    if (url.endsWith("/rpc/ea_referral_submit_application"))
      return Response.json({ id: "application-created" });
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const response = await submitApplication(
    new Request("https://referral.example.invalid/api/applications", {
      method: "POST",
      headers: {
        origin: "https://referral.example.invalid",
        "content-type": "application/json",
        authorization: "Bearer signed.jwt.token",
      },
      body: JSON.stringify({
        jobId,
        candidate: {
          firstName: "Alex",
          lastName: "Rivera",
          email: "candidate@example.invalid",
          phone: "+1 555 010 0100",
          country: "Canada",
          relationship: "professional_network",
        },
        relationship: "professional_network",
        eligibility: {
          previouslyApplied: false,
          previouslyReferred: false,
          knowsOwner: false,
          inListedLocation: true,
        },
        resumeId,
      }),
    }),
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    ok: true,
    applicationId: "application-created",
    existing: false,
  });
  assert.ok(
    calls.some((url) => url.endsWith("/rpc/ea_referral_submit_application")),
  );
  assert.ok(
    calls.every((url) => url.startsWith("https://demo-project.supabase.co/")),
  );
});

test("owner deletion contract removes private storage before recording completion", async () => {
  configure();
  const requestId = "00000000-0000-4000-8000-000000000020";
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    if (url.endsWith("/auth/v1/user"))
      return Response.json({
        id: ADMIN_ID,
        email: "owner@example.invalid",
        email_confirmed_at: "2026-10-24T00:00:00.000Z",
      });
    if (url.endsWith("/rpc/ea_referral_deletion_paths"))
      return Response.json([
        {
          bucket: "ea_referral_resumes",
          storage_path: `${OTHER_ID}/resume/resume.pdf`,
        },
      ]);
    if (url.endsWith("/storage/v1/object/ea_referral_resumes"))
      return new Response(null, { status: 200 });
    if (url.includes("ea_referral_deletion_requests?"))
      return Response.json([{ auth_user_id: OTHER_ID }]);
    if (url.endsWith("/ea_referral_jobs?select=id"))
      return Response.json([{ id: "00000000-0000-4000-8000-000000000010" }]);
    if (url.includes("ea_referral_events?") && init.method === "DELETE")
      return new Response(null, { status: 204 });
    if (url.endsWith("/rpc/ea_referral_process_deletion"))
      return Response.json({ ok: true });
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const response = await processDeletion(
    new Request(
      "https://referral.example.invalid/api/admin/deletion-requests",
      {
        method: "POST",
        headers: {
          origin: "https://referral.example.invalid",
          "content-type": "application/json",
          authorization: "Bearer signed.jwt.token",
        },
        body: JSON.stringify({ id: requestId }),
      },
    ),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    id: requestId,
    status: "completed",
  });
  const storageIndex = calls.findIndex(({ method }) => method === "DELETE");
  const completionIndex = calls.findIndex(({ url }) =>
    url.endsWith("/rpc/ea_referral_process_deletion"),
  );
  assert.notEqual(storageIndex, -1);
  assert.ok(storageIndex < completionIndex);
  const storageRequest = calls[storageIndex];
  assert.deepEqual(JSON.parse(storageRequest.body), {
    prefixes: [`${OTHER_ID}/resume/resume.pdf`],
  });
});

test("resume validation scopes lookup to the authenticated candidate", async () => {
  configure();
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/auth/v1/user"))
      return Response.json({
        id: OTHER_ID,
        email: "candidate@example.invalid",
        email_confirmed_at: "2026-10-24T00:00:00.000Z",
      });
    if (url.includes("ea_referral_resumes?")) return Response.json([]);
    throw new Error(`An unowned resume must not be read: ${url}`);
  };
  const response = await validateResume(
    new Request(
      `https://referral.example.invalid/api/resumes/${ADMIN_ID}/validate`,
      {
        method: "POST",
        headers: {
          origin: "https://referral.example.invalid",
          authorization: "Bearer signed.jwt.token",
        },
      },
    ),
    { params: Promise.resolve({ id: ADMIN_ID }) },
  );
  assert.equal(response.status, 404);
  assert.deepEqual(calls, [
    "https://demo-project.supabase.co/auth/v1/user",
    `https://demo-project.supabase.co/rest/v1/ea_referral_resumes?select=*&id=eq.${ADMIN_ID}&auth_user_id=eq.${OTHER_ID}&limit=1`,
  ]);
});

test("candidate status access never sends email while delivery is deferred", async () => {
  configure();
  globalThis.fetch = async () => {
    throw new Error("Email delivery is not configured and must not be called");
  };
  const response = await requestCandidateStatusAccess(
    new Request("https://referral.example.invalid/api/status/access", {
      method: "POST",
      headers: {
        origin: "https://referral.example.invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "candidate@example.invalid" }),
    }),
  );
  assert.equal(response.status, 503);
  assert.match(
    (await response.json()).error.message,
    /email verification is not configured/i,
  );
});

test("repository RPC calls use server credentials and pass actor IDs explicitly", async () => {
  configure();
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return Response.json({
      job_id: "00000000-0000-4000-8000-000000000010",
      application_id: "00000000-0000-4000-8000-000000000011",
      status: "reserved",
      updated_at: "2026-10-24T00:00:00.000Z",
    });
  };
  const repository = new SupabaseReferralRepository();
  const slot = await repository.reserveReferral("job-1", "app-1", ADMIN_ID);
  assert.equal(slot.status, "reserved");
  assert.equal(
    calls[0].url,
    "https://demo-project.supabase.co/rest/v1/rpc/ea_referral_reserve",
  );
  assert.equal(calls[0].init.headers.apikey, "sb_secret_test_value");
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    p_actor_id: ADMIN_ID,
    p_job_id: "job-1",
    p_application_id: "app-1",
  });
});

test("legacy service role JWT is sent as both API key and bearer token", async () => {
  configure();
  process.env.SUPABASE_SECRET_KEY = "legacy.service.role.jwt";
  let headers;
  globalThis.fetch = async (_input, init = {}) => {
    headers = init.headers;
    return Response.json([]);
  };
  const repository = new SupabaseReferralRepository();
  await repository.listJobs(false);
  assert.equal(headers.apikey, "legacy.service.role.jwt");
  assert.equal(headers.Authorization, "Bearer legacy.service.role.jwt");
});

test("candidate status repository query scopes by verified user and selects status fields only", async () => {
  configure();
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json([]);
  };
  const repository = new SupabaseReferralRepository();
  const status = await repository.getCandidateStatus(
    "application-id",
    OTHER_ID,
  );
  assert.equal(status, null);
  assert.match(requestedUrl, /select=id,job_id,status,submitted_at/);
  assert.match(requestedUrl, new RegExp(`user_id=eq\\.${OTHER_ID}`));
  assert.match(requestedUrl, /id=eq\.application-id/);
  assert.doesNotMatch(requestedUrl, /email|phone|resume/);
});
