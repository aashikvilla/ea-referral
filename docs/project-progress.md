# Project progress

The repository now contains connected candidate intake, status, and private owner-review flows. No in-memory fallback records or simulated submission paths are part of the application. Setting `EA_REFERRAL_MODE` to anything other than `connected`, or omitting required provider settings, disables server-backed operations.

## Connected flows

- **Candidate journey:** job lookup uses configured database records; identity uses Supabase email OTP; resume and supporting-file routes validate ownership, bounded document structure, and supported extraction before submission.
- **Candidate status:** authenticated status APIs are scoped to the signed-in candidate. A separate emailed status-link flow is not implemented.
- **Owner workspace:** server routes enforce the configured Supabase Auth owner UUID. Job, application, referral slot, notification, deletion, and assessment operations are server-backed.
- **Database:** migrations `20261023201621`, `20261025024815`, `20261025031810`, `20261025040049`, and `20261108113034` are recorded as applied. CLI checks confirmed ten referral tables with RLS and FORCE RLS enabled, no table access for `anon` or `authenticated`, appropriate service-role access, and trigger functions unavailable to client roles. The resume bucket is private with a 4 MiB file limit. Supabase database advisors reported no issues.
- **Availability:** an owner must verify each job’s availability. There is no automated EA availability service. Unknown availability cannot accept intake.
- **Assessment:** owner-triggered advisory evidence assessment uses OpenRouter with a free primary model and free model fallbacks. `OPENROUTER_API_KEY` is configured in Vercel Production; a live assessment request still needs verification. Model/provider terms may allow retention or training; only name/email/phone are redacted before sending. It does not make or change a referral decision.
- **Notifications:** owner-reviewed notification previews and explicit sends are implemented but require a verified Resend sender. Email is not automatically sent on submission.

## Remaining setup

- The owner Auth account exists and its UUID is configured as `ADMIN_USER_ID` in Vercel Production. Configure Supabase Auth email OTP delivery and the allowed app origins.
- Configure and integration-test private storage, Auth, database repository methods, and owner workflows end to end.
- The OpenRouter key and free model settings are configured in Vercel Production. Configure Resend settings if notifications are needed.
- Preview and Development intentionally have no Production Supabase credentials. Local smoke verification used Production variables for read-only requests.

## Environment configuration

`.env.example` lists the exact settings. Required connected values are `EA_REFERRAL_MODE`, `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `ADMIN_USER_ID`; all are configured for Vercel Production. OpenRouter key/model settings are also configured in Production. Resend variables remain optional and unset.

## Verification

`npm test` runs domain unit tests and mocked server-contract tests. The mocks do not verify live Auth delivery, storage, emails, AI calls, or browser workflows. Live schema state and migration history were checked through the Supabase CLI; application-level integration verification still remains.
