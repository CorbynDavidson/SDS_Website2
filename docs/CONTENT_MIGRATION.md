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

## Layout corrections after version 48

The user requested removal of the wall/electrical-switch banner from every page, homepage-consistent styling for page forms, and horizontal placement of the four benefit icons/headings. The adapter removes both banner colour variants at every captured thumbnail size. The immutable source images/captures remain available for audit.

Standard page forms use the homepage callback-card classes, visible labels, the same two-column field pattern and responsive single-column layout. Original field names, options, required states, submission actions and wording are preserved. Multi-step form cards keep their original step-display rules and show submission status outside the hidden step-one form. The four benefit items use four columns on desktop and two on narrower screens. Their original labels and icon files are unchanged.

Shared layout CSS is maintained in `src/current-content-layout.css`; generated page files and `docs/migration/layout-validation.json` are refreshed by `npm run check`. Browser/mobile visual sign-off remains a separate launch gate.

Published these corrections successfully as **Site version 49** at https://housingconditionclaims.org on 6 October 2026. Native source: `a8f2f9321de5283d53d8da797021d1bcbe951ede`. GitHub implementation: [`371bf8793bdeac06be3fe721dd9324a705637af1`](https://github.com/CorbynDavidson/SDS_Website2/commit/371bf8793bdeac06be3fe721dd9324a705637af1). [GitHub CI](https://github.com/CorbynDavidson/SDS_Website2/actions/runs/37405122708) passed, and all 187 changed GitHub files matched local Git blob hashes.

Validation confirms banner removal on all 296 routes, homepage card styling for 341 standard form instances, 168 four-benefit row instances and 25 wizard cards (counts include route aliases). Original wording and SEO match on all 296 routes. All thirteen backend tests passed, and all seven original schemas returned successful submissions through the compiled Worker against isolated local SQL. A browser visual recheck could not be completed because the required control-browser skill is unavailable in this execution environment.

## Welcome carousel and enquiry simplification after version 49

The original Sheldon Davidson welcome message, signature and anniversary image are moved into one additional slide in the homepage’s existing “Who we are” carousel. The complete wording remains readable in a keyboard-accessible scrolling card; the existing team slides and previous/next, swipe and paused-on-hover/focus controls remain available. The separate welcome block is removed.

The first homepage box uses the main page width and aligns with the logo and other sections. On smaller laptops its left edge stays aligned while space is reserved for the fixed review tab; mobile widths retain the existing gutters. Marketing pages have 48px (half a CSS inch) of white space between the navigation and the first content area. Additional design-only pages receive the same spacing rules.

Only the first original enquiry widget is displayed on each migrated page that contains a form. It appears in the top content box. Secondary enquiry widgets, including the shared lower-page “Get Advice from a Housing Disrepair Professional” form, are removed as explicitly requested. A questionnaire that is the primary enquiry widget retains all of its steps and associated controls. Original backend handlers remain available, including any schema no longer displayed as a secondary widget.

This requested form removal is an explicit exception to the earlier full-copy parity: verification compares all retained wording with the immutable captures after excluding only the secondary enquiry widgets. It separately checks the primary fields against the pinned import, the unchanged original SEO, and the existing team/testimonial carousel content. Generated page files and the layout report are committed with the implementation. Browser visual sign-off remains outstanding.

Published successfully as **Site version 50** at https://housingconditionclaims.org on 6 October 2026. Native source: `c651e0e3dec5fe903f3b027beae4a4b5143c6f7b`. GitHub implementation: [`e389c9e77965ce6b0724af479db73758f95f9c16`](https://github.com/CorbynDavidson/SDS_Website2/commit/e389c9e77965ce6b0724af479db73758f95f9c16). [GitHub CI](https://github.com/CorbynDavidson/SDS_Website2/actions/runs/37406574783) passed. All 306 changed GitHub files matched local Git blob hashes.

Checks cover 296 content/SEO routes, 20,228 retained copy blocks, 176 primary enquiry widgets with unchanged fields, removal of 172 secondary widgets, the complete welcome message in the homepage carousel, two additional design-only routes and thirteen backend tests. Route counts include aliases. Six enquiry schemas remain displayed; all seven original backend handlers remain available. Browser visual sign-off is still outstanding.

## Rounded team frame and Our People background after version 50

The team sections use a 32px rounded outer frame, a subtle border and 24–48px of internal space so headings and profile cards do not sit against the edges. Narrow screens use a 24px corner radius and 20px horizontal padding. The Our People content area and its hero use the same secondary grey (#eff7f8) across the full page width, removing white strips beside the directory. Card surfaces, filtering, profile links, wording and metadata are unchanged.
