# Agency SEO and development review

Prepared 6 October 2026. This document is the current review entry point and takes precedence over older readiness statements in historical migration reports. It describes review readiness, not production launch approval.

## Scope and environments

- Review site: https://housingconditionclaims.org/
- Owner editor entry: https://housingconditionclaims.org/?edit=1
- Public source mirror: https://github.com/CorbynDavidson/SDS_Website2
- Intended production domain: **https://www.sds-solicitors.com**.

This project is a replacement design/hosting build for the existing SDS primary domain. Housing Condition Claims is the review hostname. Production canonicals, sharing URLs, schema and launch sitemap deliberately identify SDS. If a separate Housing Condition Claims production site is desired, revisit the strategy before cutover.

The existing SDS website and DNS have not been switched. Review settings remain `RELEASE_MODE=review`, `INDEXING_DISABLED=true`: public pages carry `X-Robots-Tag: noindex, follow`; public crawling is permitted so crawlers can read noindex. Private/admin/editor routes remain protected and disallowed. This is an implemented control, not confirmation that all previously indexed URLs have disappeared. Verify that in Search Console. See [temporary pause and restoration](TEMPORARY_INDEXING_PAUSE.md).

## Changes completed for review

- `/faqs` now resolves to `/faqs/`, overriding the obsolete historical homepage redirect. FAQ navigation points directly to the retained FAQ route.
- All 325 public templates include exactly one copy of the approved homepage ReviewSolicitors/SRA/HLPA trust bar. Existing desktop dimensions and responsive CSS are reused. Pages without a local callback form link to the retained claim-enquiry page.
- All SDS page navigation on review hosts uses the current review origin at the server, supporting new tabs, modifier clicks and navigation without JavaScript. Production metadata and external destinations are unchanged.
- Two explicit homepage proofreading corrections are recorded separately; original source captures stay immutable.
- Editor status, sign-in and connection errors are visible. The all-wording draft editor remains owner-only and saving does not publish. See [editor workflow](EDITOR_WORKFLOW.md).

## Review pack and verification

The supplied `SDS_URL_Migration_Map.xlsx` was compiled for version 66 / GitHub commit `8db9f29d91e928781e5613a6d71472e43d1aeb44`; it is the URL inventory, not the release identifier for this later update. Its 324 captured source URLs, 248 current sitemap URLs and 243 launch sitemap URLs remain the migration scope. The repaired non-slash `/faqs` historical alias is an explicit change to its historical routing information. Run `npm ci --ignore-scripts` and `npm run check` to regenerate `docs/migration/production-routing.json` from the current implementation, then use the review publication for display. The public mirror's current `main` commit identifies the reviewed source tree.

Read [handover](HANDOVER.md), [launch checklist](LAUNCH_CHECKLIST.md), [production SEO](PRODUCTION_SEO.md) and [SEO evidence](SEO_LAUNCH_ACTIONS.md). The XML sitemap is at repository root `sitemap.xml`, `public/sitemap.xml` and review host `/sitemap.xml`; it contains production-domain URLs intentionally.

`npm run check` builds and verifies source hashes, approved copy exceptions, SEO, sitemap/routes, assets and backend security/persistence. `docs/migration/review-readiness-validation.json` records all-template FAQ/trust/editor/navigation/indexing checks. These exercise the compiled Worker; they are not a fresh live crawl or a physical-device/accessibility certification. Earlier version-specific hosted/browser evidence remains historical, not proof of this release.

## Remaining review and launch work

| Work | Responsible party / evidence needed |
|---|---|
| Complete historical URL inventory | Agency SEO: reconcile Search Console, analytics, ad destinations, backlinks and old redirects/logs; assess the workbook's 23 unresolved historical URLs. |
| Content and firm details | SDS + agency: approve copy, current services, membership/review claims and intended complaints links. Inherited malformed complaints URLs and unavailable old assets are documented in handover. |
| Forms and eligibility | Original CMS administrator + developer: confirm eligibility/branch rules, uploads, confirmations and all seven distinct schemas. |
| Lead delivery | SDS operations + developer: verify notifications/CRM delivery, follow-up ownership and approved synthetic end-to-end tests. Storage checks alone do not establish delivery. |
| Consent and measurement | Marketing agency: approve consent setup, GTM/analytics, conversion events, WhatConverts numbers and account ownership. Review tracking remains disabled. |
| Devices, accessibility and performance | Developer + SDS: real iPhone Safari/Android/desktop checks, trust-bar overlap, menus/carousels, keyboard and screen-reader use, upload journeys and measured Lighthouse/Core Web Vitals. |
| Hosting, backups and launch | Developer/domain owner: select hosting, rehearse D1/R2 backup/restore, verify DNS/TLS and email records, retain rollback and monitoring. Provider-specific DNS plans are preparation, not an instruction to switch. |

All seven `config/release-gates.json` entries remain false pending operational evidence. Do not mark them complete merely because code checks pass. Do not switch DNS, enable production indexing or send real test leads as part of read-only review.

The agency can start reviewing now; launch remains blocked pending these items. Work from a stable source/review version and report findings against it. No additional agency editing access has been granted.

## Source mirror and generated snapshots

The public repository update intentionally preserves existing raw capture and generated client-story snapshots rather than re-uploading sensitive third-party material. Cached `src/content/current-design/` pages/index and generated copy/routing reports may predate the current source. Run `npm run check` to regenerate them before comparing hashes or reviewing rendered content. The deployed version 70 was built and validated from the updated renderer. Source commit on Sites: `7e7c3b4b6223e989cb4c0066a49909f237352777`. Only source/editor/validation changes, non-sensitive audit counts and handover notes are newly uploaded in this review update.
