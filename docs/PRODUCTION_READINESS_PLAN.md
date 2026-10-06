# SDS production readiness plan

Updated: 6 October 2026. Production destination: `https://www.sds-solicitors.com`. Review site: `https://housingconditionclaims.org`.

## Agreed scope

Preserve the approved website format while retaining original wording on the corresponding pages in the URL mapping. Keep the compensation guide accessible in the new format. Record changes and evidence in Git. Keep the review site noindex and do not switch production hosting until the launch checks are complete.

Mapped content and the compensation guide were implemented in review version 77; the evidence and limitations are documented in [CONTENT_PARITY_UPDATE.md](CONTENT_PARITY_UPDATE.md). This does not establish production sign-off or guarantee unchanged rankings.

## 1. Original Search Console and backlink reconciliation — pending access

- [ ] Obtain access to the original `sds-solicitors.com` Search Console property, or obtain Performance and Links exports from the existing SEO provider/property owner.
- [ ] Obtain the Pages tab of the Search results Performance report for the last 16 months available, including clicks, impressions, CTR, average position, date range and active filters.
- [ ] Obtain externally linked target pages and available external-link exports. Supplement with an existing backlink-provider export where available.
- [ ] Obtain Page indexing samples and, where available, analytics landing pages, historical request logs and old redirect configuration.
- [ ] Reconcile these records against all known old URLs, including URLs absent from the existing mapping. Review aliases together with their final destinations.
- [ ] Review the 23 provisional production 410 retirements individually; document whether each should remain removed, retain relevant content, or redirect directly to a genuinely equivalent page.
- [ ] Implement evidence-backed routing decisions and verify affected routes before marking `searchConsoleInventoryReviewed` complete.

**Access finding:** sign-in to Search Console succeeded, but the available property selector listed only `housingconditionclaims.org`. The original SDS property was unavailable in that account. Review-site data cannot establish the original site's historic traffic or backlink value. The next action is access to the original property through its owner/SEO provider or another authorised account, or receipt of its exports.

The available public/configuration review covered all 23 provisional retirements:

| Evidence category | URLs | Meaning |
|---|---:|---|
| Alias to a previously missing destination | 13 | Recorded audit found the destination already missing; traffic/link value remains unknown. |
| Redirect destination unresolved | 7 | Recorded original 301 lacks a Location value; establish the destination before deciding. |
| Member-access chain | 2 | Recorded chain ultimately points to login; confirm the continuing access requirement. |
| Alias to another review URL | 1 | Review the source and destination as one chain. |

Source: `config/production-retirements.json` and `docs/migration/historical-route-reconciliation.json`. The historical routing snapshot predates the later provisional 410 rules; its original-site observations are used for this review. No private account evidence has yet been reconciled, and none of the 23 is signed off by this review.

Missing export rows do not prove zero value. Do not redirect unrelated retired pages to the homepage. Keep private exports and reconciliation outputs under ignored `.data/seo/`; commit only public URL decisions and non-sensitive evidence summaries. Import commands and accepted columns are in [SEO_LAUNCH_ACTIONS.md](SEO_LAUNCH_ACTIONS.md#1-historic-urls).

## 2. Operational and user checks — pending sign-off

| Action | Required evidence | Release gate |
|---|---|---|
| Verify the original questionnaire rules | Representative eligibility branches, validation and completion behavior against approved rules | `originalWizardRulesVerified` |
| Verify lead follow-up | Controlled submission, correct receipt/routing and follow-up process | `leadFollowUpRoutingVerified` |
| Verify analytics and consent | Approved tracking events, consent behavior and reporting configuration | `analyticsAndConsentVerified` |
| Verify backup and restore | Recoverable production backup and tested restore procedure | `productionBackupAndRestoreVerified` |
| Complete mobile and accessibility review | Calculator/guide discovery, carousel controls, forms, keyboard/focus, responsive and assistive-technology checks | `mobileAndAccessibilityReviewSignedOff` |
| Confirm domain, TLS and rollback | Authoritative DNS baseline, provider validation, working TLS and recorded rollback procedure | `productionDomainAndRollbackConfirmed` |

All seven gates in `config/release-gates.json`, including the Search Console gate, remain false until supported by actual evidence. Existing automated/content/hosted checks support the review release; they do not replace these operational sign-offs.

## 3. Final production SEO and cutover — after gates pass

- [ ] Verify final URL responses, direct redirects, intentional 404/410 responses, canonical URLs, titles/descriptions, headings, internal links, original wording and media against the mapped source evidence.
- [ ] Confirm real crawler access through Search Console live inspection and verified crawler/server evidence; retain measured performance results without inventing scores.
- [ ] Reconfirm current domain-validation records and TLS with the hosting provider. Preserve authoritative nameservers, email records and the old hosting/DNS rollback values.
- [ ] Prepare and verify the release archive using the existing stable packaging workflow.
- [ ] Obtain final cutover approval for the concrete tested release; then enable production mode and perform the agreed DNS/hosting switch.
- [ ] Verify production HTTPS, redirects, robots, indexability, canonical URLs and sitemap immediately after cutover. The review host must remain noindex.
- [ ] Monitor Search Console traffic, indexing and crawl errors, enquiries and performance after launch; investigate regressions and retain rollback capability.

The exact hosting, DNS and validation procedures remain in [SEO_LAUNCH_ACTIONS.md](SEO_LAUNCH_ACTIONS.md). Existing version-specific audit results there are historical evidence, not a claim that all production gates now pass.

## Documentation updates

- [ ] After evidence-backed decisions, update the relevant URL mapping, routing configuration, validation reports, launch documentation and any affected FIT files identified in the project.
- [ ] Keep each action's status, evidence, limitations and resulting commit recorded. Do not mark blocked work complete.

This plan documents outstanding work. It does not modify page content, styling, routing rules, release gates, DNS or the hosted release.
