# Decisions

## Keep candidate routes server-rendered

`CandidateShell` is the client boundary because it reads workspace context. Server-rendered page content can pass through its `children` slot.

## Keep deployments in demo mode

Vercel uses `EA_REFERRAL_MODE=demo`. No Supabase secret, scanner credential, AI Gateway key, or Resend key is needed for the fictional demo, and connected intake remains unavailable until provider setup and integration checks are complete.

## Validate exact Vercel-generated origins

Same-origin checks accept the configured `APP_ORIGIN` plus the exact host in Vercel's trusted `VERCEL_URL` system variable. This enables preview origins without widening the allowlist to arbitrary `vercel.app` subdomains.
