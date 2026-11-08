# Session: Vercel and deployment setup

- Confirmed GitHub repo `aashikvilla/ea-referral`, default/production branch `main`.
- Created Vercel project `ea-referral` in team `aashikvillas-projects`, linked to GitHub. Project ID: `prj_Ga3rLmm40Uz4nZobLkRVeY8505We`.
- Set framework to Next.js, root directory to repository root, install command `npm ci`, build command `npm run build`, Node `24.x`, and automatic system environment variables.
- Confirmed production domain `https://ea-referral.vercel.app`. Set `EA_REFERRAL_MODE=demo` for Production/Preview/Development; set `APP_ORIGIN` to the production domain for Production and localhost for Development. No provider secrets were needed or added.
- Updated origin validation so previews accept only their exact Vercel-generated host; added coverage rejecting unsafe protocols.
- Local verification on Node 25: lint, typecheck, 59 tests, CRLF-aware Prettier check, and production build passed. Node 25 was used because Node 24 is not installed on the workstation; Vercel and GitHub are configured for Node 24.
- Commit `f3cfcb2` was pushed to `main`; its Vercel build showed that the original `>=24.0.0` engine range overrode the Node 24 project setting and selected Node 26. Pinned `package.json` and the lockfile root engine to `24.x` in commit `c5ada19`, pushed after integrating three commits that had advanced remotely.
- Production deployment `dpl_39Xns5Pa26Qizs1Lu9LGqttBZLSC` for `c5ada1962bb9f6e2d00551385fe10a979f23a078` reached READY. Vercel recorded the runtime change from `26.x` to `24.x`, `npm ci` and `npm run build` completed, and GitHub's Vercel status is success. A direct request to the deployment returned HTTP 200.
- Project env configuration is `EA_REFERRAL_MODE=demo` for all targets, production `APP_ORIGIN=https://ea-referral.vercel.app`, development `APP_ORIGIN=http://localhost:3000`; no provider secrets were added. The current root layout in the latest GitHub commits intentionally renders an unavailable connected state until its services are configured, so deployment health does not mean connected intake is ready.
