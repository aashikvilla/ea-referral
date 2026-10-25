# EA Referral Assistant

EA Referral Assistant is an interactive demo of a fictional personal referral request workflow. In demo mode, candidate and owner screens use invented records held in per-tab memory. No request, resume file, status email, or EA referral is sent to an external service.

The product requirements are recorded in [`docs/EA_Referral_Assistant_PRD.md`](docs/EA_Referral_Assistant_PRD.md). Current screen coverage and remaining demo gaps are tracked in [`docs/project-progress.md`](docs/project-progress.md).
Provider and deployment steps are in [`docs/SETUP.md`](docs/SETUP.md).

## Run locally

Requirements: Node.js 24 (selected by `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. All sample identities and contact details are fictional; example email domains use `.invalid`.

## Commands

```sh
npm run dev          # Start the development server
npm test             # Run domain unit tests with Node's test runner
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run format       # Format supported files
npm run format:check # Check formatting
npm run check        # Lint, typecheck, check formatting, and run tests
npm run build        # Build for production
npm run start        # Serve the production build
```

## Demo and connected-mode boundaries

Demo mode supports local intake, review, status, funnel metrics, notifications, and manual referral decision demonstrations using per-tab fictional data. Connected code includes auth, database repository methods, uploads, validation, submission, status, owner review, rolling 30-day pseudonymous funnel metrics, owner-triggered advisory assessment, and notification preview/send APIs. The Supabase migrations are applied to the `ea-referral` project, but provider setup, Vercel deployment, and browser verification have not been completed; connected mode is not ready for real applicants.

- **Authentication experience:** candidate email-code sign-in UI, OTP request/verify APIs, token validation, and configured-owner checks exist. Supabase Auth and OTP email delivery are not configured or integration-tested.
- **Database:** migrations `20261023201621`, `20261025024815`, `20261025031810`, and `20261025040049` are applied to Supabase project `xqotcezfgirjdoowxpkz`. Post-apply checks confirmed 10 public tables with RLS and FORCE RLS, zero table grants to `anon`/`authenticated`, 70 `service_role` table grants, and 15 service-role-only RPCs. The index migration covers five previously flagged foreign keys. The privacy migration purges a candidate's persisted notification outbox rows on deletion and blocks new queue entries afterward; an already in-flight Resend send cannot be recalled. Live repository behavior is not integration-tested. Demo records remain in per-tab memory.
- **Application intake:** connected `POST /api/applications` validates verified identity, open job and slot, clean/readable resume, and supporting files before calling the submission RPC. Live database/provider behavior remains unverified.
- **Storage:** connected private resume and optional supporting-file upload routes exist. The private `ea_referral_resumes` bucket migration is applied with a 4 MiB limit; actual uploads require configured Supabase credentials and a compatible scanner.
- **Resume parsing:** connected code extracts text from supported text-based PDF and DOCX files and checks for first name, last name, email, and phone. PDF operator/font support is limited, so this is not a general PDF compatibility guarantee; OCR is not provided. Malware scanning stays quarantined unless a scanner endpoint returns a verified result. Resume replacement is limited to the candidate's own application for that job after the owner requests `correction_required`; the new version clears the previous assessment and returns for review.
- **Candidate status:** authenticated status APIs and candidate sign-in UI exist. A separate emailed private status-link/access flow is unavailable; OTP delivery depends on Supabase Auth configuration.
- **Funnel metrics:** connected event capture uses HMAC-derived pseudonymous keys and displays distinct counts over the latest 30 days. Tracking is limited to role views, intake starts, and eligibility checks; submission and confirmed referral counts use application IDs.
- **AI assessment:** owner-triggered Vercel AI Gateway advisory assessment code is implemented. It sends redacted resume text and the job description only on explicit owner request; the output is validated and does not make or change a decision. `AI_GATEWAY_API_KEY` and operator-selected `AI_GATEWAY_MODEL` are not configured, and no live Gateway call has been made.
- **Notifications:** connected preview/send APIs and owner UI are implemented. Notifications are not sent automatically on submission; the owner must review a current preview and explicitly approve a send. Delivery requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and a verified sender domain. Resend and DNS are not configured; there is no separate status-link sender.
- **Deployment:** no Vercel project setup or production deployment has happened. Provider configuration and browser end-to-end verification remain outstanding.

Supabase integration includes server environment validation, token validation, sign-in UI/API, repository methods, application/file APIs, a placeholder `.env.example`, and SQL migrations. The environment file contains placeholders only. Mocked server-contract tests do not verify a live Supabase project, Auth mail delivery, scanner, storage, AI Gateway, Resend, or SQL execution. No browser verification has been performed.

EA job references are fictional sample records. The app does not scrape EA or LinkedIn, access LinkedIn messages, or submit referrals to EA. The owner remains responsible for any real referral decision and portal submission.

## Repository guidance

- [`AGENTS.md`](AGENTS.md) contains the current product boundaries and engineering conventions, followed by generated Next.js guidance.
- [`docs/project-progress.md`](docs/project-progress.md) maps PRD screens C01–C08 and A01–A08 to their current implementation status.
- No service credentials or secrets belong in this repository.
