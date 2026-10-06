# SDS migration handover

Prepared 6 October 2026. Production remains **https://www.sds-solicitors.com**; DNS has not changed. The current review release fits original SDS wording and SEO into the approved version-41 design. The rejected CMS layout remains an archived research baseline.

## Implemented

- All **296 captured routes** have original primary page content and SEO titles/meta/canonicals/JSON-LD. The review sitemap includes all 248 original sitemap URLs and retained new-design routes.
- Original paragraphs, headings, lists, FAQs, article/profile media and form labels/options are compared with immutable raw captures. Shared navigation, fonts, CSS, logo, footer and homepage carousels use the approved design. Shared source staff modals/navigation are not copied as article content.
- The directory retains its 24 listed people; all 25 captured profile paths are available. Articles and pagination retain original content.
- Seven original form schemas use prepared D1 queries, validation, CSRF/honeypot protection, durable limits and idempotent requests. Private evidence uses R2. Owner-only submissions/CSV/private downloads include earlier `enquiries`; authenticated drafts are active on migrated pages.
- Available original media are packaged under `dist/client` with checksum-addressed Worker URLs that enforce correct MIME types. The generated content validation verifies used media bytes/types locally. Earlier hosted MIME failures remain historical evidence; a full fresh hosted-media audit is not claimed here.
- Normal `npm run check` verifies current served copy, original SEO, approved styles/shared components, media/links, noindex and production blocking, then runs thirteen meaningful backend tests. GitHub CI uses the same commands.
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

Some original complaints links resolve to `/complaints/www.…` and the old site responds 200. These captured legacy responses are retained for exact migration. Check their intended external destinations with SDS before correcting link targets; this does not authorise changing the complaints wording.

## Start here

On `main`, these commands build, verify and preview the approved design with original content and SEO:

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Node **24** is required. Public media are in `public/`; immutable original captures in `migration/source-pages/`; original SEO in `src/seo/sds/pages/`; source article/form content in `src/content/sds/`; generated current page content in `src/content/current-design/`. Build with `scripts/build-content-current-design.mjs`. Form/admin persistence is implemented by `worker/runtime.mjs` and delegated to by the current Worker.

Read [DEPLOYMENT.md](DEPLOYMENT.md), [ENQUIRIES.md](ENQUIRIES.md), [EDITOR_WORKFLOW.md](EDITOR_WORKFLOW.md), [DATA_OPERATIONS.md](DATA_OPERATIONS.md), [QA.md](QA.md), [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) and [ROLLBACK.md](ROLLBACK.md). Publication evidence is recorded in `docs/migration/deployment.json` after a confirmed deployment.
