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

Optional integrations are documented in `.env.example`: file scanning, advisory assessment through AI Gateway, and owner-approved Resend notifications. File uploads remain quarantined until a scanner verifies them.

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

The production app remains unavailable until an owner account is created in Supabase Auth and its UUID is set as `ADMIN_USER_ID`. Email OTP delivery and a malware scanner also need configuration before real intake can be accepted. See the setup guide for the complete checklist and limits.

## Boundaries

The owner makes all referral decisions and completes any EA portal submission manually. The application does not scrape EA or LinkedIn, read LinkedIn messages, or infer hiring outcomes. Optional work samples do not raise evidence scores.
