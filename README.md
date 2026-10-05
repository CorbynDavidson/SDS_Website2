# SDS Housing Condition Claims

Source for the SDS-branded Housing Condition Claims website, exported from the current saved project (version 41).

## Project structure

- `src/`: page templates, CSS, structured page content and image assets.
- `worker/`: Cloudflare Worker request handler template.
- `scripts/`: Worker build and site validation utilities.
- `db/`: enquiry database schema.
- `drizzle/`: database migrations and migration metadata.
- `.openai/hosting.json`: the existing Sites project and database binding configuration.

## Build and validate

Use Node.js 22 or later and npm.

```sh
npm ci
npm run build
npm run validate
```

The build creates `dist/server/index.js`. The validation script checks the generated pages, internal links, assets, sitemap, redirects and missing-page response. It does not exercise a live enquiry database.

`npm run db:generate` generates migrations after changes to the enquiry schema.

## Hosting and enquiries

This project currently runs as a Cloudflare Worker through its original Sites host. Saving the source to GitHub does not move or redeploy that website.

The enquiry form requires a Cloudflare D1 database bound as `DB`, with the migration in `drizzle/` applied. Database records and runtime credentials are not part of this repository.

The submissions pages rely on authentication provided by the original Sites host. A different host must supply a trusted authentication integration before those pages are exposed. Keep the current host configuration when continuing to publish through Sites.

The current source does not require dotenv variables. Do not commit credentials or local environment files.

## Source provenance

Original project: SDS Housing Condition Claims.

Saved source commit: `f241782af256486d1523a2fb4c8d70a410d8e7a4`.

Original application source is preserved. Installed dependencies, generated builds and older deployment archives are excluded from the export; repository documentation and ignore rules are added.
