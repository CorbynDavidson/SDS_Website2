# Build and deployment

The current agreed review host remains Sites, with logical bindings `DB` (D1) and `ASSET_STORAGE` (R2) in `.openai/hosting.json`. Its project ID is preserved. This is a Worker application; GitHub Pages alone cannot provide its database or protected administration.

## Local workflow

Use Node 24 and the committed lockfile: `npm ci --ignore-scripts`, `npm run check`, then `npm run dev` (port 4173; `-- --port 3000` overrides it). Build first and restart the development server after changing Worker/page source. Local enquiries live in ignored `.data/preview.sqlite`; no real enquiry data belongs in Git. Development does not simulate owner identity on a shared listener.

`npm run import:sds` reconstructs compiled pages from raw captures; run it when intentionally refreshing/importing source, not after hand-editing imported HTML. `npm run build` creates `dist/server/index.js` and portable static assets in `dist/client/`. The compiled Worker embeds compressed pages and critical CSS/JS/logo; larger media are served from R2 on Sites. Asset keys are SHA-256 addresses and HTTP Range/ETag handling supports media delivery. The build enforces a compressed Worker size budget.

## Review publication

1. Pass `npm run check` and inspect migration reports.
2. Ensure runtime values `RELEASE_MODE=review`, `AUTH_PROVIDER=sites`, owner `ADMIN_EMAILS` and secret `RATE_LIMIT_SECRET` are set in Sites.
3. Push the exact checkout through the Sites source workflow, package that commit, save a version and deploy it to the site's existing audience. Drizzle migrations run before Worker upload.
4. For newly captured media, temporarily set secret `MIGRATION_UPLOAD_TOKEN` in review. Feed it over stdin to `python scripts/upload-migration-assets.py --origin https://housingconditionclaims.org`. Every upload is restricted to the release's declared path, size and SHA-256.
5. Verify all declared assets, remove `MIGRATION_UPLOAD_TOKEN`, and redeploy to apply the removal. The import endpoint is disabled without the secret and is always disabled in production mode.
6. Confirm deployment status, database tables, controlled enquiry persistence and owner administration. Record the exact version/commit in deployment evidence.

GitHub is the developer handover mirror and CI system. Its capture workflow writes the actual content and audit files back to Git. It does not imply an unattended Sites deployment integration exists. Changes made here must be mirrored to GitHub and the same source files published through Sites.

## Optional separate Cloudflare hosting

No external Cloudflare account has been configured or deployed. `scripts/configure-cloudflare.mjs` generates a concrete `wrangler.json` only from real D1/R2 identifiers and a verified Cloudflare Access application. It refuses missing/fabricated IDs. Cloudflare auth must use `AUTH_PROVIDER=cloudflare-access`; never trust Sites identity headers on that host. Secret `RATE_LIMIT_SECRET` goes in the account's secret store. Transfer D1 data privately and preserve private R2 evidence before any host move.

Run `node scripts/check-release.mjs` before setting `RELEASE_MODE=production`. Keep `www.sds-solicitors.com` as the canonical origin. Configure root/www/HTTP redirects at the host/domain layer once the actual domain connection is verified. Do not replace Namecheap email MX/TXT records with website records. DNS values must come from the actual selected host, not guessed IP addresses.
