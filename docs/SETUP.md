# Setup and deployment

This guide connects the existing app to Supabase, a malware scanning service, and Vercel. The database migrations are applied; provider settings and Vercel deployment still need to be completed. Connected mode has database, authentication, upload, and owner review code, but it is not a complete applicant service: see [Current limits](#current-limits).

## 1. Supabase project

Use the Supabase project named **ea-referral**, project reference `xqotcezfgirjdoowxpkz`. Its project URL is `https://xqotcezfgirjdoowxpkz.supabase.co`. Keep the secret key private and use the project's own keys; do not commit them.

### Environment variables

The server reads these exact variables (`src/server/config.ts` and `src/server/files/security.ts`):

| Variable                   | Value                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EA_REFERRAL_MODE`         | `connected` to enable connected server APIs. The default is `demo`.                                                                                 |
| `APP_ORIGIN`               | The exact origin serving this environment, such as `http://localhost:3000` or the Vercel production URL. No path or trailing slash is needed.       |
| `SUPABASE_URL`             | `https://xqotcezfgirjdoowxpkz.supabase.co`                                                                                                          |
| `SUPABASE_PUBLISHABLE_KEY` | The project's Supabase publishable key.                                                                                                             |
| `SUPABASE_SECRET_KEY`      | The project's Supabase secret key. Server-side only; never expose it to browser code.                                                               |
| `ADMIN_USER_ID`            | UUID of the Supabase Auth user who owns the admin workspace.                                                                                        |
| `FILE_SCANNER_URL`         | Optional HTTPS URL for the malware scan endpoint described below. Without it, files remain quarantined.                                             |
| `FILE_SCANNER_TOKEN`       | Optional bearer token for the scanner, if it requires authentication.                                                                               |
| `AI_GATEWAY_API_KEY`       | Required for live owner-triggered advisory assessments. Configure a Vercel AI Gateway credential (OIDC-issued where supported) or an API key.       |
| `AI_GATEWAY_MODEL`         | Required model identifier accepted by Vercel AI Gateway. Choose/configure this value for the intended provider; this guide does not select a model. |
| `RESEND_API_KEY`           | Required for connected notification sends through Resend.                                                                                           |
| `RESEND_FROM_EMAIL`        | Required sender address accepted by Resend; its domain must be verified with Resend first.                                                          |

Set variables only after configuring the matching provider. In Vercel, use **Project → Settings → Environment Variables** and select the intended **Production**, **Preview**, and/or **Development** scope for each variable. Set `APP_ORIGIN` separately for each deployment origin. Keep all Supabase, scanner, AI Gateway, and Resend variables server-only: do not prefix them with `NEXT_PUBLIC_`. Use a separate Supabase project for Preview if preview deployments should not access production data.

For local work, copy `.env.example` to `.env.local`, replace its placeholders with actual values, and keep `EA_REFERRAL_MODE=demo` until the connected setup is ready. `.env.local` is ignored by Git. The placeholder values in `.env.example` do not enable connected mode.

### Apply and verify database/storage migrations

The app expects these migrations, applied in timestamp order:

1. `supabase/migrations/20261023201621_create_ea_referral_resumes_bucket.sql`
2. `supabase/migrations/20261025024815_ea_referral_server_schema.sql`
3. `supabase/migrations/20261025031810_index_unindexed_foreign_keys.sql`
4. `supabase/migrations/20261025040049_purge_candidate_notification_outbox.sql`

All four migrations are already applied to the connected **ea-referral** Supabase project (`xqotcezfgirjdoowxpkz`). Remote history records `20261023201621 create_ea_referral_resumes_bucket`, `20261025024815 ea_referral_server_schema`, `20261025031810 index_unindexed_foreign_keys`, and `20261025040049 purge_candidate_notification_outbox`. Post-apply verification confirmed 10 public tables with both RLS and FORCE RLS enabled, no table grants to `anon` or `authenticated`, 70 table grants to `service_role`, and all 15 current RPCs executable by `service_role` only. The bucket `ea_referral_resumes` is private and limited to 4 MiB. There should be no public storage policy for this bucket.

The index migration adds indexes for the five previously unindexed foreign keys: `ea_referral_applications.candidate_id`, `ea_referral_audit.job_id`, `ea_referral_events.job_id`, `ea_referral_outbox.recipient_user_id`, and `ea_referral_resumes.job_id`. The corresponding unindexed-FK performance advisor findings are resolved. The privacy migration purges persisted notification outbox rows containing a candidate's email/message payload when that candidate is deleted, and rejects new queue entries when no matching candidate remains. It cannot recall a Resend request already in flight and accepted by the provider. Post-apply verification confirmed both privacy triggers are enabled and both trigger functions are `SECURITY INVOKER` with fixed `search_path=pg_catalog, public`. Other advisor INFO findings remain: 14 unused-index findings are expected before meaningful traffic, and 10 RLS/no-policy security INFO entries reflect the deliberate service-role-only table access. The advisors are not otherwise reported as clean.

Do not run these existing migrations again. For a future migration, add a timestamped SQL file under `supabase/migrations/` and apply it once through the project's migration tooling (for example, link the Supabase CLI to this project and run `supabase db push` from the repository root). Running SQL in the dashboard SQL Editor does not necessarily record migration history, so use the same migration workflow consistently.

To verify the completed setup, confirm **Database → Migrations** lists versions `20261023201621`, `20261025024815`, `20261025031810`, and `20261025040049`; the `ea_referral_*` tables and expected RPC functions exist; and **Storage → Buckets** contains a private `ea_referral_resumes` bucket with a 4 MiB file limit. The SQL Editor can check key objects, all five added indexes, and both privacy triggers:

```sql
select to_regclass('public.ea_referral_jobs') as jobs_table,
       to_regclass('public.ea_referral_applications') as applications_table,
       to_regprocedure('public.ea_referral_public_jobs()') as public_jobs_function;

select id, name, public, file_size_limit
from storage.buckets
where id = 'ea_referral_resumes';

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'ea_referral_applications_candidate_id_idx',
    'ea_referral_audit_job_id_idx',
    'ea_referral_events_job_id_idx',
    'ea_referral_outbox_recipient_user_id_idx',
    'ea_referral_resumes_job_id_idx'
  )
order by indexname;

select t.tgname, c.relname as table_name, t.tgenabled,
       p.proname as function_name, p.prosecdef, p.proconfig
from pg_trigger as t
join pg_class as c on c.oid = t.tgrelid
join pg_namespace as n on n.oid = c.relnamespace
join pg_proc as p on p.oid = t.tgfoid
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname in (
    'ea_referral_require_live_notification_candidate',
    'ea_referral_purge_candidate_notification_outbox'
  )
order by t.tgname;
```

Expected results are non-null table/function names, one bucket row with `public = false` and `file_size_limit = 4194304`, five index rows, and two enabled trigger rows (`tgenabled = 'O'`) whose functions have `prosecdef = false` and `proconfig` sets `search_path=pg_catalog, public`.

### Configure email-code sign-in and the owner

The app calls Supabase Auth's email OTP request and verification endpoints. In Supabase **Authentication → Providers → Email**, enable email sign-in and configure OTP email delivery. Use a numeric code template containing `{{ .Token }}`; the app accepts 6–8 digits and verifies with OTP type `email`. Configure the project's SMTP/email provider and rate limits as required for the intended use. In **Authentication → URL Configuration**, set the Site URL and allowed redirect origins to the local and deployed app origins you use.

Create or invite the intended owner in **Authentication → Users** and copy that user's UUID into `ADMIN_USER_ID` for each connected environment. After the app is deployed and connected, sign in at `/sign-in` with that email to confirm OTP delivery and owner access; redeploy/restart after changing the variable. Admin access is granted only when the authenticated Supabase user ID exactly matches this value. Candidate and owner sign-in both depend on successful Supabase OTP delivery.

### Configure AI Gateway advisory assessment

The owner can explicitly request an advisory evidence assessment from an application review. Add `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` to the desired server environment. The code sends `AI_GATEWAY_API_KEY` as a bearer credential. You may use a Gateway API key or a Vercel OIDC credential if your runtime makes its Gateway-compatible token available under this exact variable; this code does not retrieve an OIDC token itself. Choose the model identifier appropriate for your provider and enter it as `AI_GATEWAY_MODEL`; no model is selected or configured in this repository. The assessment sends redacted resume text and the job description to the Gateway only after the owner requests it. The output is advisory, cites source text, and does not update an application decision. No live Gateway call or provider setup has been performed as part of this work.

### Configure Resend notifications

Connected notification preview and send APIs are implemented, and the owner notification screen is wired to them. To enable delivery, configure a sending domain in Resend, publish the DNS records Resend provides, wait for domain verification, and set `RESEND_API_KEY` plus a verified sender address in `RESEND_FROM_EMAIL` for the intended Vercel environments. Those account and DNS steps remain for the operator; no sender domain has been configured here. Sends require an owner to review the current preview and explicitly approve it. Without both variables, previews can still be shown, but the send action is unavailable.

## 2. Malware scanner endpoint

`FILE_SCANNER_URL` must point to an HTTPS endpoint (plain HTTP is accepted only for localhost development). For each uploaded file, the app sends a `POST` whose body is the raw file bytes and whose headers are:

| Header                                   | Meaning                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| `Content-Type: application/octet-stream` | Request body is the raw uploaded bytes.               |
| `Content-Length`                         | Exact byte length.                                    |
| `X-File-Name`                            | URL-encoded original filename.                        |
| `X-File-Content-Type`                    | Detected/accepted file media type.                    |
| `X-File-SHA256`                          | Lowercase SHA-256 hex digest of the exact body bytes. |
| `Authorization: Bearer …`                | Sent only when `FILE_SCANNER_TOKEN` is set.           |

The endpoint must return a successful HTTP status and a JSON response no larger than 4 KiB, for example:

```json
{ "status": "clean", "sha256": "<lowercase SHA-256 of the request body>" }
```

`status` must be exactly `clean` or `malicious`, and `sha256` must match the request's `X-File-SHA256`. Any timeout (12 seconds), network error, redirect, non-success status, malformed/oversized response, unrecognized status, or digest mismatch is treated as `quarantined`. A malicious result is rejected. A clean result is required before a file can be used in an application or downloaded. This is fail-closed: leave the scanner unset until a compatible endpoint is ready, and expect uploads to remain quarantined in the meantime.

## 3. Vercel and GitHub deployment

1. In Vercel, choose **Add New → Project**, import the GitHub repository, and select `main` as the Production Branch.
2. Keep the detected Next.js framework settings. The repository scripts provide `npm ci` for installation and `npm run build` for the production build; the production server uses `npm run start` if needed.
3. Complete the Supabase OTP mail/redirect setup, scanner endpoint configuration, AI Gateway credential and model selection (if using advisory assessment), and Resend sender/domain/DNS setup (if using notification delivery).
4. Add the production environment variables from the table above, including the production `APP_ORIGIN`, correct `ADMIN_USER_ID`, and only the configured provider credentials. Keep `EA_REFERRAL_MODE=demo` until live configuration and integration checks are complete.
5. Deploy the initial commit. Add the resulting production origin to Supabase Authentication's Site URL/allowed URLs, then redeploy if environment variables changed.
6. Vercel will create Preview deployments for GitHub branches and deploy commits merged or pushed to `main` as Production. Scope environment variables deliberately; a preview should not silently inherit production secrets or write to the production database.

## 4. Local and deployment checks

The repository requires Node.js 24 or newer (`.nvmrc` selects 24) and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Demo mode should work without provider credentials. To check the repository's automated quality gates and production build:

```sh
npm run check
npm run build
npm run start
```

`npm run check` runs ESLint, Next.js type generation and TypeScript checks, Prettier check, and the Node test suite. `npm run start` serves the build created by `npm run build`; open `http://localhost:3000` while it is running. These checks use mocks/fixtures and do not prove that live Supabase, Auth email delivery, storage, or the scanner is configured correctly.

After provider configuration and deployment, manually verify in a browser: request and verify an OTP, confirm the configured owner sees admin routes and a non-owner does not, confirm the job list/API reads from the database, exercise a test upload with a compatible scanner, request an advisory assessment if configured, and preview/send a test notification only after Resend and its sender domain are verified. A clean upload should only proceed after both the scanner returns a matching digest and the resume parser can read the supported text-based PDF/DOCX content. Confirm storage remains private and downloads require authorization. Do not use real applicant files for setup checks. No browser verification has been performed.

## Current limits

- Resend notification preview/send code is implemented, but Resend account setup, `RESEND_API_KEY`, verified sender/domain DNS, and live delivery verification remain outstanding. There is no separate status-link sender. Supabase Auth OTP delivery is separately configured through Supabase.
- AI Gateway advisory assessment code is implemented, but `AI_GATEWAY_API_KEY`, operator-selected `AI_GATEWAY_MODEL`, and live provider verification remain outstanding. The model is called only on explicit owner request; it is not a decision-maker.
- OCR is unavailable. Resume extraction supports bounded text-based PDF and DOCX parsing only, with limited PDF operator/font coverage.
- The app does not automate EA referral submissions, scrape LinkedIn, or read LinkedIn messages. The owner must review and submit any referral manually.
- Vercel project setup, provider configuration, deployment, and browser verification remain outstanding. Configuring services does not by itself make the connected workflow production-ready; integration and operational review are still required.
