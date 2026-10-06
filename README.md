# SDS website migration

Replacement for https://www.sds-solicitors.com. Review: https://housingconditionclaims.org (noindex).

The active build preserves the original SDS wording, published URLs and metadata across the authoritative 248-page sitemap plus linked routes and pagination. [Developer handover](docs/HANDOVER.md) explains implementation, evidence and remaining production gates.

## Development

Requires Node 24.

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

The Worker build uses `worker/runtime.mjs`, imported original pages in `src/content/sds/`, source SEO in `src/seo/sds/`, shared presentation in `public/sds-theme.css` and D1/R2 runtime bindings. Captured raw originals and media are kept in Git; private submissions and secrets are not.

[Coverage report](docs/migration/coverage.json) · [Original/review URL map](docs/migration/url-map.csv) · [Deployment](docs/DEPLOYMENT.md) · [Enquiries](docs/ENQUIRIES.md) · [Editing](docs/EDITOR_WORKFLOW.md) · [Launch gates](docs/LAUNCH_CHECKLIST.md) · [Rollback](docs/ROLLBACK.md)

GitHub workflows capture/import public source and commit corresponding content/media/report files, then validate exact preservation and backend behaviour. The review deployment uses Sites. GitHub Pages alone cannot run the protected database/form handlers. Production DNS has not changed; the existing SDS domain remains the production canonical origin.

## Migration proposal

The original accepted scope is recorded in [SDS_MIGRATION_PLAN.md](docs/SDS_MIGRATION_PLAN.md); use the handover and generated reports for current implementation status.
