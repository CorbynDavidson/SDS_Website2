# SDS website

Review: https://housingconditionclaims.org (**version 54**). The user requested the design from before the content migration, so **main builds the version-41 design**. Review responses remain noindex. The production site at https://www.sds-solicitors.com and its DNS have not changed.

Original SDS page content and SEO are now fitted into the approved design on **all 296 captured routes**. Headings, paragraphs, lists, FAQs, forms, profile/article images, SEO titles and metadata are preserved. Shared fonts, CSS, logo, navigation, footer and homepage carousels retain the approved design. Version 49 removes the wall/switch banners, gives page forms the homepage callback-card styling and lays out the four benefits horizontally (four columns on desktop, two on smaller screens). See [content migration](docs/CONTENT_MIGRATION.md) and its independent verification report.

Version 50 moves Sheldon Davidson’s original welcome message into a readable “Who we are” carousel slide, aligns the first box, adds 48px of header spacing and removes secondary enquiry widgets. Primary form fields and retained wording are preserved.

Version 51 gives team sections a generous rounded frame and extends the secondary grey background across the Our People content area. The original directory, filter controls, profile links and SEO remain intact.

Version 52 removes aerial estate banners, vertically centres the header, gives the claims steps a horizontal desktop layout and the disrepair image cards two columns, and keeps one centred Sheldon/Victoria pair on All Locations. Original wording and SEO remain, with the requested duplicate-card removal and original Victoria directory card addition explicitly verified.

The build maps all 248 live legacy sitemap URLs to preserved routes or tested single-hop 301s. The production sitemap contains 251 self-canonical, indexable URLs. All seven original enquiry schemas use the tested D1/R2 handlers; protected administration includes new and earlier enquiries. Operational launch checks remain pending, including browser/mobile review, CMS eligibility rules, lead routing, consent/tracking and domain cutover.

Version 53 adds verified ReviewSolicitors/Google links and examples, the homepage testimonial carousel, and the original LinkedIn recognition graphic to Reviews, with the corrected title.

Version 54 prepares all metadata, sharing URLs and public internal links for `https://www.sds-solicitors.com`, adds global LegalService schema and disrepair Service schema, and applies tested Worker redirects and host-aware crawl controls. Terms of Business keeps the exact existing wording in the current design. Claim enquiry pages keep their migration URLs and all fields, with one form owner and shared styling. The user rejected the version-54 panel changes; the version-53 layout and colours are restored while keeping SEO and form fixes. No production DNS changes are included.

The immutable originals and earlier CMS-layout candidate remain on [migration/exact-sds-content](https://github.com/CorbynDavidson/SDS_Website2/tree/migration/exact-sds-content). Its visual layout is not the selected design.

## Development

Requires Node 24.

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Normal builds use `scripts/build-content-current-design.mjs`, the immutable original sources and the approved renderer. Corresponding page content is generated in `src/content/current-design/`; reports record per-route copy/SEO/design parity. The Worker allows production indexation only on the SDS primary hosts with production release mode. All review hosts remain noindex, including when the runtime release mode is production. Existing private data remains in D1/R2.

`npm run build:metadata` builds the intermediate metadata-only version. `npm run check:migration` validates the retained CMS-layout candidate; neither command deploys it. Rebuild with `npm run build` before publishing the current content/design combination.

[Production SEO and routing](docs/PRODUCTION_SEO.md) · [Design restoration](docs/DESIGN_RESTORATION.md) · [Developer handover](docs/HANDOVER.md) · [Deployment](docs/DEPLOYMENT.md) · [Editing](docs/EDITOR_WORKFLOW.md) · [Launch gates](docs/LAUNCH_CHECKLIST.md)

GitHub validates normal pushes and migration branches. Intentional source capture imports and commits corresponding content/media/audit files using the migration checks. GitHub does not automatically deploy Sites. Secrets and submissions never belong in this public repository.
