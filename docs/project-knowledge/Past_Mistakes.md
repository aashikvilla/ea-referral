# Past Mistakes

## Client context hook called from a Server Component

The candidate shell consumed `useWorkspace()` without declaring a client boundary. This surfaced only while Next.js prerendered `/`, after lint and type checks passed. Mark the smallest component that reads client context with `"use client"`; keep route pages server-rendered.

## Static origin configured for dynamic Preview URLs

One fixed `APP_ORIGIN` cannot match every generated Vercel Preview hostname. On Vercel, validate the request origin against the exact platform-provided `VERCEL_URL` as well as the configured production origin; reject other hosts and unsafe protocols.

## Vercel Node setting overridden by a broad package engine range

Vercel selects the newest supported major when `package.json` permits any future version, even when Project Settings specify Node 24. Pin `engines.node` to `24.x` when `.nvmrc`, CI, and deployment settings all target Node 24.
