# EA Referral Assistant

A connected single-owner referral workspace for candidate intake, application status, and private owner review. The application uses Supabase for authentication, database records, and private file storage. It does not generate pretend records or submit referrals to EA automatically.

The product requirements are in [`docs/EA_Referral_Assistant_PRD.md`](docs/EA_Referral_Assistant_PRD.md). Current implementation and remaining provider setup are tracked in [`docs/project-progress.md`](docs/project-progress.md). See [`docs/SETUP.md`](docs/SETUP.md) for configuration.

## Run locally

Requirements: Node.js 24 (selected by `.nvmrc`) and npm. Copy `.env.example` to `.env.local`, then configure the required connected settings before starting the app:

```sh
npm ci
npm run dev
```

The server fails closed until required Supabase and owner settings are valid. Do not put private keys in browser-prefixed variables or commit `.env.local`.

## Required environment variables

- `EA_REFERRAL_MODE=connected`
- `APP_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only)
- `ADMIN_USER_ID` (UUID of the owner’s Supabase Auth user)

Optional integrations are documented in `.env.example`: owner-triggered advisory assessment through OpenRouter and owner-approved Resend notifications. PDF and DOCX files pass bounded in-process format, active-content, and parser checks before storage in the private Supabase bucket. These checks are not a full antivirus scan.

## Commands

```sh
npm run dev          # Start the development server
npm test             # Run domain unit tests and mocked server-contract tests
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run format       # Format supported files
npm run format:check # Check formatting
npm run check        # Lint, typecheck, formatting, and tests
npm run build        # Build for production
npm run start        # Serve the production build
```

## Current deployment state

The Vercel project `ea-referral` is linked to `aashikvilla/ea-referral`, deploys `main` with Node 24, and uses `https://ea-referral.vercel.app`. Its environment is connected-only. The Supabase project is active; all five repository migrations are applied, ten referral tables have RLS and FORCE RLS enabled, client roles have no table access, the service role has the required access, the resume bucket is private, and database advisors report no issues.

The owner account exists and its UUID is set as `ADMIN_USER_ID` in Vercel Production. Configure and verify Supabase email OTP delivery before using connected sign-in and intake. See the setup guide for the complete checklist and limits.

## Boundaries

The owner makes all referral decisions and completes any EA portal submission manually. The application does not scrape EA or LinkedIn, read LinkedIn messages, or infer hiring outcomes. Optional work samples do not raise evidence scores.
