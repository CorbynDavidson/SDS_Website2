# SDS website

Review: https://housingconditionclaims.org. The user requested the design from before the content migration, so **main builds the version-41 design**. Review responses remain noindex. The production site at https://www.sds-solicitors.com and its DNS have not changed.

The full original-source migration is preserved on [migration/exact-sds-content](https://github.com/CorbynDavidson/SDS_Website2/tree/migration/exact-sds-content). It contains 296 captured routes, exact wording/metadata baselines, media, seven form schemas and backend tests. Its rejected visual layout is not the live website. The original content still needs fitting into the restored design before production release.

## Development

Requires Node 24.

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Normal builds use `scripts/build-current-design.mjs`, the previous `scripts/build-worker.mjs`, `worker/index.template.js` and `src/` design files. Page bodies are retained; a wrapper adds review noindex, a health endpoint and a production-release block. Existing enquiries and migration data are preserved privately in D1/R2.

`npm run check:migration` builds and validates the retained migration candidate locally; it does not deploy it. Rebuild with `npm run build` before publishing the approved current design.

[Design restoration](docs/DESIGN_RESTORATION.md) · [Developer handover](docs/HANDOVER.md) · [Deployment](docs/DEPLOYMENT.md) · [Editing](docs/EDITOR_WORKFLOW.md) · [Launch gates](docs/LAUNCH_CHECKLIST.md)

GitHub validates normal pushes and migration branches. Intentional source capture imports and commits corresponding content/media/audit files using the migration checks. GitHub does not automatically deploy Sites. Secrets and submissions never belong in this public repository.
