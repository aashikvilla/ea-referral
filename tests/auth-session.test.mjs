import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { POST as requestOtp } from "../src/app/api/auth/request/route.ts";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getSessionSummary,
} from "../src/server/auth.ts";
import { safeNext, setSessionCookies } from "../src/server/auth-session.ts";
import { ApiError, assertSameOrigin } from "../src/server/http.ts";

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

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("session cookies require bounded tokens and set private same-site attributes", () => {
  const response = new Response();
  process.env.NODE_ENV = "production";
  setSessionCookies(response, {
    access_token: "access.token",
    refresh_token: "refresh.token",
    expires_in: 120,
  });
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], new RegExp(`^${ACCESS_COOKIE}=`));
  assert.match(cookies[0], /HttpOnly/);
  assert.match(cookies[0], /SameSite=Lax/);
  assert.match(cookies[0], /Secure/);
  assert.match(cookies[0], /Path=\//);
  assert.match(cookies[0], /Max-Age=120/);
  assert.match(cookies[1], new RegExp(`^${REFRESH_COOKIE}=`));
  assert.match(cookies[1], /HttpOnly/);
  assert.match(cookies[1], /SameSite=Lax/);
  assert.throws(
    () =>
      setSessionCookies(new Response(), {
        access_token: "a".repeat(8193),
        refresh_token: "refresh.token",
      }),
    /invalid/i,
  );
});

test("safeNext allows relative paths and rejects external, backslash, and control redirects", () => {
  assert.equal(
    safeNext("/referral/EA%3A123?from=email#apply"),
    "/referral/EA%3A123?from=email#apply",
  );
  assert.equal(safeNext("https://attacker.invalid/path"), "/status");
  assert.equal(safeNext("//attacker.invalid/path"), "/status");
  assert.equal(safeNext("/\\attacker.invalid"), "/status");
  assert.equal(safeNext("/path\u0000next"), "/status");
  assert.equal(safeNext("/path\nnext", "/fallback"), "/fallback");
});

test("auth mutation requires same-origin when no bearer credential is used", async () => {
  configure();
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };
  const response = await requestOtp(
    new Request("https://referral.example.invalid/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "candidate@example.invalid" }),
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(called, false);
  assert.throws(
    () =>
      assertSameOrigin(
        new Request("https://referral.example.invalid/api/auth/request", {
          method: "POST",
          headers: { origin: "https://attacker.invalid" },
        }),
      ),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test("demo mode reports no session and does not call the auth provider", async () => {
  configure("demo");
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("Demo session checks must not call Supabase.");
  };
  assert.deepEqual(
    await getSessionSummary(
      new Request("https://referral.example.invalid/api/session"),
    ),
    { configured: false, authenticated: false, user: null, isAdmin: false },
  );
  assert.equal(called, false);
});

test("verified non-admin session is authenticated but never marked as admin", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async (input, init = {}) => {
    calls += 1;
    assert.equal(
      String(input),
      "https://demo-project.supabase.co/auth/v1/user",
    );
    assert.equal(init.headers.Authorization, "Bearer verified.candidate.token");
    return Response.json({
      id: OTHER_ID,
      email: "candidate@example.invalid",
      email_confirmed_at: "2026-10-24T00:00:00.000Z",
    });
  };
  assert.deepEqual(
    await getSessionSummary(
      new Request("https://referral.example.invalid/api/session", {
        headers: { authorization: "Bearer verified.candidate.token" },
      }),
    ),
    {
      configured: true,
      authenticated: true,
      user: { id: OTHER_ID, email: "candidate@example.invalid" },
      isAdmin: false,
    },
  );
  assert.equal(calls, 1);
});
