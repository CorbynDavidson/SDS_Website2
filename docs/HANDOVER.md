# SDS migration handover

Prepared 6 October 2026. Production origin remains **https://www.sds-solicitors.com**. **https://housingconditionclaims.org** is the review deployment and is noindex. Production DNS has not been changed.

## Implemented

- The authoritative Concrete CMS sitemap contains **248 published URLs**. Raw anonymous HTML, original sitemap/robots, metadata, visible wording, forms and first-party media are captured in Git.
- Additional linked URLs and original listing pagination are included. The precise totals and one-to-one original/review URL mapping are generated in [migration/coverage.json](migration/coverage.json) and [migration/url-map.csv](migration/url-map.csv).
- Each imported page retains the original full content and metadata. Shared styling applies the new SDS colours/logo and responsive presentation. No text is rewritten, including existing spelling, heading levels and regulatory wording.
- `npm run validate` compares compiled and served production HTML with immutable raw captures for every route. Review responses are separately checked for noindex and disabled analytics. Unknown routes return a real 404.
- Seven original form schemas have replacement handlers, prepared D1 queries, validation, CSRF/honeypot protection, durable rate limits and idempotent submission keys. Earlier `enquiries` records remain available.
- Private evidence files use R2; enquiry records and drafts use D1. The submissions view, CSV and evidence downloads require an allowlisted authenticated owner. Portable hosting verifies signed Cloudflare Access JWTs.
- Thirteen meaningful backend tests cover the original schemas, persistence, invalid submissions, duplicate requests, spam controls, owner access, legacy data, escaping, CSV safety, drafts, private files and JWT verification.
- GitHub capture/import automation commits captured content and generated audit files after checks pass. Push/PR validation builds and verifies the site. Secrets and submissions are never stored in the public repository.

## Remaining production gates

These are recorded as `false` in [../config/release-gates.json](../config/release-gates.json). `node scripts/check-release.mjs` blocks a production release until each has real evidence and an owner sign-off.

| Gate | Remaining action | Owner |
|---|---|---|
| Original multi-step rules | Obtain the Concrete CMS Reform submission rules, eligibility branches, upload policy and confirmation/routing settings. The review flow collects all five questions and stores the result; private CMS decisions are not reconstructed from guesses. | SDS / original CMS administrator |
| Lead follow-up | Confirm who monitors submissions and connect/verify the existing email or CRM destination. Storage works; no unverified notification or CRM routing is claimed. | SDS operations / developer |
| Tracking and consent | Original GA4, GTM, Meta, Clarity, WhatConverts and CookieInformation source configuration is preserved for production and disabled in review. Verify account permissions, consent behaviour, conversion events and call tracking on the final domain. | Marketing contractor |
| URL completeness beyond public links | Compare this full public sitemap/crawl with Search Console, analytics, ad landing URLs and backlink exports. Add any hidden published routes/redirects using the same raw-source process. | SEO contractor |
| Backup and restore | Verify a restricted production D1 export, restore rehearsal and private evidence backup; agree retention and deletion ownership. Existing data is not copied into Git. | SDS data owner / developer |
| Browser and mobile sign-off | Review representative templates and every distinct form on real mobile/desktop devices, including menus, focus, uploader, conditional journeys and performance. Automated parity checks are not a full accessibility audit. | Developer / SDS |
| Domain and rollback | Verify access to SDS DNS/old hosting; retain the old deployment and current DNS values; switch only after the other gates pass. Preserve email DNS. | Domain owner / developer |

## Original source issues

Twelve original resource URLs already returned **404** during capture; all are recorded, with URL/status, in the source inventory and coverage report. They include `news-bg.jpg` and legacy Concrete UI images. Available original resources are preserved byte-for-byte. No replacement file is invented for an unavailable original.

Some original complaints links resolve to `/complaints/www.…` and the old site responds 200. These captured legacy responses are retained for exact migration. Check their intended external destinations with SDS before correcting link targets; this does not authorise changing the complaints wording.

## Start here

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

Node **24** is required. Public media are in `public/`; editable page HTML in `src/content/sds/pages/`; original SEO baselines in `src/seo/sds/pages/`; original immutable raw HTML in `migration/source-pages/`. The runtime is `worker/runtime.mjs`. Old design source is retained in Git history/source files for reference; it is not the active build entrypoint.

Read [DEPLOYMENT.md](DEPLOYMENT.md), [ENQUIRIES.md](ENQUIRIES.md), [EDITOR_WORKFLOW.md](EDITOR_WORKFLOW.md), [DATA_OPERATIONS.md](DATA_OPERATIONS.md), [QA.md](QA.md), [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) and [ROLLBACK.md](ROLLBACK.md). Publication evidence is recorded in `docs/migration/deployment.json` after a confirmed deployment.
