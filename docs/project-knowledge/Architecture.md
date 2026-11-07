# Architecture

- Next.js App Router with Server Components by default. Interactive demo state lives in the client workspace provider and uses fictional per-tab data.
- HTTP APIs are Route Handlers. Privileged provider access and configuration stay in server-only modules.
- Connected persistence uses Supabase service-role calls behind server-side identity/owner checks. Public table grants remain absent; RLS and FORCE RLS are enabled.
- Vercel Git integration deploys `main` as Production and other branches as Preview. The project uses Node 24, `npm ci`, and `npm run build`.
- The deployed app remains in demo mode until the relevant providers and connected workflows have been deliberately configured and verified.
