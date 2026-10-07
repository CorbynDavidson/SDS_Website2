# SDS production readiness plan

Updated: 7 October 2026. Production destination: `https://www.sds-solicitors.com`. Review site: `https://housingconditionclaims.org`.

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

## 4. Future action: Step 2 Intake Workflow — proposed, not implemented

Added: 7 October 2026. Status: future development proposal, subject to SDS approval of legal eligibility, routing, messaging and data handling. This is additional intake automation work; it does not mark the existing operational release gates complete.

### 1. Trigger via SMS & Email Link

As soon as Step 1 (contact details) is successfully submitted, the customer receives an SMS and email containing a unique secure link to complete Step 2.

Proposed message:

> Hi [Name], to fast-track your housing claim, upload photos of the damage and your tenancy agreement here: [Secure Link]

### 2. Step 2 Form Submission (Document & Image Capture)

- **Housing Status:** Social/Council tenant vs. Private tenant. Capture Council and Housing Association separately so the routing rules can distinguish them.
- **Notice Given:** Has the landlord been formally notified in writing, and for how long? Capture the report date and available supporting evidence.
- **Photo/Video Uploads:** Damp, mould, leaks, structural defects, boiler/heating issues.
- **Document Uploads:** Tenancy agreement, repair request emails/letters, council environmental health reports.

### 3. AI Vision & Document Screening (The Automated Triage)

**Image Verification (Computer Vision):** Proposed screening of uploaded photos for apparent defects and severity, including suspected black mould vs. surface dirt, structural cracks and ceiling leaks. Outputs are provisional observations with confidence and supporting image references; they require validation and must not be presented as confirmed diagnoses, structural assessments or proof of legal eligibility. Define how video submissions will be reviewed.

**Document OCR & Keyword Extraction:** Extract correspondence text, landlord identity, report dates and evidence of written notice. The requested concept includes checking whether notice was served more than 21 days ago. Record this as a proposed threshold requiring SDS legal validation, rather than an established universal legal threshold. OCR findings should retain document/page references and distinguish a document's date from evidence of service or receipt.

**Claim Scoring & Routing Rules — requested proposal:**

| Priority | Proposed criteria | Proposed action |
|---|---|---|
| High Priority (Green) | Council/Housing Association tenant + written notice served + severe damp/leak identified by AI | Immediate priority call within an agreed SLA. |
| Medium Priority (Amber) | Housing Association tenant + photo uploaded + notice missing | Automated follow-up requesting proof of a report to the landlord. |
| Disqualified (Red) | Private landlord, if outside SDS's target model, or zero notice given | Proposed automated decline/signpost message to reduce fee-earner handling time, subject to the review requirements below. |

### Decisions and implementation actions

- [ ] SDS to validate the notice requirements and proposed 21-day threshold for the relevant claim types and jurisdictions before configuring eligibility rules.
- [ ] SDS to approve the routing matrix, including Council tenants with missing notice, unclear evidence, conflicting dates, low AI confidence, and urgent hazards.
- [ ] Distinguish missing proof from confirmed absence of notice, and outside SDS's service scope from a claim having no legal merit. Use follow-up/manual review for uncertain cases; require qualified human review before any substantive legal eligibility rejection. Do not launch a blanket automatic rejection solely for zero notice or an AI finding.
- [ ] Agree the priority-call SLA, operational owners, follow-up timings, approved message templates and escalation process.
- [ ] Select SMS/email providers and configure secure, expiring, revocable links tied to the correct Step 1 enquiry; prevent duplicate sends on submission retries and record delivery failures.
- [ ] Implement private upload storage, access controls, file limits, malware scanning/quarantine, retention/deletion rules and appropriate privacy information. Confirm approved AI/OCR providers and their handling of customer evidence; keep customer data, uploads, credentials and live links out of Git.
- [ ] Validate image/OCR accuracy on approved test evidence, including false positives/negatives and manual overrides. Keep evidence references, model/rule versions and routing reasons available to authorised reviewers.
- [ ] Test Step 1 to notification to Step 2 to triage to staff follow-up end to end, including expired links, upload failures and inaccessible evidence. Record completion, routing and SLA outcomes.

This section records the proposed future workflow only. SMS/email delivery, Step 2 uploads, AI screening and automated routing are not implemented or enabled by this documentation update.

## Documentation updates

- [ ] After evidence-backed decisions, update the relevant URL mapping, routing configuration, validation reports, launch documentation and any affected FIT files identified in the project.
- [ ] Keep each action's status, evidence, limitations and resulting commit recorded. Do not mark blocked work complete.

This plan documents outstanding work. It does not modify page content, styling, routing rules, release gates, DNS or the hosted release.
