# SDS website: agency SEO and development review brief

Prepared 6 October 2026. **Purpose: assess the redesign, recommend the remaining work and define a safe launch plan. This is a review request, not approval to launch.**

## 1. Business objective

Replace the existing SDS website with the redesigned site while protecting existing organic visibility, valuable landing pages and enquiry generation. Improve the clarity, usability and conversion of the housing-disrepair journey, with particular emphasis on qualified council and housing-association tenant enquiries.

The review should establish whether the design, technical implementation and migration approach support those objectives, and identify the work needed before launch. The agency should establish current traffic and conversion baselines from the relevant accounts before proposing numerical targets. No ranking or enquiry-volume improvement is assumed.

## 2. Fixed review baseline and links

| Item | Review reference |
|---|---|
| Live review website | https://housingconditionclaims.org/ — **published version 76** |
| Code baseline | [GitHub revision 7c9febf49162544cd0c2f8be66ade5c870cb1dde](https://github.com/CorbynDavidson/SDS_Website2/tree/7c9febf49162544cd0c2f8be66ade5c870cb1dde) |
| Deployed source reference | Sites commit `0680198d43eab8bade6a6a6af67021ae697ebcfa` |
| Intended production domain | **https://www.sds-solicitors.com/** |
| Existing production website | https://www.sds-solicitors.com/ |
| Owner editor entry | https://housingconditionclaims.org/?edit=1 |
| URL inventory | Supplied `SDS_URL_Migration_Map.xlsx`; see the version qualification in the appendix |
| Production sitemap | [Repository sitemap at the code baseline](https://github.com/CorbynDavidson/SDS_Website2/blob/7c9febf49162544cd0c2f8be66ade5c870cb1dde/sitemap.xml) |

Please report findings against version 76 and the pinned code revision, rather than a moving `main` branch. This sync includes the production-only 410 plan and its validation. Agree and record a new baseline if implementation changes during the review.

Housing Condition Claims is the **review hostname for the SDS replacement**, not the intended final primary domain. Canonicals, sharing URLs, schema and the launch sitemap deliberately identify SDS. If the business instead wants a separate Housing Condition Claims production website, resolve that strategy before recommending a migration or domain cutover.

The review site remains noindex. The existing SDS website, hosting and DNS have not been switched.

## 3. Deliverables requested from the agency

| Deliverable | Required outcome |
|---|---|
| Prioritised SEO and development findings | A consolidated issue register stating affected URLs/templates, evidence, impact, recommended correction, priority, responsible party, estimated effort and whether each issue blocks launch. |
| SEO migration assessment | Reconcile the URL map against Search Console, analytics, backlinks, ad destinations and legacy redirects/logs. Identify missing or valuable URLs; assess redirects, canonicals, indexation, sitemap, internal linking, content and structured data. |
| Hosting and CMS recommendation | Recommend a maintainable setup and explain the options against content editing, approval workflow, security, lead handling, performance, costs, ownership and support. Identify the implications for the current Worker/D1/R2 implementation. Do not assume a platform change is necessary. |
| Development and conversion assessment | Review representative templates, mobile behaviour, accessibility, performance, editor workflow and all distinct enquiry journeys. Distinguish database storage from successful notification/CRM delivery and follow-up. |
| Measurement plan | Confirm consent requirements, analytics, conversion events and WhatConverts integration. Establish pre-launch baselines and identify gaps that prevent reliable reporting. |
| Implementation proposal | Provide recommended scope, dependencies, owners, estimated effort/cost and proposed timetable. Separate essential launch work from optional enhancements. |
| Launch sign-off requirements | Define objective acceptance criteria, who signs off each area, DNS/indexing cutover steps, rollback triggers and post-launch monitoring. Confirm whether launch is recommended and list unresolved blockers. |

Findings should be actionable and evidence-based. A working link or a passing code test alone is not sufficient evidence of end-to-end lead delivery or production readiness.

## 4. Review priorities and acceptance

Use these priorities, adjusting individual issues with evidence:

- **P0 — launch blocker:** broken enquiry delivery, privacy/security defects, incorrect production indexation, material URL/routing loss, failed HTTPS/domain setup, or absence of a workable backup/rollback plan.
- **P1 — resolve before launch unless explicitly accepted:** material mobile/accessibility problems, significant content or tracking defects, unresolved high-value historical URLs and performance issues affecting core journeys.
- **P2 — follow-up improvement:** lower-impact presentation, editorial, usability or optimisation opportunities that do not compromise the agreed launch criteria.

Before launch, require evidence that intended public pages and redirects work on the final origin; forms reach the agreed destination and responsible staff; tracking respects the approved consent setup; representative devices and accessibility checks pass; and recovery arrangements have been tested.

Reviewing can begin while these checks are outstanding. Production release gates must not be marked complete merely because local code checks pass.

## 5. Access and information required

| Access / input | Purpose | Suggested provider |
|---|---|---|
| Search Console for SDS and, where available, the review domain | Performance, indexed URLs, live inspection and migration monitoring | SDS / existing SEO provider |
| Analytics and historical landing-page/conversion exports | Traffic and conversion baselines; valuable or missing routes | SDS / marketing team |
| Backlink exports, old redirect configuration and relevant historical request logs | Complete the legacy URL inventory beyond public sitemaps | Existing SEO / developer / host |
| GTM, consent configuration, WhatConverts and advertising landing-page inventory | Consent, conversion and call tracking; campaign continuity | Marketing team |
| Existing CMS/Reform rules and original form configurations | Eligibility, branching, uploads, confirmations and routing | Original CMS administrator |
| Approved notification/CRM destination and follow-up process | Synthetic end-to-end delivery testing and operational ownership | SDS operations |
| DNS, current hosting and proposed hosting information | Feasibility, TLS, cutover and rollback planning | Domain owner / developer |
| Current firm-approved content, service scope and credentials | Content and regulatory-detail approval | SDS |

Use read-only or least-privilege access for assessment where sufficient. Confirm the named reviewers and required roles before granting additional access. Share account access and any confidential exports through an agreed secure channel; do not place credentials, lead data or private account exports in the public repository.

The editor is currently owner-only. Sharing its URL does not grant agency editing permission. Saving a draft does not publish it. Agree the ongoing editing, approval and publication workflow as part of the CMS recommendation.

## 6. Responsibilities and review boundaries

The agency should own the SEO/development assessment, recommendations and proposed implementation plan. SDS should supply account access, approve firm/service content and confirm lead-follow-up ownership. The original CMS administrator should supply private form rules. The developer/domain owner should verify hosting, backups, TLS, cutover and rollback arrangements.

The migration inventory has **23 provisional production-only 410 routes pending SEO sign-off**, and account-level reconciliation remains outstanding. Lead routing, measurement, real-device/accessibility/performance sign-off, backup/restore and production-domain readiness also remain pending. Assign named owners and deadlines in the returned issue register.

Please do not switch DNS, enable production indexing, alter the current SDS site, grant additional editor access or send real test enquiries as part of the assessment. Agree any synthetic submission destinations and implementation work separately. Keep the review site on the fixed baseline while findings are gathered.

## Appendix: implementation and evidence

### Review controls and completed checks

Review settings remain `RELEASE_MODE=review`, `INDEXING_DISABLED=true`. Public responses carry `X-Robots-Tag: noindex, nofollow` and explicit `robots`/`googlebot` HTML meta tags containing `noindex, nofollow`. Review HTML and robots.txt have no-store cache directives, and public crawling is permitted so crawlers can read noindex. Private/admin/editor routes remain protected and disallowed. This control does not establish that previously indexed URLs have disappeared; verify that in Search Console. See [pause and restoration](TEMPORARY_INDEXING_PAUSE.md).

Version 70 repairs the obsolete `/faqs` homepage redirect, provides the approved trust bar on all 325 public templates, keeps review-page links on the current review origin, improves editor sign-in/error feedback and applies two recorded homepage proofreading corrections. Immutable source captures are retained.

Checks cover all 325 compiled public templates, approved copy exceptions, source hashes, SEO, routing, sitemap, assets and backend security/persistence. Local checks cover all 325 templates; 31 JavaScript and two Python SEO tests passed for version 76. GitHub Actions must also validate this new baseline; the earlier baseline's result is historical. These are not a fresh live crawl, physical-device test or accessibility certification. Earlier version-specific hosted/browser evidence remains historical.

### Versions 71–75: validation and indexing updates

Forms now share browser/server phone validation with `libphonenumber-js/max` (UK default; international country codes accepted), offer optional corrections for common email-domain typos, and normalise UK postcodes. Email-domain mail routing is checked through Cloudflare DNS; postcodes are looked up through Postcodes.io. Definitive invalid results prompt correction; provider timeouts or uncertain results permit submission. Only the domain or postcode is shared with its respective service.

The same-origin `POST /api/contact-check` endpoint has origin/CSRF protection and a separate rate limit; it creates no leads. Email and postcode checks run on leaving the field and before submission. Phone checks run locally and on the server. These checks do not prove mailbox existence, an active phone line, reachability or ownership. No paid verification provider or email/SMS ownership challenge is connected.

Automated tests cover browser handlers, server enforcement, provider outcomes and failure handling. Provider responses were mocked; successful live outbound DNS/Postcodes.io lookups have not yet been verified. The agency should verify these on the deployed site using approved synthetic details.

Version 75 applies `noindex, nofollow` in the HTTP header and explicit HTML robots/Googlebot tags across all 325 public templates. Public crawling remains allowed so Google can read noindex. Existing search results may persist until recrawl; the Search Console property owner should request temporary prefix removal if prompt suppression is needed. An entire-site temporary removal request was submitted in Search Console on 6 October 2026; check its current status in that account.

### Version 76: provisional 410 routes at SDS cutover

The 23 exact paths listed in the workbook’s **Needs Review** sheet are in [production-retirements.json](../config/production-retirements.json). They return `410 Gone` without a redirect only on the SDS hostname with `RELEASE_MODE=production`. The current Housing Condition Claims review host and SDS review mode retain their existing 404 responses; this deployment did not switch the existing SDS site or DNS.

The compiled Worker audit verified GET and HEAD on both SDS host variants, all 23 unchanged review responses, sitemap exclusion, and the 325 existing public templates. The workbook’s original HTTP and new HTTP columns remain historical version-66 observations; the added **410 Cutover Plan** sheet identifies the future rule separately.

Before cutover, agency SEO should review Search Console traffic, backlinks and historic redirect destinations for each URL. Where a valuable relevant replacement exists, choose a 301 instead and update the exact-path configuration and workbook. These are provisional decisions, not evidence that the original SDS site has started returning 410.

### URL inventory and rebuilding

The supplied workbook was compiled for version 66 / GitHub commit `8db9f29d91e928781e5613a6d71472e43d1aeb44`. It remains the inventory, not the version-75 release identifier: 324 captured source URLs, 248 current sitemap URLs and 243 launch sitemap URLs. The repaired non-slash `/faqs` alias is a later routing change.

The public repository preserves existing raw capture and generated client-story snapshots rather than re-uploading sensitive third-party material. Cached `src/content/current-design/` pages/index and generated copy/routing reports may predate the code baseline. With Node 24, run:

```sh
npm ci --ignore-scripts
npm run check
```

This regenerates the reviewed pages and reports, including `docs/migration/production-routing.json`. Compare the resulting build with published version 76. The production sitemap intentionally contains SDS URLs and is also available at `public/sitemap.xml` and the review host's `/sitemap.xml`.

### Further reference

- [Developer handover](HANDOVER.md)
- [Editor and publication workflow](EDITOR_WORKFLOW.md)
- [Production SEO implementation](PRODUCTION_SEO.md)
- [SEO launch evidence and remaining checks](SEO_LAUNCH_ACTIONS.md)
- [Launch checklist](LAUNCH_CHECKLIST.md)
- [All-template review validation](migration/review-readiness-validation.json)

All seven `config/release-gates.json` entries remain false pending operational evidence. Known inherited malformed complaints links and unavailable legacy assets are recorded in the handover for assessment.
