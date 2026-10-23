# Project instructions

This repository is the starter for a shareable LinkedIn referral assistant. Keep the implementation generic until the user supplies product requirements.

## Scope

- Do not add referral workflows, authentication, databases, email, analytics, deployment configuration, or LinkedIn integrations without a request.
- Do not automate LinkedIn activity or scrape LinkedIn. Use documented, authorized integrations only when explicitly requested.
- Do not invent which personal details a referral requester must provide or how long those details should be retained.

## Engineering conventions

- Use the Next.js App Router and TypeScript. Prefer Server Components; add a Client Component only for browser-only state or interaction.
- Keep server-only logic and secrets out of Client Components. Validate untrusted inputs on the server.
- Cache only data that is safe to share. This project enables Cache Components and Partial Prefetching; use `use cache` deliberately and never cache private, user-specific referral data across users.
- React Compiler is enabled. Avoid manual memoization unless it is needed and supported by current React guidance.
- Prefer existing platform features over new dependencies. Keep `package-lock.json` as the only lockfile.
- Consult the installed Next.js documentation under `node_modules/next/dist/docs/` before using version-sensitive APIs. Use official documentation when local docs are unavailable.
- Keep the generated Next.js guidance below intact; `next dev` refreshes that block.

## Verification

- Run `npm run check` for lint, type, and formatting checks.
- Run `npm run build` when a change affects application code or Next.js configuration.
- Add or update focused tests when implementing behavior.
- Keep the README and skills accurate when changing project conventions.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
