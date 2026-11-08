# Project instructions

This project is a connected single-owner EA referral assistant. The screen scope follows [`docs/EA_Referral_Assistant_PRD.md`](docs/EA_Referral_Assistant_PRD.md). User-facing flows must use the configured providers and fail closed when unavailable; do not add in-memory fake records or simulated submissions.

## Product scope and boundaries

- Build candidate intake, candidate status, and private-owner review as connected flows. Keep APIs guarded and make provider/configuration failures explicit.
- Report successful uploads, sends, or submissions only after the connected provider confirms the operation. EA portal submission remains a manual owner action.
- Do not automate EA portal submissions, scrape LinkedIn, read LinkedIn messages, or invent EA policies/options. Treat unverified EA availability as unknown and keep manual owner review available.
- Auth token validation, owner checks, repository/API code, and database migrations exist. Connected uploads, bounded extraction for supported text-based PDF/DOCX files, submission, and owner review need provider and end-to-end verification. Supabase email-code sign-in needs Auth delivery setup; a separate status-link delivery flow is unavailable.
- Upload checks allow only bounded PDF/DOCX parsing and reject known active document features, but do not detect all malware. Do not describe these checks as antivirus scanning. Resume replacement stays scoped to the authenticated candidate's own job application and an explicit owner correction request; replacement invalidates the prior evidence assessment. Credentials belong in scoped provider settings, never in source control or browser-visible variables.
- Optional showcase participation must not increase a candidate's evidence score. The score is a documented evidence coverage heuristic; it is not a hiring or referral probability and never makes a decision for the owner.
- Tests may use synthetic data and reserved `.invalid` email addresses. Do not add real candidate personal data or synthetic records to user-facing flows.

## Engineering conventions

- Use the Next.js App Router and TypeScript. Prefer Server Components; use Client Components only for browser interaction.
- Keep domain behavior in small typed modules under `src/lib/domain/`. Validate all untrusted values at their boundary.
- Keep the single referral slot per canonical job invariant in domain transitions. A confirmed referral outranks a reservation; unknown listing availability must not admit intake.
- Use the canonical job identifier `EA:<digits>` and accept only documented official EA job URLs.
- Avoid new dependencies when the platform is sufficient. Keep `package-lock.json` as the only lockfile.
- Consult the installed Next.js documentation under `node_modules/next/dist/docs/` before using version-sensitive APIs. Keep the generated Next.js guidance below intact; `next dev` refreshes that block.

## Verification

- Run `npm test` for domain and mocked server-contract tests. Mocks do not verify live providers or SQL behavior.
- Run `npm run check` for lint, type, formatting, and focused test checks.
- Run `npm run build` after application or Next.js configuration changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
