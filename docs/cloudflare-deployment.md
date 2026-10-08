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

The temporary deployment can display the website and its public assets. Form persistence and server-side contact checks require a Cloudflare D1 binding named `DB`, the existing SQL schema/migrations, and a `RATE_LIMIT_SECRET`. Private uploads require the separate R2 binding `ASSET_STORAGE`. Administration requires the configured Cloudflare Access application and its verified audience/team settings. Existing Sites bindings and data do not automatically transfer to Cloudflare; missing services remain unavailable rather than reporting a successful submission.

`scripts/configure-cloudflare.mjs` remains the account-specific setup helper. It generates a separate `wrangler.json`; use an explicit `--config wrangler.json` for that configuration and review its Worker name before deploying. Do not switch production domains until the full backend migration is verified.

## Verification of this fix

- Full approved build and existing content, URL mapping, SEO and review-readiness validators passed.
- All 22 focused backend/indexing tests passed.
- Packaging parity test compared all 325 page responses, all 29 design images, crawl controls, a fallback route, unknown paths and an internal storage URL against the approved Worker.
- Wrangler dry run passed: 1,134 KiB compressed Worker upload, below the 3 MiB code limit.
- The local Wrangler development server could not start in the execution container because network-interface enumeration returned `uv_interface_addresses` error 1. A remote Cloudflare deployment has not been verified here.
