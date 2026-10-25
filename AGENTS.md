# Project instructions

This project is an interactive demo of a fictional EA referral assistant, with connected-mode auth, API, repository, file processing, and database migration groundwork. The screen scope follows [`docs/EA_Referral_Assistant_PRD.md`](docs/EA_Referral_Assistant_PRD.md). Demo mode is local-only; connected mode is not ready for real applicants.

## Product scope and boundaries

- Build the candidate intake and status experience and the private-owner review experience as interactive demo flows using invented data. Keep connected-mode APIs guarded and explicit about incomplete capabilities.
- Clearly identify demo actions and data as local/in-memory. Do not claim that a request was sent, a resume was uploaded, a candidate was emailed, or a referral was submitted to EA.
- Do not automate EA portal submissions, scrape LinkedIn, read LinkedIn messages, or invent EA policies/options. Treat unverified EA availability as unknown and keep manual owner review available.
- Auth token validation, owner checks, repository/API code, and SQL migration groundwork exist. Connected resume and supporting-file upload, bounded extraction for supported text-based PDF/DOCX files, verified application submission, and owner review routes are implemented but need configured providers and integration verification. Candidate email-code sign-in UI/API exists; Supabase OTP delivery configuration, separate status-link delivery, and migration deployment are outstanding.
- OCR, email sending, AI analysis, and deployment are not implemented. Malware scanning fails closed to quarantine unless a configured scanner verifies the uploaded bytes. Resume replacement must remain scoped to the authenticated candidate's own job application and an explicit owner correction request; replacement invalidates the prior evidence assessment. Adding credentials alone does not make connected intake production-ready. Keep these boundaries explicit and do not add provider credentials or secrets.
- Optional showcase participation must not increase a candidate's evidence score. The score is a documented evidence coverage heuristic; it is not a hiring or referral probability and never makes a decision for the owner.
- Keep fictional fixtures and reserved `.invalid` email addresses. Do not add real candidate personal data.

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
