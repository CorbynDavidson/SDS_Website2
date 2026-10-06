# Build and deployment

The current agreed review host remains Sites, with logical bindings `DB` (D1) and `ASSET_STORAGE` (R2) in `.openai/hosting.json`. Its project ID is preserved. This is a Worker application; GitHub Pages alone cannot provide its database or protected administration.

## Local workflow

Use Node 24 and the committed lockfile: `npm ci --ignore-scripts`, `npm run check`, then `npm run dev` (port 4173; `-- --port 3000` overrides it). Build first and restart the development server after changing Worker/page source. Local enquiries live in ignored `.data/preview.sqlite`; no real enquiry data belongs in Git. Development does not simulate owner identity on a shared listener.

`npm run import:sds` reconstructs compiled pages from raw captures; run it when intentionally refreshing/importing source, not after hand-editing imported HTML. `npm run build` (also aliased as `build:sites`) creates `dist/server/index.js` and **all** public assets in `dist/client/`. Publish both directories together. The Worker embeds compressed pages and critical CSS/JS/logo; original images, fonts and other media use the host's static `ASSETS` binding. An empty static binding cannot hide embedded assets, and checksum-addressed R2 objects are an optional fallback. Private enquiry evidence always uses R2. The build enforces a compressed Worker size budget.

## Review publication

1. Pass `npm run check` and inspect migration reports.
2. Ensure runtime values `RELEASE_MODE=review`, `AUTH_PROVIDER=sites`, owner `ADMIN_EMAILS` and secret `RATE_LIMIT_SECRET` are set in Sites.
3. Run `npm run build`; retain `dist/client` in the archive. Push the exact checkout through the Sites source workflow, package that commit, save a version and deploy it to the site's existing audience. Drizzle migrations run before Worker upload.
4. Run `python scripts/verify-hosted-assets.py --origin https://housingconditionclaims.org --output docs/migration/assets-verification.json` for a byte/hash check of every declared public asset. Original unavailable resources are separately recorded as source 404s.
5. No public-media import secret is needed for the bundled deployment. If deliberately using the optional R2 fallback, temporarily set `MIGRATION_UPLOAD_TOKEN` in review and feed it over stdin to `python scripts/upload-migration-assets.py --origin https://housingconditionclaims.org`. The endpoint accepts only declared bytes, sizes and SHA-256 hashes. Remove the secret and redeploy after import; the endpoint is disabled without it and in production mode. The reviewed deployment removes this temporary credential.
6. Confirm deployment status, database tables, controlled enquiry persistence and owner administration. `/health` reports database readiness, review/production mode and the exact `releaseFingerprint` from `docs/migration/build.json`. Record the version/commit and fingerprint in deployment evidence. The coverage report separates content parity from pending production sign-offs; `releaseReady` stays false while any gate is pending.

GitHub is the developer handover mirror and CI system. Its capture workflow writes the actual content and audit files back to Git. It does not imply an unattended Sites deployment integration exists. Changes made here must be mirrored to GitHub and the same source files published through Sites.

## Optional separate Cloudflare hosting

No external Cloudflare account has been configured or deployed. `scripts/configure-cloudflare.mjs` generates a concrete `wrangler.json` only from real D1/R2 identifiers and a verified Cloudflare Access application. It refuses missing/fabricated IDs. Cloudflare auth must use `AUTH_PROVIDER=cloudflare-access`; never trust Sites identity headers on that host. Secret `RATE_LIMIT_SECRET` goes in the account's secret store. Transfer D1 data privately and preserve private R2 evidence before any host move.

Run `node scripts/check-release.mjs` before setting `RELEASE_MODE=production`. Keep `www.sds-solicitors.com` as the canonical origin. Configure root/www/HTTP redirects at the host/domain layer once the actual domain connection is verified. Do not replace Namecheap email MX/TXT records with website records. DNS values must come from the actual selected host, not guessed IP addresses.
