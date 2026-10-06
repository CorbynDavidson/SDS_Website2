# Original SDS content in the approved design

This release fits the original SDS page wording into the approved version-41 visual design. It builds all **296 captured routes**, including slash aliases and listing pagination, with original SEO titles, metadata, canonical/alternate links and JSON-LD. The 248 original sitemap URLs are included in the review sitemap.

The original headings, paragraphs, lists, FAQ answers, article dates, directory labels, form labels/options and available article/profile images are retained. Existing spelling and punctuation are preserved. Source heading text is kept while the replacement uses a single main H1 and suitable subordinate headings.

The approved fonts, CSS, logo, navigation, footer, homepage carousel controls, reviews rail and responsive design assets remain. Primary content uses the same hero, section, profile, news and gallery patterns. The original site's CMS layout/classes and CSS are not deployed as the page design. Longer original copy makes some pages taller. Shared source navigation and repeated staff modals are replaced by the approved shared design; enquiry widgets inside sidebars are preserved as forms.

The original directory lists **24 people**; **25 individual profile paths** were captured, including an additional linked profile. All captured profile pages are retained. The existing 14-person homepage carousel remains in its approved format.

## Git-backed sources and reproducibility

- Immutable captures: `migration/source-pages/`, `migration/source-manifest.json`.
- Original imported content and seven form schemas: `src/content/sds/`.
- Original SEO: `src/seo/sds/pages/`.
- Approved design: `src/index.html`, `src/brand.css`, `src/service.css`, `worker/index.template.js`, `scripts/build-worker.mjs`.
- Current adapter and build: `scripts/lib/current-design-content.mjs`, `scripts/build-content-current-design.mjs`.
- Generated page content: `src/content/current-design/pages/` and its route index.
- Independent verification: `scripts/validate-current-content.mjs`, `docs/migration/content-validation.json`.

`npm run check` rebuilds corresponding page files and reports, compares served content and SEO with the immutable captures, checks approved styles/shared design/carousels, source media hashes/MIME types and internal links, then runs the thirteen persistence/security backend tests. Commit all generated changes with the implementation. GitHub runs the same checks.

`npm run build:metadata` retains the metadata-only version-47 build for rollback/review. Its unchanged-body reports describe that intermediate build, not this content release. `npm run check:migration` retains the earlier CMS-layout candidate for source research; it is not the selected design.

## Enquiries and editing

Seven original schemas use the tested `/api/forms/<key>` handlers. D1 stores labelled responses and owner-only drafts; R2 stores private evidence. The authenticated `/submissions` view includes new submissions and earlier `enquiries`. The old `/api/leads` endpoint remains available for existing unmapped design pages.

`?edit=1` on a migrated page uses the authenticated draft editor. Saving a draft does not publish wording or write to GitHub. Change requests require review and a Git commit; original wording remains frozen for this migration. See `EDITOR_WORKFLOW.md`.

## Production status

The review site remains noindex and production mode returns 503 until the release gates are signed off. This release does not switch SDS DNS, change email records, configure a CRM, enable production tracking or claim a completed browser/mobile audit. Original missing media/links remain explicit in the reports. See `HANDOVER.md` and `config/release-gates.json` for the remaining work.

## Published release

Published successfully as **Site version 48** at https://housingconditionclaims.org on 6 October 2026. Native source: `bceb3d89275fa8dc0b7b9c9d866414716af6fc32`. GitHub implementation: [`9e397b423ba1e12fdff0295b857e461dd32beef2`](https://github.com/CorbynDavidson/SDS_Website2/commit/9e397b423ba1e12fdff0295b857e461dd32beef2). [GitHub CI](https://github.com/CorbynDavidson/SDS_Website2/actions/runs/37403334513) passed. All 315 changed GitHub files matched local Git blob hashes.

Verification covered 296 original-content/SEO routes, 22,030 source copy blocks, 75 used original media files with correct local hashes/types, 155 internal links and thirteen backend tests. All seven schemas were also submitted through the compiled Worker against isolated local SQL, and the authenticated combined dashboard read them. No live personal records or notification systems were changed by those tests.

The captured Hanane Chikhaoui profile has no visible primary content. Its route and original SEO are retained; no biography is invented. Review this legacy empty page before production.
