# Architecture

- Next.js App Router with Server Components by default. Candidate, status, and owner actions use connected server APIs.
- HTTP APIs are Route Handlers. Privileged provider access and configuration stay in server-only modules.
- Connected persistence uses Supabase service-role calls behind server-side identity and owner checks. Public table grants remain absent; RLS and FORCE RLS are enabled.
- Vercel Git integration deploys `main` as Production and other branches as Preview. The project uses Node 24, `npm ci`, and `npm run build`.
- The application fails closed when connected mode or any required provider setting is missing. It does not serve in-memory fallback records.
