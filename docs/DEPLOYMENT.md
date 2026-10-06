# Build and deployment

The approved current design is the earlier version-41 design, restored after the user rejected the migrated layout. `main` builds this design. The exact-content candidate is retained on GitHub branch `migration/exact-sds-content` and is not approved for publication in its current layout.

## Current design

Use Node 24, `npm ci --ignore-scripts`, `npm run check`, then `npm run dev`. The development server uses port 4173; `-- --port 3000` overrides it. Enquiries use ignored local SQLite for development. Owner identity is not simulated on a shared listener.

`npm run build` creates `dist/server/index.js` with the approved embedded assets and original content/SEO on all 296 captured routes. Original media fallback files are packaged in `dist/client`; hashed Worker URLs enforce MIME types. Keep the visual baseline in `src/` and `worker/index.template.js` unchanged. The adapter regenerates `src/content/current-design/` and independent audit reports.

The current Worker delegates seven source-form schemas, protected submissions and authenticated drafts to the tested persistence runtime. `/health` reports database readiness, migrated page count and release fingerprint. Review responses remain noindex. Production mode is blocked until the launch gates have real evidence and the domain cutover is authorised.

Review hosting remains the existing Sites project in `.openai/hosting.json`. Preserve bindings `DB` and `ASSET_STORAGE`; applied additive migrations and stored enquiries/evidence must remain intact. Runtime values are `RELEASE_MODE=review`, `AUTH_PROVIDER=sites`, the configured owner and secret `RATE_LIMIT_SECRET`. The temporary migration upload credential was removed.

Run checks, push the exact source through the Sites source workflow, package that commit, save a version and deploy to the existing audience. Record successful version/deployment provenance. GitHub is the developer source mirror and CI; it does not imply unattended Sites publication.

## Retained migration candidate

Use `npm run check:migration` to build `dist/server/index.js` plus all captured public assets under `dist/client`, compare immutable originals and run the thirteen backend tests. This overwrites `dist`; rebuild the current design before publishing `main`.

The capture workflow calls the migration checks explicitly and commits raw content/media/reports. It does not change the active design or production DNS. Keep the approved previous layouts when integrating the original content. The candidate's public-media MIME-type failures, CMS rules, follow-up routing, tracking/consent, account inventories, private backup/restore and device review remain production gates.

No separate Cloudflare account has been deployed. The optional configuration generator requires real D1/R2 IDs and a verified Access application. Keep the production canonical origin `https://www.sds-solicitors.com`. Website DNS records must come from the selected host; preserve Namecheap MX/SPF/DKIM/DMARC records.
