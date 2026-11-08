# Decisions

## Require connected services for application workflows

The deployed product uses `EA_REFERRAL_MODE=connected`. If configuration is missing or the mode differs, server operations remain unavailable. Do not add local fixture fallbacks to user-facing routes.

## Keep decisions with the owner

Evidence scoring and AI assessment are advisory only. The owner makes referral decisions and submits manually through EA’s portal.

## Validate exact Vercel-generated origins

Same-origin checks accept the configured `APP_ORIGIN` plus the exact host in Vercel's trusted `VERCEL_URL` system variable. Preview requests do not widen the allowlist to arbitrary `vercel.app` subdomains.
