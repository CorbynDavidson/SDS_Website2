# SDS migration handover

Prepared 6 October 2026. Production remains **https://www.sds-solicitors.com**; DNS has not changed. The current review release fits original SDS wording and SEO into the approved version-41 design. The rejected CMS layout remains an archived research baseline.

## Implemented

- All Locations includes all 119 original city and borough links in a rounded directory box. `config/location-directory.json` keeps the owner's labels and legacy paths; the build updates the corresponding page file automatically. Marked directory links use the website being viewed while canonicals, metadata and sitemap URLs remain on SDS. Validation checks all destinations on production and three review origins, including ordinary links that work without JavaScript or in a new tab, and isolates this component's styling to the directory page. Evidence: `migration/location-directory-validation.json`.
- All **296 captured routes** have original primary page content and SEO titles/meta/canonicals/JSON-LD. All 248 live legacy sitemap URLs remain available and are tested. The production sitemap contains 243 self-canonical URLs: 242 indexable SDS originals plus FAQs. The six original noindex utility URLs remain available outside the sitemap.
- Eight additional claims pages are retired with single-hop 301s to their original SDS-content counterparts. Both slash variants redirect on production and review; review redirects stay on the website being viewed. Internal links point directly to retained SDS URLs. `config/page-consolidation.json` records the owner's selection; [PRODUCTION_SEO.md](PRODUCTION_SEO.md) gives the exact mapping and `migration/page-consolidation-validation.json` verifies it. Original wording, metadata, approved design and other original service pages are preserved.
- Original paragraphs, headings, lists, FAQs, article/profile media and form labels/options are compared with immutable raw captures. Shared navigation, fonts, CSS, logo, footer and homepage carousels use the approved design. Shared source staff modals/navigation are not copied as article content.
- The directory retains its 24 listed people; all 25 captured profile paths are available. Articles and pagination retain original content.
- Seven original form schemas use prepared D1 queries, validation, CSRF/honeypot protection, durable limits and idempotent requests. Private evidence uses R2. Owner-only submissions/CSV/private downloads include earlier `enquiries`; authenticated drafts are active on migrated pages.
- Available original media are packaged under `dist/client` with checksum-addressed Worker URLs that enforce correct MIME types. The generated content validation verifies used media bytes/types locally. Earlier hosted MIME failures remain historical evidence; a full fresh hosted-media audit is not claimed here.
- Normal `npm run check` verifies current served copy, original SEO, approved styles/shared components, media/links, review noindex and production indexability/redirects/schema, then runs fourteen meaningful backend tests. The screenshot callback replacement is the sole approved form-copy exception; the validator compares its form against the original homepage callback and the remainder against this page's original source. GitHub CI uses the same commands.
- Corresponding generated content, SEO baselines, route indexes, build adapter and audit reports are committed. Secrets and submissions never enter the public repository.

See [CONTENT_MIGRATION.md](CONTENT_MIGRATION.md) and `migration/content-validation.json` for the selected release. The metadata-only reports and full-document CMS candidate reports describe earlier releases.

## Remaining production gates

These are recorded as `false` in [../config/release-gates.json](../config/release-gates.json). `node scripts/check-release.mjs` blocks a production release until each has real evidence and an owner sign-off.

| Gate | Remaining action | Owner |
|---|---|---|
| Original multi-step rules | Obtain the Concrete CMS Reform submission rules, eligibility branches, upload policy and confirmation/routing settings. The review flow collects all five questions and stores the result; private CMS decisions are not reconstructed from guesses. | SDS / original CMS administrator |
| Lead follow-up | Confirm who monitors submissions and connect/verify the existing email or CRM destination. Storage works; no unverified notification or CRM routing is claimed. | SDS operations / developer |
| Tracking and consent | Original tracking configuration is retained in the captured source; review tracking is disabled. Integrate the approved production tracking and consent settings before cutover. Verify account permissions, consent behaviour, conversion events and call tracking on the final domain. | Marketing contractor |
| URL completeness beyond public links | Compare this full public sitemap/crawl with Search Console, analytics, ad landing URLs and backlink exports. Add any hidden published routes/redirects using the same raw-source process. | SEO contractor |
| Backup and restore | Verify a restricted production D1 export, restore rehearsal and private evidence backup; agree retention and deletion ownership. Existing data is not copied into Git. | SDS data owner / developer |
| Browser and mobile sign-off | Review representative templates and every distinct form on real mobile/desktop devices, including menus, focus, uploader, conditional journeys and performance. Automated parity checks are not a full accessibility audit. | Developer / SDS |
| Domain and rollback | Verify access to SDS DNS/old hosting; retain the old deployment and current DNS values; switch only after the other gates pass. Preserve email DNS. | Domain owner / developer |

## Original source issues

Twelve original resource URLs already returned **404** during capture; all are recorded, with URL/status, in the source inventory and coverage report. They include `news-bg.jpg` and legacy Concrete UI images. Available original resources are preserved byte-for-byte. No replacement file is invented for an unavailable original.

Some original complaints links resolve to `/complaints/www.…` and the old site responds 200. Their exact duplicate content now redirects once to the original canonical complaints page. Check their intended external destinations with SDS before correcting link targets; this does not authorise changing the complaints wording.

## Start here

On `main`, these commands build, verify and preview the approved design with original content and SEO:

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Node **24** is required. Public media are in `public/`; immutable original captures in `migration/source-pages/`; original SEO in `src/seo/sds/pages/`; source article/form content in `src/content/sds/`; generated current page content in `src/content/current-design/`. Build with `scripts/build-content-current-design.mjs`. Form/admin persistence is implemented by `worker/runtime.mjs` and delegated to by the current Worker.

Read [DEPLOYMENT.md](DEPLOYMENT.md), [ENQUIRIES.md](ENQUIRIES.md), [EDITOR_WORKFLOW.md](EDITOR_WORKFLOW.md), [DATA_OPERATIONS.md](DATA_OPERATIONS.md), [QA.md](QA.md), [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) and [ROLLBACK.md](ROLLBACK.md). Publication evidence is recorded in `docs/migration/deployment.json` after a confirmed deployment.

## Production SEO preparation

The current production XML sitemap is directly available at the repository root as `sitemap.xml`, as well as `public/sitemap.xml`. Both copies and the Worker response are generated together and verified identical, with the existing 243-URL selection. The owner selected the standard homepage callback form shown in their screenshot for `/housing-disrepair-enquiries/`. It displays Full Name, Email, Phone Number, Postcode and Type of Disrepair in one column, retains the callback's wording/options/consent, and uses the same submission handler with this source URL added to its allowlist. Its fieldset matches the homepage exactly. The page's non-form content and SEO, and the other 296 public templates, are unchanged. All seven original handlers, including the former wizard, remain intact; immutable captures are not rewritten. `config/claim-enquiry.json` records this approved replacement and `src/claim-enquiry.css` applies only to this page. Evidence is in `migration/claim-enquiry-validation.json`.

See [PRODUCTION_SEO.md](PRODUCTION_SEO.md), `migration/production-url-map.csv`, `migration/production-routing.json` and `migration/production-seo-validation.json`. The code preserves current discontinued-service redirects for injury/negligence/RTA routes; it does not advertise those services as accepting new claims. The complete historic Search Console/backlink/server-log inventory remains outstanding.

Terms of Business uses the exact live wording checked on 6 October, including headings, lists and all three tables, at `/about-us/terms-business/`. Its dedicated stylesheet provides the approved site's rounded framing without changing other pages. Terms links resolve to the website being viewed at the server, including when JavaScript is disabled or the visitor opens a new tab; canonical, sharing and schema URLs remain on production. Claim pages retain their legacy URLs; the selected screenshot callback is the only form-content replacement, and other original five-step fields remain available; duplicate CMS form IDs and empty wrapper borders have been corrected. The rejected version-54 global panel changes have been reverted to the approved version-53 layout and colours. Local stylesheets now load from the current build rather than the old primary-domain host, fixing the display defect that survived the initial rollback. Both design stylesheets are checked against version-53 hashes on review and production hosts. Browser/device sign-off is still pending.

The subsequent authorised framing change is limited to location, disrepair-type and the eight Housing Guides introductory sections shown in the user's navigation screenshot. `config/enquiry-panel.json` selects the routes; `src/enquiry-panel.css` adds the rounded border and containment width without changing backgrounds, text colours, typography, grid definitions or form styles. The original design stylesheets remain unchanged. Other pages do not receive that stylesheet or wrapper class.
