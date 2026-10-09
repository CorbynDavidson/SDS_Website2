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

**Updated owner choice (9 October 2026): Cloudflare D1/R2 with automatic placement and no jurisdiction restriction was explicitly selected for this Worker after the UK-only limitation was explained.** Cloudflare chooses the storage location; it is not a UK storage guarantee. The separate account setup remains pending. `scripts/configure-cloudflare.mjs` requires an explicit non-UK-data-residency acknowledgement and real resource IDs before writing bindings. See `docs/CLOUDFLARE_INTAKE_SETUP.md` for the account work and verification gates. Do not describe this path as UK-only.

The temporary Worker can serve the public website in review mode. Its current form backend expects a D1 binding named `DB`, a `RATE_LIMIT_SECRET` and, for uploads, an R2 binding named `ASSET_STORAGE`. Without these it must not be treated as an operational enquiry channel. Cloudflare Access alone does not resolve the location of enquiry storage, request processing, uploads, logs or backups. Existing Sites resources and data do not automatically transfer.

Next, provision the separate Cloudflare account resources and Access application, apply migrations, set the Worker secret, deploy the configured build, and verify labelled submissions, private uploads, denied anonymous staff access, backups and retention. Keep the current Sites domain live and the temporary Worker in review mode until those checks pass. Do not move a production domain or send real enquiries to the temporary Worker on the basis of the site deployment alone.

## Verification of this fix

- Full approved build and existing content, URL mapping, SEO and review-readiness validators passed.
- All 22 focused backend/indexing tests passed.
- Packaging parity test compared all 325 page responses, all 29 design images, crawl controls, a fallback route, unknown paths and an internal storage URL against the approved Worker.
- Wrangler dry run passed: 1,134 KiB compressed Worker upload, below the 3 MiB code limit.
- The local Wrangler development server could not start in the execution container because network-interface enumeration returned `uv_interface_addresses` error 1. A remote Cloudflare deployment has not been verified here.
