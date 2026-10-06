# SDS website replacement: migration and production-readiness plan

Status: proposed implementation scope. This document records the preparation plan; the website content migration and production cutover have not yet been performed.

## Goal and source of truth

Replace the current SDS website with the new site's design while preserving all existing published SDS wording, page URLs, and metadata. The migration includes the homepage, navigation, footer, forms, legal pages, news, case studies, staff profiles, location pages, housing-provider pages, media and downloads.

The current published SDS site is the content authority. The new site's rewritten copy and generic legacy pages are not an acceptable migration source. Preserve original spelling, punctuation, claims, names, numbers, dates, heading hierarchy, form labels and consent wording. Any proposed editorial correction is a separate change and must not enter this migration implicitly.

Recommended production address: https://www.sds-solicitors.com/, preserving existing URL paths and canonical URLs. Use housingconditionclaims.org for review during preparation. The final domain and hosting choice must be settled before deployment configuration and cutover. With the current recommendation, this is a design/hosting replacement on the existing domain rather than an automatic move of SDS to the review domain.

## Baseline verified on 5 October 2026

- GitHub source repository: CorbynDavidson/SDS_Website2; application source imported from saved Site version 41.
- The build emits a Worker and has an existing page/link/sitemap validation script.
- The repository lists 248 candidate legacy paths. It is not yet an authoritative, complete inventory of the current SDS site.
- Inspection of those local routes found 172 noindex generic replacements, including 119 location and 16 housing-provider routes. Some other noindex routes are confirmation or administrative pages; the original site's rules determine the correct production treatment.
- The generated sitemap currently has 85 entries. This count does not demonstrate complete content or metadata preservation.
- Editing currently saves drafts in the visitor's browser, without publishing.
- Enquiries use a D1 database. Submission viewing depends on the original Sites authentication and a hard-coded authorised owner.
- GitHub stores exported source. A GitHub commit currently does not automatically deploy the Site.

## Git workflow for every phase

GitHub is the reviewable source of truth for implementation changes. Each completed phase must update the relevant source, content, configuration, tests and documentation in the same commit or clearly linked commits. Report the confirmed commit and verification results after each phase.

Before editing, inspect the current remote branch. Keep unrelated developer changes, use normal commits, and update the branch with an expected-head check. If the branch changes during work, reconcile it before pushing. Do not leave a completed source change only in the local workspace or only in the Sites source repository.

Sites has a separate source/publication workflow. When publishing a Site change, use the same application source committed to GitHub, synchronise it with the existing Site project, and verify the saved version and successful deployment. Preserve the current audience. GitHub CI can run checks on pushes and pull requests once configured; production deployment automation requires the chosen hosting integration and protected runtime credentials.

Published page content, source, migrations, tests and audit manifests belong in Git. Client enquiry records, private CMS database exports, tokens, passwords and other credentials do not. Runtime data backup and transfer must be handled separately.

## Phase 1: acquire and inventory the original site

Obtain an authoritative export of published CMS content, metadata and media, or a complete direct HTML crawl with raw responses and metadata. Search-result excerpts cannot establish exact wording or exact metadata. Pages that cannot be fetched must remain recorded as blocked; do not reconstruct or paraphrase them.

Discover URLs using the original CMS, sitemaps and internal links. Reconcile the candidate list with Search Console/analytics exports, PDFs and image/download URLs. Record status, redirect target, canonical URL, indexing directives and content type for each source URL.

Proposed repository changes:
- scripts/import-sds-content.mjs
- src/content/sds/ and src/seo/sds/
- config/migration-manifest.json
- docs/migration/source-inventory.json
- docs/migration/source-provenance.md

Acceptance: every in-scope source URL has a captured, dated source record or an explicit unresolved blocker. Do not claim a full migration until the inventory is complete.

## Phase 2: import original wording into the new design

Populate structured content from the original source and render it in the new design. Replace existing rewrites as well as generic legacy fallbacks. Preserve text order and heading semantics while permitting layout and CSS changes. Retain original navigation, business contact information, trust statements, legal text, form labels and relevant link labels.

Import original media, alternative text, captions and downloads. Serve required existing media/download paths; optimise assets without altering copy or removing required resources.

Proposed repository changes:
- src/content/sds/*
- src/assets/ or public/ media, as appropriate to the chosen build
- scripts/build-worker.mjs
- worker/index.template.js
- src/index.html and shared presentation templates/styles

Acceptance: each destination page's rendered wording matches the captured original after decoding HTML entities and normalising layout whitespace only. Case, punctuation, numbers and meaningful text must remain unchanged. No generic fallback passes as a completed migrated page.

## Phase 3: preserve metadata and routing

Carry over titles, meta descriptions, heading hierarchy, canonical URLs, robots directives, Open Graph/Twitter metadata and relevant structured data. Preserve published dates and authorship. Keep raw source records for comparison, including absent metadata rather than inventing replacements.

Centralise the production origin and staging behaviour. Keep original paths and existing redirect behaviour. Add an explicit mapping only where a redirect is required. Generate the sitemap from the verified manifest and preserve appropriate production indexing rules. Prevent review deployments from competing with the production site for indexing.

Proposed repository changes:
- src/seo/sds/*
- config/site-config.*
- config/redirects.*
- sitemap/robots generation in the build and Worker
- docs/migration/url-map.json

Acceptance: all in-scope URLs produce the expected status and destination; production metadata matches its source; no temporary staging indexing override can accidentally ship to production.

## Phase 4: add meaningful migration checks and GitHub CI

Add checks for inventory completeness, unchanged rendered wording, original titles/descriptions, canonical and robots parity, missing assets/downloads, link integrity, unexpected redirects, placeholder pages and genuine 404 handling. Compare against source capture records rather than only against renderer-generated expectations.

Add GitHub Actions to install locked dependencies, build, run checks and publish a readable audit result on pushes/pull requests. A successful build alone must not imply migration approval.

Proposed repository changes:
- scripts/validate-migration.mjs
- tests/ for route and enquiry behaviour where needed
- package.json and package-lock.json
- .github/workflows/validate.yml
- docs/migration/coverage.json with source snapshot and commit provenance

Acceptance: the release checks fail for any unexplained missing page, changed wording/metadata, generic fallback or broken required asset.

## Phase 5: make local development and deployment repeatable

Add working dev and preview commands and a documented deployment path for the agreed host. Preserve the existing runtime until that choice is made; do not claim a portable deployment configuration is ready without testing it against the actual host.

Add the required host configuration, runtime binding examples, environment documentation and staging/production separation. Configure automated deployment only after the hosting account/integration is available. Add health checks, release identification and a tested rollback procedure.

Proposed repository changes:
- package.json and package-lock.json
- scripts/preview and deployment helpers as required
- hosting configuration for the selected provider
- .env.example only for variables actually used
- .github/workflows/ deployment workflow when supported
- README.md and docs/DEPLOYMENT.md

Acceptance: a fresh checkout can be built and previewed using the documented commands; a staging deployment succeeds; required credentials remain in the hosting/GitHub secret stores.

## Phase 6: verify enquiries, authorised access and operational continuity

Preserve all required original form fields and wording. Test valid/invalid submissions, database persistence, duplicate/error handling, the authorised submissions view, CSV export and rejection of unauthorised access. Test any configured notifications or CRM routing using controlled test destinations.

If hosting changes, replace the original host's trusted identity-header dependency with an appropriate verified authentication integration. Decide staff roles before adding access. Add proportionate spam controls and logging without collecting unnecessary personal information.

Document schema migration, existing-data transfer if required, backup, restoration and retention responsibilities. Verify these separately from the public source repository.

Proposed repository changes:
- worker/ form and admin handlers
- db/ and drizzle/ additive schema migrations as needed
- authentication integration for the chosen host
- tests/ enquiry and access checks
- docs/ENQUIRIES.md and docs/DATA_OPERATIONS.md

Acceptance: a controlled enquiry is visible to the correct authorised operator, access checks pass, and the backup/restore and follow-up procedure is documented and verified.

## Phase 7: publishing workflow, tracking and usability

Agree a maintainable editing workflow with the developer. Git-backed structured content and validated commits provide a concrete publishing path. A staff CMS may be added once its platform, roles and connection to Git are chosen. The existing browser-draft helper must not be presented as a publishing CMS.

Carry over the actual existing tracking configuration, conversion events and relevant consent behaviour from the source/integration settings; do not invent tracking IDs. Check original CTA destinations, call links, enquiry confirmation behaviour and external integrations.

Verify representative page templates on mobile/desktop, keyboard navigation, form errors, heading structure, media dimensions and performance. Apply layout, delivery and image improvements while the copy-parity checks continue to pass.

Proposed repository changes:
- content publishing scripts/integration and related documentation
- shared templates, styles and asset delivery
- tracking configuration and tests where applicable
- docs/EDITOR_WORKFLOW.md and docs/QA.md

Acceptance: publishing is reproducible; tracking is tested; representative templates and every distinct form pass review without copy changes.

## Phase 8: final handover and production cutover

Prepare the original-source inventory, old-to-new URL/status map, metadata/content parity report, deployment instructions, runtime dependencies, remaining access requirements, owner responsibilities and rollback instructions. Identify incomplete items explicitly.

The developer/SEO contractor should review the actual crawl and Search Console data before cutover. Preserve Search Console verification, verify the production sitemap and monitor forms, logs, crawl errors, conversions and traffic after launch. DNS/domain changes and any old-host redirects are final cutover tasks after the acceptance checks pass.

Proposed repository changes:
- docs/HANDOVER.md
- docs/LAUNCH_CHECKLIST.md
- docs/ROLLBACK.md
- final migration audit manifests

Acceptance: complete source coverage; no unexplained wording/metadata differences; working forms and authorised data access; confirmed staging deployment; tracking verification; and a reproducible rollback. The production domain then serves the verified release.

## Immediate input needed

A complete export of published SDS pages, metadata and media is the most reliable starting point. A full raw HTML crawl is an alternative if all relevant pages are accessible. The current public retrieval attempts have been inconsistent, so completeness must be checked rather than assumed.

The host/CMS integration, original tracking settings, Search Console/analytics URL data and any existing enquiry-data transfer requirements must also be confirmed. Work on repository checks, structured import support and documentation can proceed while these inputs are collected.

