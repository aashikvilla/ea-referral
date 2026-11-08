# Session: Vercel and deployment setup

- Confirmed GitHub repo `aashikvilla/ea-referral`, default/production branch `main`.
- Created Vercel project `ea-referral` in team `aashikvillas-projects`, linked to GitHub. Project ID: `prj_Ga3rLmm40Uz4nZobLkRVeY8505We`.
- Set framework to Next.js, root directory to repository root, install command `npm ci`, build command `npm run build`, Node `24.x`, and automatic system environment variables.
- Confirmed production domain `https://ea-referral.vercel.app`. Set `EA_REFERRAL_MODE=demo` for Production/Preview/Development; set `APP_ORIGIN` to the production domain for Production and localhost for Development. No provider secrets were needed or added.
- Updated origin validation so previews accept only their exact Vercel-generated host; added coverage rejecting unsafe protocols.
- Local verification on Node 25: lint, typecheck, 59 tests, CRLF-aware Prettier check, and production build passed. Node 25 was used because Node 24 is not installed on the workstation; Vercel and GitHub are configured for Node 24.
- Commit `f3cfcb2` was pushed to `main`; its Vercel build showed that the original `>=24.0.0` engine range overrode the Node 24 project setting and selected Node 26. Pin `package.json` and the lockfile root engine to `24.x`; the follow-up deployment must verify Node 24 is actually used.
- Prior Vercel production deployment of commit `ba6ed0a69d3302e80edd601074c3b895c64d1761` reached READY before the environment variables were added. Record the follow-up production deployment result after the engine pin is pushed.
