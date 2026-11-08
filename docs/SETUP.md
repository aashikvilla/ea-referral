# Setup and deployment

This guide configures the connected app with Supabase and Vercel. All five database migrations are applied, and the GitHub repository is linked to Vercel. The application fails closed until the required settings and provider checks are complete: see [Current limits](#current-limits).

## 1. Supabase project

Use the Supabase project named **ea-referral**, project reference `xqotcezfgirjdoowxpkz`. Its project URL is `https://xqotcezfgirjdoowxpkz.supabase.co`. Keep the secret key private and use the project's own keys; do not commit them.

### Environment variables

The server reads these exact variables (`src/server/config.ts`, `src/server/assessment.ts`, and `src/server/files/security.ts`):

| Variable                     | Value                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `EA_REFERRAL_MODE`           | Must be `connected`. Missing or any other value disables connected server operations.                                                         |
| `APP_ORIGIN`                 | The exact origin serving this environment, such as `http://localhost:3000` or the Vercel production URL. No path or trailing slash is needed. |
| `SUPABASE_URL`               | `https://xqotcezfgirjdoowxpkz.supabase.co`                                                                                                    |
| `SUPABASE_PUBLISHABLE_KEY`   | The project's Supabase publishable key.                                                                                                       |
| `SUPABASE_SECRET_KEY`        | The project's Supabase secret key. Server-side only; never expose it to browser code.                                                         |
| `ADMIN_USER_ID`              | UUID of the Supabase Auth user who owns the admin workspace.                                                                                  |
| `OPENROUTER_API_KEY`         | Optional secret for owner-triggered advisory assessments. Store server-side only.                                                             |
| `OPENROUTER_MODEL`           | Optional primary model. Defaults to `google/gemma-4-31b-it:free`; only `:free` model IDs are accepted.                                        |
| `OPENROUTER_FALLBACK_MODELS` | Optional comma-separated fallback IDs. Defaults to free models listed in `.env.example`; paid model IDs are ignored.                          |
| `RESEND_API_KEY`             | Required for connected notification sends through Resend.                                                                                     |
| `RESEND_FROM_EMAIL`          | Required sender address accepted by Resend; its domain must be verified with Resend first.                                                    |

Set variables only after configuring the matching provider. In Vercel, use **Project → Settings → Environment Variables** and select the intended **Production**, **Preview**, and/or **Development** scope for each variable. Set `APP_ORIGIN` to the production origin and `http://localhost:3000` for local development. On Vercel, same-origin mutation checks also allow the exact generated deployment host from the platform's `VERCEL_URL`, so previews do not need a hard-coded per-deployment origin. Keep Supabase, OpenRouter, and Resend secrets server-side: do not prefix them with `NEXT_PUBLIC_`. Use a separate Supabase project for Preview if preview deployments should not access production data.

For local work, copy `.env.example` to `.env.local` and replace its placeholders with values from a non-production Supabase project. `.env.local` is ignored by Git. Do not use Production secrets in local development or Preview deployments.

### Apply and verify database/storage migrations

The app expects these migrations, applied in timestamp order:

1. `supabase/migrations/20261023201621_create_ea_referral_resumes_bucket.sql`
2. `supabase/migrations/20261025024815_ea_referral_server_schema.sql`
3. `supabase/migrations/20261025031810_index_unindexed_foreign_keys.sql`
4. `supabase/migrations/20261025040049_purge_candidate_notification_outbox.sql`
5. `supabase/migrations/20261108113034_revoke_notification_trigger_function_execute.sql`

All five migrations are applied to the connected **ea-referral** Supabase project (`xqotcezfgirjdoowxpkz`). Remote history includes the four schema/storage migrations above and `20261108113034 revoke_notification_trigger_function_execute`. Verification confirmed 10 public tables with both RLS and FORCE RLS enabled, no table grants to `anon` or `authenticated`, 70 table grants to `service_role`, and the application RPCs are executable by `service_role` only. The two trigger functions are not executable by `anon` or `authenticated`; the bucket `ea_referral_resumes` is private and limited to 4 MiB. There should be no public storage policy for this bucket.

The index migration adds indexes for the five previously unindexed foreign keys: `ea_referral_applications.candidate_id`, `ea_referral_audit.job_id`, `ea_referral_events.job_id`, `ea_referral_outbox.recipient_user_id`, and `ea_referral_resumes.job_id`. The corresponding unindexed-FK performance advisor findings are resolved. The privacy migration purges persisted notification outbox rows containing a candidate's email/message payload when that candidate is deleted, and rejects new queue entries when no matching candidate remains. It cannot recall a Resend request already in flight and accepted by the provider. Post-apply verification confirmed both privacy triggers are enabled and both trigger functions are `SECURITY INVOKER` with fixed `search_path=pg_catalog, public`. Other advisor INFO findings remain: 14 unused-index findings are expected before meaningful traffic, and 10 RLS/no-policy security INFO entries reflect the deliberate service-role-only table access. The advisors are not otherwise reported as clean.

Do not run these existing migrations again. For a future migration, add a timestamped SQL file under `supabase/migrations/` and apply it once through the project's migration tooling (for example, link the Supabase CLI to this project and run `supabase db push` from the repository root). Running SQL in the dashboard SQL Editor does not necessarily record migration history, so use the same migration workflow consistently.

To verify the completed setup, confirm **Database → Migrations** lists versions `20261023201621`, `20261025024815`, `20261025031810`, `20261025040049`, and `20261108113034`; the `ea_referral_*` tables and expected RPC functions exist; and **Storage → Buckets** contains a private `ea_referral_resumes` bucket with a 4 MiB file limit. The SQL Editor can check key objects, all five added indexes, and both privacy triggers:

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

### Configure OpenRouter advisory assessment

The owner can explicitly request an advisory evidence assessment from an application review. Create an API key in [OpenRouter](https://openrouter.ai/settings/keys) and add it as `OPENROUTER_API_KEY` in Vercel. The default primary model is `google/gemma-4-31b-it:free`, currently listed at $0 and supporting structured output. If it is unavailable, OpenRouter receives a fallback list of other current `:free` models. The app refuses model IDs without the `:free` suffix so it cannot silently switch to paid inference.

OpenRouter's free tier currently allows 50 free-model requests per day and 20 per minute; failed attempts count toward the daily limit. Model fallbacks can help with a model or provider outage, but cannot bypass the account-wide quota. When quota is exhausted or all free models fail, the assessment is unavailable and owner review continues manually. Do not configure paid credits for this project without an explicit budget decision.

The assessment sends resume text with detected name, email, and phone redacted, plus the job description, only when the owner presses the assessment button. OpenRouter may route the request to its model provider, whose retention and training terms vary. Review the terms shown for your selected model/provider. The output is advisory, cites source text, and never updates an application decision. No API key or live request has been configured yet.

### Configure Resend notifications

Connected notification preview and send APIs are implemented, and the owner notification screen is wired to them. To enable delivery, configure a sending domain in Resend, publish the DNS records Resend provides, wait for domain verification, and set `RESEND_API_KEY` plus a verified sender address in `RESEND_FROM_EMAIL` for the intended Vercel environments. Those account and DNS steps remain for the operator; no sender domain has been configured here. Sends require an owner to review the current preview and explicitly approve it. Without both variables, previews can still be shown, but the send action is unavailable.

## 2. In-process file checks and Supabase Storage

The app accepts only PDF and DOCX files, verifies the declared MIME type against the file extension and signature, caps uploads at 4 MiB, and parses the content with bounded PDF page, ZIP entry, archive expansion, and text limits. It rejects known active PDF actions, DOCX macros and embedded active objects, invalid ZIP/XML structures, and files that the supported parser cannot safely read. Files that pass are uploaded by the server to the existing private `ea_referral_resumes` Supabase bucket. The secret key is never sent to the browser; downloads require an authenticated owner/candidate route and use a short-lived signed URL.

These checks are deterministic format and content checks, not antivirus software. They reduce risk from malformed files and common active document features, but they cannot detect every malware payload. Do not describe a passing file as virus-free, and do not use this flow for executable files. A failed check rejects the upload before it is stored.

## 3. Vercel and GitHub deployment

1. The Vercel project `ea-referral` is linked to GitHub repository `aashikvilla/ea-referral`; `main` is the production branch and Node 24 matches `.nvmrc` and GitHub Actions. Vercel uses the repository root and the detected Next.js build defaults.
2. The verified production domain is `https://ea-referral.vercel.app`. `EA_REFERRAL_MODE=connected` is set for Production, Preview, and Development. `APP_ORIGIN` is set to the production domain for Production and `http://localhost:3000` for Development. Vercel's generated `VERCEL_URL` is also accepted for exact same-origin checks on Preview deployments.
3. Production has `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and an encrypted `SUPABASE_SECRET_KEY`. `OPENROUTER_MODEL` and `OPENROUTER_FALLBACK_MODELS` are set to free models; `OPENROUTER_API_KEY` is still missing. No Supabase Auth user exists yet, so `ADMIN_USER_ID` is missing and connected routes remain unavailable until the owner account is created and configured. Preview/Development intentionally do not receive Production Supabase credentials.
4. Vercel automatically deploys pushes to `main` as Production and creates Preview deployments for other Git branches. The GitHub Actions workflow runs repository checks and the production build; it does not deploy independently.
5. Add each connected app origin to Supabase Authentication's Site URL/allowed URLs, use separate Preview credentials, and redeploy after changing environment variables.

## 4. Local and deployment checks

The repository pins Node.js 24 (`.nvmrc`, `package.json`, GitHub Actions, and Vercel project settings) and uses npm. From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Connected routes remain unavailable until local provider settings are configured. To check the repository's automated quality gates and production build:

```sh
npm run check
npm run build
npm run start
```

`npm run check` runs ESLint, Next.js type generation and TypeScript checks, Prettier check, and the Node test suite. `npm run start` serves the build created by `npm run build`; open `http://localhost:3000` while it is running. These checks use mocks/fixtures and do not prove that live Supabase, Auth email delivery, storage, or OpenRouter is configured correctly.

After provider configuration and deployment, manually verify in a browser: request and verify an OTP, confirm the configured owner sees admin routes and a non-owner does not, confirm the job list/API reads from the database, upload a synthetic PDF/DOCX test file and confirm it reaches the private bucket after built-in checks, request an assessment if configured, and preview/send a test notification only after Resend and its sender domain are verified. Confirm downloads require authorization. Do not use real applicant files for setup checks.

## Current limits

- Resend notification preview/send code is implemented, but Resend account setup, `RESEND_API_KEY`, verified sender/domain DNS, and live delivery verification remain outstanding. There is no separate status-link sender. Supabase Auth OTP delivery is separately configured through Supabase.
- OpenRouter advisory assessment code is implemented, but `OPENROUTER_API_KEY` and live provider verification remain outstanding. The model is called only on explicit owner request; it is not a decision-maker.
- OCR is unavailable. Resume extraction supports bounded text-based PDF and DOCX parsing only, with limited PDF operator/font coverage.
- The app does not automate EA referral submissions, scrape LinkedIn, or read LinkedIn messages. The owner must review and submit any referral manually.
- Vercel project setup and deployment are configured. Auth owner setup, SMTP/OTP delivery, optional providers, and browser verification remain outstanding. Configuring services does not by itself make the connected workflow production-ready; integration and operational review are still required.
