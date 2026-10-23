# EA Referral

A Next.js starter for a shareable LinkedIn referral assistant. This repository currently contains the framework scaffold and developer tooling; referral flows, accounts, storage, and LinkedIn integrations are intentionally unimplemented.

## Stack

- Next.js 16 App Router and React 19
- TypeScript with strict checking
- Tailwind CSS 4
- Turbopack for development
- React Compiler
- Cache Components with Partial Prefetching
- ESLint and Prettier

React Compiler is enabled. Cache Components use explicit caching; user-specific data must never be placed in a shared cache.

## Requirements

- Node.js 20.9 or newer (`.nvmrc` selects Node 24)
- npm

## Getting started

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```sh
npm run dev          # Start the development server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run format       # Format supported files
npm run format:check # Check formatting
npm run check        # Lint, typecheck, and check formatting
npm run build        # Build for production
npm run start        # Serve the production build
```

## Codex setup

- [`AGENTS.md`](AGENTS.md) contains repository instructions and the official Next.js generated guidance.
- [`.agents/skills/`](.agents/skills/) contains project skills for App Router work and referral data privacy.
- [`.codex/agents/`](.codex/agents/) contains the Astra coordinator, focused Supabase/Vercel/Resend specialists, UI specialist, and read-only quality/security reviewers for local Codex clients.

Project-level Codex configuration is loaded by local Codex clients when the repository is trusted. No provider credentials are checked in; configured environment values remain local or in the provider's secret manager.

## Integration setup

- Copy `.env.example` to `.env.local` for local development, then fill only values for services that have been selected and configured. Never commit `.env.local` or expose server-only keys to browser code.
- Supabase integration uses a publishable key for browser-safe operations and a secret key only in server-only code. EA Referral tables and resume storage must use an `ea_referral_` prefix within the selected shared project.
- Resend requires a sender domain verified in DNS before production candidate email can be sent. Use a sending-only key restricted to that domain.
- Vercel AI Gateway supports project requests; use Vercel OIDC on Vercel and a local gateway key only for local development. Choose the model from the current gateway catalog before implementing analysis.
- Vercel Git integration should deploy pull requests as previews and `main` as production. GitHub Actions run quality checks and do not deploy a second time.

## Project scope

This is only the starter. Confirm product requirements before adding referral forms, personal data storage, authentication, email delivery, analytics, external services, or automated LinkedIn actions.
