# Build and deployment

The approved current design is the earlier version-41 design, restored after the user rejected the migrated layout. `main` builds this design. The exact-content candidate is retained on GitHub branch `migration/exact-sds-content` and is not approved for publication in its current layout.

## Current design

Use Node 24, `npm ci --ignore-scripts`, `npm run check`, then `npm run dev`. The development server uses port 4173; `-- --port 3000` overrides it. Enquiries use ignored local SQLite for development. Owner identity is not simulated on a shared listener.

`npm run build` creates `dist/server/index.js` with the earlier embedded public assets. Keep `src/index.html`, `src/brand.css`, `src/service.css` and the existing templates as the visual baseline. The wrapper adds noindex response headers and `/health`, without changing page bodies. The health response identifies design baseline 41, its fingerprint, database readiness and `exactSdsMigrationActive: false`. It blocks production mode because this restored build does not implement the complete exact-copy SDS migration.

The metadata overlay now adds original SEO to all 296 captured routes and supplies the 13 missing routes with original article wording in the current-design shell. Existing page bodies and display fragments remain byte-identical. `/health` also identifies the metadata source commit and route counts. The sitemap includes the original 248 URLs. Details and generated verification are in [METADATA_MIGRATION.md](METADATA_MIGRATION.md).

Review hosting remains the existing Sites project in `.openai/hosting.json`. Preserve bindings `DB` and `ASSET_STORAGE`; applied additive migrations and stored enquiries/evidence must remain intact. Runtime values are `RELEASE_MODE=review`, `AUTH_PROVIDER=sites`, the configured owner and secret `RATE_LIMIT_SECRET`. The temporary migration upload credential was removed.

Run checks, push the exact source through the Sites source workflow, package that commit, save a version and deploy to the existing audience. Record successful version/deployment provenance. GitHub is the developer source mirror and CI; it does not imply unattended Sites publication.

## Retained migration candidate

Use `npm run check:migration` to build `dist/server/index.js` plus all captured public assets under `dist/client`, compare immutable originals and run the thirteen backend tests. This overwrites `dist`; rebuild the current design before publishing `main`.

The capture workflow calls the migration checks explicitly and commits raw content/media/reports. It does not change the active design or production DNS. Keep the approved previous layouts when integrating the original content. The candidate's public-media MIME-type failures, CMS rules, follow-up routing, tracking/consent, account inventories, private backup/restore and device review remain production gates.

No separate Cloudflare account has been deployed. The optional configuration generator requires real D1/R2 IDs and a verified Access application. Keep the production canonical origin `https://www.sds-solicitors.com`. Website DNS records must come from the selected host; preserve Namecheap MX/SPF/DKIM/DMARC records.
