# Project progress

**Scope:** interactive demo of a fictional EA referral workflow, with substantial connected API, repository, auth, file-processing, and database migration code. The current demo mode uses invented data in per-tab memory. Connected mode is not ready for real applicants: provider setup, migration deployment, configured malware scanning, and end-to-end integration verification remain incomplete.

## Screen coverage

“Implemented” means a complete demo interaction is present. “Partial” means the screen exists but a material interaction or production dependency is missing. “Deferred” means no corresponding screen or flow is present. These labels do not imply production readiness.

| ID  | Screen                        | Status      | Current coverage                                                                                                                                                                                                                     |
| --- | ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C01 | Referral landing / job lookup | Partial     | Home has free-form EA job ID/official URL lookup and known job states. The resolver searches configured records only; no live EA availability check exists.                                                                          |
| C02 | Eligibility / quick checks    | Implemented | Demo intake records prior application/referral, relationship, and location answers, with stop and review outcomes. Server intake validation exists.                                                                                  |
| C03 | Candidate details             | Implemented | Demo details and relationship are collected. Candidate email-code sign-in and verification UI/API exist; actual delivery depends on configured Supabase Auth email settings.                                                         |
| C04 | Resume correction             | Partial     | Demo file selection and readiness fields are present. Connected PDF/DOCX upload, extraction, and job-scoped replacement after owner correction are implemented; scanner/storage setup and deployed SQL are unverified.               |
| C05 | Optional showcase             | Partial     | Optional note, HTTPS links, and local file selection are demonstrated. Connected supporting-file upload route exists but requires configured scanning/storage; participation does not affect scoring.                                |
| C06 | Review & submit               | Partial     | Demo mode saves a fictional request to per-tab memory. Connected submission validates identity, eligibility, slot, resume readiness, and supporting files before its persistence RPC; migration/provider flow is unverified.         |
| C07 | Submission confirmation       | Partial     | Demo shows a local receipt. Connected submission returns an application ID and a confirmation view; no application notification email is sent.                                                                                       |
| C08 | Candidate status              | Partial     | Sign-in UI/API and authenticated status APIs exist. Supabase OTP email delivery must be configured; a separate emailed private status-link/access flow is unavailable.                                                               |
| A01 | Admin overview                | Partial     | Demo overview uses fictional in-memory records. Connected guarded workspace API and owner allowlist checks exist; auth provider setup and migration deployment are unverified.                                                       |
| A02 | Job management                | Partial     | Demo create/edit interactions and connected admin endpoints exist. Connected use depends on the unapplied schema migration and configured Supabase project; no EA availability provider is connected.                                |
| A03 | Job workspace                 | Partial     | Demo job pool, slot state, filters, and controls are available. Server repository and referral RPC groundwork exist; SQL has not been applied or integration-tested.                                                                 |
| A04 | Candidate detail              | Partial     | Demo evidence, eligibility, resume readiness, and status controls are shown. Connected private resume storage and PDF/DOCX parsing routes exist; storage, scanning, and review behavior need deployed services and SQL verification. |
| A05 | Candidate comparison          | Implemented | Demo compares evidence coverage and match components. Scoring is advisory and does not decide who is selected.                                                                                                                       |
| A06 | Referral preparation          | Partial     | Demo reserve/release/confirm workflow exists, and guarded server RPC endpoints are implemented. EA submission remains manual; SQL is unapplied and portal success cannot be verified.                                                |
| A07 | Notification review           | Partial     | Local recipient/template preview is available. Sending is disabled; no email delivery implementation or provider call exists.                                                                                                        |
| A08 | Settings and audit            | Partial     | Demo settings and session activity are shown. Auth UI/API and server audit code exist; provider setup, durable audit verification, retention controls, and deployment configuration remain incomplete.                               |

## Shipped code and remaining work

- **Demo:** candidate and owner screens use fictional fixtures. Demo changes live in per-tab memory and are not durable.
- **Authentication code:** candidate email-code sign-in UI and auth request/verify APIs exist. Connected APIs validate access tokens and check the configured owner identity. Supabase Auth and its OTP email delivery are not configured or integration-tested.
- **Database code:** server repository methods and `supabase/migrations/20261024080000_ea_referral_server_schema.sql` define connected persistence and referral-slot RPCs. The migration has not been applied, and the SQL has not been executed or integration-tested against Supabase.
- **Application intake:** connected `POST /api/applications` validates verified identity, job/slot availability, resume ownership and readiness, and supporting files before calling the submission RPC. The route and repository exist; SQL is unapplied and provider behavior is not integration-tested.
- **Candidate status:** status APIs require verified identity. Once the configured Auth OTP flow succeeds, candidates can access their own status; separate private status-link delivery and email notifications are not implemented.
- **Resume storage and parsing:** private resume and supporting-file upload routes, configurable scanner client, and bounded extraction for supported text-based PDF/DOCX files exist. PDF operator and font support is limited, so this is not a general PDF compatibility guarantee. The migration is unapplied; absent or failing scanner configuration fails closed to quarantine. OCR is not implemented. SQL scopes resume replacement to the authenticated candidate's own job application and permits it only after the owner sets `correction_required`; replacement increments the job-specific version, clears the old readiness and assessment, and routes the application back for review. The candidate correction experience still needs full end-to-end verification.
- **Availability:** manual job state can be stored, but no official EA availability checker is connected. Unknown availability remains ineligible for intake.
- **Assessment:** evidence coverage uses a documented deterministic heuristic. No AI model, extraction, or generated assessment is connected.
- **Email:** the app has no application notification or status-link sender. Auth OTP delivery is delegated to Supabase Auth and depends on its email configuration.
- **Deployment:** no production environment, configured provider accounts, monitoring, or release pipeline is included.
- **External sources:** no EA scraping/API, LinkedIn integration, LinkedIn message access, or automated referral submission exists.

## Configuration files

`.env.example` contains placeholders for Supabase server settings and documents the demo default. It contains no secrets. Setting connected mode alone does not make the system production-ready; Supabase OTP email setup, scanner/storage configuration, migration deployment, and end-to-end verification remain outstanding.

## Verification

`npm test` runs domain unit tests and mocked server-contract tests. Server-contract tests replace `fetch` with local mocks; they do not contact Supabase, verify SQL behavior, send email, or constitute end-to-end tests. Migration coverage has only been reviewed statically. Connected routes require configured services and successful SQL deployment before real use.
