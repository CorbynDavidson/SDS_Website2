# Cloudflare review deployment

This configuration deploys `sds-website2` to its temporary `workers.dev` address. It does not attach a custom domain or change production DNS. `RELEASE_MODE=review` keeps the deployed pages non-indexable.

## Workers Builds settings

- Repository: `CorbynDavidson/SDS_Website2`, branch `main`, root directory `/`.
- Build command: `npm run build`.
- Deploy command: `npm run deploy` The existing `npx wrangler deploy` also works, because `npm run build` generates the package automatically.
- Clear the previous build cache before retrying the failed build if the old esbuild binary persists.

## Configuration correction

The approved application builds to `dist/server/index.js`. `scripts/package-cloudflare.mjs` produces `dist/server/cloudflare.js`, moving byte-identical pages and design images into `dist/client`. The small Worker loads them through its private asset binding; internal storage URLs are not exposed by the public routing. This removes embedded binary payloads from the Worker and checks its compressed size against the 3 MiB free-plan code limit. Publishing `src` as a static site would omit application routing and API handlers. The `ASSETS` binding and `run_worker_first: true` preserve the generated Worker's media, routing and crawl policy. The package already emits a self-contained module, so `no_bundle: true` avoids an unnecessary second esbuild pass. The root esbuild dependency is pinned to Wrangler's version, 0.28.1, and the npm lockfile is updated. Older nested esbuild versions required by Drizzle remain isolated.

## Local verification

```sh
npm ci
npm run build
npm run deploy:check
npm run preview:cloudflare
```

A dry run verifies deployment packaging; it does not upload to Cloudflare or prove a remote deployment succeeded.

## Enquiries and administration

**UK-only data residency requirement (9 October 2026): Do not create or bind a D1 database or R2 bucket for enquiries or evidence.** Their documented jurisdictional restrictions offer the EU, US and FedRAMP, but no UK jurisdiction. An automatic location or Western Europe hint is not a UK storage guarantee. The earlier EU database recommendation was withdrawn before creation. `scripts/configure-cloudflare.mjs` now refuses to configure this path unless the residency requirement is explicitly changed.

The temporary Worker can serve the public website in review mode. Its current form backend expects a D1 binding named `DB`, a `RATE_LIMIT_SECRET` and, for uploads, an R2 binding named `ASSET_STORAGE`. Without these it must not be treated as an operational enquiry channel. Cloudflare Access alone does not resolve the location of enquiry storage, request processing, uploads, logs or backups. Existing Sites resources and data do not automatically transfer.

Next, choose and verify a UK-resident architecture for the entire enquiry flow: the form endpoint and processing, database, private file storage, staff access, logs and backups. Then adapt the Worker form integration and staff interface to that architecture, test a labelled submission and upload, verify anonymous denial and staff download/CSV, and review the provider's data processing terms. Keep the current Sites domain live and the temporary Worker in review mode until the replacement passes those checks. Do not move a production domain or send real enquiries to the temporary Worker on the basis of the site deployment alone.

## Verification of this fix

- Full approved build and existing content, URL mapping, SEO and review-readiness validators passed.
- All 22 focused backend/indexing tests passed.
- Packaging parity test compared all 325 page responses, all 29 design images, crawl controls, a fallback route, unknown paths and an internal storage URL against the approved Worker.
- Wrangler dry run passed: 1,134 KiB compressed Worker upload, below the 3 MiB code limit.
- The local Wrangler development server could not start in the execution container because network-interface enumeration returned `uv_interface_addresses` error 1. A remote Cloudflare deployment has not been verified here.
