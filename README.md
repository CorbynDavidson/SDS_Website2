# SDS website

Review: https://housingconditionclaims.org. The user requested the design from before the content migration, so **main builds the version-41 design**. Review responses remain noindex. The production site at https://www.sds-solicitors.com and its DNS have not changed.

The original SDS metadata is now applied to **all 296 captured routes**. The 283 existing page bodies, styles and executable scripts remain unchanged. Thirteen missing routes (nine paths plus four pagination variants) are added using the current design and original article wording. The review sitemap includes all 248 original sitemap URLs. See [metadata migration](docs/METADATA_MIGRATION.md) for scope and verification.

The full original-source migration is preserved on [migration/exact-sds-content](https://github.com/CorbynDavidson/SDS_Website2/tree/migration/exact-sds-content). It contains 296 captured routes, exact wording/metadata baselines, media, seven form schemas and backend tests. Its rejected visual layout is not the live website. The original content still needs fitting into the restored design before production release.

## Development

Requires Node 24.

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Normal builds use `scripts/build-current-design.mjs`, the previous `scripts/build-worker.mjs`, `worker/index.template.js` and `src/` design files. A head overlay adds original SEO without modifying existing page bodies or display settings. Added article files are generated in `src/content/design-additions/`. A wrapper retains review noindex, a health endpoint and the production-release block. Existing enquiries and migration data are preserved privately in D1/R2.

`npm run check:migration` builds and validates the retained migration candidate locally; it does not deploy it. Rebuild with `npm run build` before publishing the approved current design.

[Design restoration](docs/DESIGN_RESTORATION.md) · [Developer handover](docs/HANDOVER.md) · [Deployment](docs/DEPLOYMENT.md) · [Editing](docs/EDITOR_WORKFLOW.md) · [Launch gates](docs/LAUNCH_CHECKLIST.md)

GitHub validates normal pushes and migration branches. Intentional source capture imports and commits corresponding content/media/audit files using the migration checks. GitHub does not automatically deploy Sites. Secrets and submissions never belong in this public repository.
