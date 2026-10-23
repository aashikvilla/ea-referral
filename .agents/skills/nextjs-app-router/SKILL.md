---
name: nextjs-app-router
description: Use when creating or changing routes, layouts, Server or Client Components, forms, Server Actions, Route Handlers, caching, or Next.js configuration in this repository.
---

# Next.js App Router workflow

1. Read the root `AGENTS.md` and inspect the installed Next.js version.
2. For version-sensitive behavior, read the relevant guide in `node_modules/next/dist/docs/`. Use the official Next.js documentation if the installed docs do not cover the feature.
3. Keep components server-rendered by default. Add `"use client"` only at the smallest boundary that needs browser APIs, local interaction state, or event handlers.
4. Use the App Router conventions and generated types. Treat request-derived values as untrusted and validate them on the server.
5. Cache deliberately. Cache Components are enabled, so dynamic data is not implicitly shared. Use `use cache`, `cacheLife`, and `cacheTag` only when the data's freshness and sharing scope are understood. Never put per-user data in a shared cache.
6. Keep secrets and privileged integrations in server-only modules. Use Route Handlers for HTTP-facing endpoints and Server Actions for mutations initiated by the app UI when appropriate.
7. Include accessible names, keyboard support, semantic markup, and useful loading/error states when adding UI.
8. Run `npm run check`; run `npm run build` for changes that affect app code or configuration.
