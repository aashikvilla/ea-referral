# EA Referral Assistant

EA Referral Assistant is an interactive demo of a fictional personal referral request workflow. In demo mode, candidate and owner screens use invented records held in per-tab memory. No request, resume file, status email, or EA referral is sent to an external service.

The product requirements are recorded in [`docs/EA_Referral_Assistant_PRD.md`](docs/EA_Referral_Assistant_PRD.md). Current screen coverage and remaining demo gaps are tracked in [`docs/project-progress.md`](docs/project-progress.md).

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

Demo mode supports local intake, review, status, and manual referral decision demonstrations. Connected-mode auth checks, repository methods, and APIs for uploads, validation, submission, status, and owner review are present. The migration is unapplied and provider accounts are not configured, so connected mode is not ready for real applicants. The following work is still missing or unverified:

- **Authentication experience:** candidate email-code sign-in UI, OTP request/verify APIs, token validation, and configured-owner checks exist. Supabase Auth and OTP email delivery are not configured or integration-tested.
- **Database:** server repository code and a Supabase migration exist, but the migration has not been applied or integration-tested. Demo records remain in per-tab memory.
- **Application intake:** connected `POST /api/applications` validates a verified account, open job, slot, clean/readable resume, and supporting files before calling the submission RPC. The route and repository exist, but database behavior is not integration-tested and requires the unapplied migration.
- **Storage:** connected private resume and optional supporting-file upload routes exist. They require configured Supabase storage and the unapplied bucket migration.
- **Resume parsing:** connected code extracts text from supported text-based PDF and DOCX files and checks for first name, last name, email, and phone. PDF operator/font support is limited, so this is not a general PDF compatibility guarantee; OCR is not provided. Malware scanning stays quarantined unless a scanner endpoint returns a verified result. Resume replacement is limited to the candidate's own application for that job after the owner requests `correction_required`; the new version clears the previous assessment and returns for review.
- **Candidate status:** authenticated status APIs and candidate sign-in UI exist. A separate emailed private status-link/access flow is unavailable; OTP delivery depends on Supabase Auth configuration.
- **AI analysis:** any score or evidence summary is illustrative and rule-based; no model is called.
- **Email:** no email sending implementation/provider call exists. No status link or notification is sent.
- **Deployment:** no production deployment or provider configuration is included.

Supabase groundwork includes server environment validation, token validation, sign-in UI/API, repository methods, application/file APIs, a placeholder `.env.example`, and SQL migrations. The environment file contains placeholders only, and the migration has not been applied. Mocked server-contract tests do not verify a live Supabase project, scanner, storage, or SQL execution.

EA job references are fictional sample records. The app does not scrape EA or LinkedIn, access LinkedIn messages, or submit referrals to EA. The owner remains responsible for any real referral decision and portal submission.

## Repository guidance

- [`AGENTS.md`](AGENTS.md) contains the current product boundaries and engineering conventions, followed by generated Next.js guidance.
- [`docs/project-progress.md`](docs/project-progress.md) maps PRD screens C01–C08 and A01–A08 to their current implementation status.
- No service credentials or secrets belong in this repository.
