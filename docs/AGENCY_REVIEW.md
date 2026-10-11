# SDS website: agency SEO and development review brief

Updated 11 October 2026. **Purpose: review the current GitHub/Cloudflare implementation, identify launch blockers and agree a safe SDS migration. This is not approval to launch.**

## 1. Objective and review baseline

Replace the existing SDS website while preserving its agreed URLs, organic visibility and enquiry journeys. Assess the housing-disrepair design, conversion journey, maintainability and operational readiness. Establish traffic and conversion baselines from SDS accounts; no ranking or enquiry improvement is assumed.

| Item | Current reference |
|---|---|
| Review website | https://housingconditionclaims.org/ |
| Cloudflare Worker review URL | https://sds-website2.corbyn-davidson.workers.dev/ |
| Repository | https://github.com/CorbynDavidson/SDS_Website2 |
| Pinned implementation baseline | [1994f6d0fdb08707c6921db8a824e6ade26cce42](https://github.com/CorbynDavidson/SDS_Website2/tree/1994f6d0fdb08707c6921db8a824e6ade26cce42) |
| Intended production origin | https://www.sds-solicitors.com/ |
| Owner editor | https://housingconditionclaims.org/?edit=1 |
| Owner submissions | https://housingconditionclaims.org/submissions |
| URL inventory | Supplied SDS URL migration workbook, including its 410 plan; reconcile its dated observations with current code and private account evidence |
| Deployment configuration | [wrangler.jsonc](../wrangler.jsonc) |
| Launch sign-offs | [release-gates.json](../config/release-gates.json) and [launch checklist](LAUNCH_CHECKLIST.md) |

GitHub is now the source for the Cloudflare deployment. The owner reports that the review domain runs on Cloudflare. This supersedes the old Sites version-76 deployment reference as the current review target. The implementation baseline above is pinned; record the actual Cloudflare deployment ID, source commit, environment and review date before reviewing the live site. Deployment of that exact commit has not been independently verified in this documentation update.

Cloudflare build/settings URLs for authorised account users:

- https://dash.cloudflare.com/6d4e6588768588102930fc80929d51d2/workers/services/view/sds-website2/production/builds
- https://dash.cloudflare.com/6d4e6588768588102930fc80929d51d2/workers/services/view/sds-website2/production/settings

The Cloudflare environment labelled **production** is the main Worker deployment, not evidence of SDS business launch or enabled search indexing. Committed configuration remains `RELEASE_MODE=review`; preview publishing and AI chatbot answers are disabled. The intended public production origin remains SDS. Confirm effective dashboard bindings, variables, secrets, Access policies and domain configuration rather than relying only on committed configuration.

## 2. Migration protections — owner requirement

Improve the website within the agreed migration structure. No URL-structure redesign is authorised as part of this review or routine optimisation.

Preserve:

- Existing page paths, slugs, slash/alias behaviour and the agreed old-to-new URL mapping.
- Redirect rules, canonical URLs, sitemap membership, production-origin configuration and structured-data URL references.
- Review noindex/nofollow controls and the planned production indexing transition.
- The provisional 23 production-only 410 decisions until individually reviewed and separately approved.

Report any proposed exception with affected URLs, Search Console/backlink evidence, expected impact, mapping changes and rollback implications. Obtain separate owner approval before implementing it. The 23 proposed retirements still need SEO sign-off; preserving the current plan does not constitute approving it.

Copy, headings, titles and descriptions can be proposed on existing pages, with SDS content approval and coordinated checks for related metadata/schema. Do not switch DNS, enable indexing, rebuild the platform, change migration settings or grant editor access during assessment. Recommend enforcement of protected migration files in future automated workflows; that future policy is not claimed to be implemented by this brief.

## 3. Current implementation and evidence

At the pinned implementation baseline:

- The GitHub source builds a Cloudflare Worker and packaged assets. `wrangler.jsonc` binds the review D1 database and uses Cloudflare Access authentication; main editor publishing is configured as enabled.
- The editor implements private draft storage, page wording overrides, GitHub branches/PRs and checks before merging. **Save draft does not publish.** See [editor workflow](EDITOR_WORKFLOW.md). Verify the live sign-in, draft, publish, failure/retry and post-deployment journeys.
- All 325 generated public pages were checked for the approved caption **Housing Disrepair Claim Specialists**, including 408 header/footer captions. The homepage's earlier wording override was removed in favour of the shared caption.
- Local `npm run check` passed: build, content/migration/SEO/review validation, 56 JavaScript tests and two Python tests. `npm run deploy:check` passed the Cloudflare deployment dry run.
- These checks support developer review. They do not establish live enquiry delivery, staff follow-up, real-device accessibility, live performance, production security, backup restoration or SDS-domain cutover readiness. GitHub/Cloudflare remote check results should be recorded separately.

Reproduce from the pinned revision with Node 24:

```sh
npm ci --ignore-scripts
npm run check
npm run deploy:check
```

Build outputs and generated reports can predate the current source until regenerated. Original captures and older version-specific browser evidence are historical references, not current hosted sign-off.

## 4. Required findings and launch evidence

Return one issue register with: affected URLs/templates, evidence, impact, proposed fix, priority, owner, estimated effort, acceptance test and whether it blocks launch.

| Review area | Required evidence | Recorded release gate |
|---|---|---|
| Original questionnaire rules | Approved eligibility branches, validation, completion and failure behaviour checked against original rules | `originalWizardRulesVerified` |
| Enquiry delivery and follow-up | Every distinct journey traced from a controlled submission through storage, notification/CRM receipt and responsible staff follow-up; retries do not duplicate leads | `leadFollowUpRoutingVerified` |
| Analytics and consent | Consent behaviour, analytics/GTM events, enquiry conversions, call tracking/WhatConverts and pre-launch baselines | `analyticsAndConsentVerified` |
| SEO migration | Reconciliation of SDS Search Console, analytics, backlinks, ad destinations and historic redirects/logs against the URL inventory, including all 23 provisional 410s | `searchConsoleInventoryReviewed` |
| Security, backup and restore | Authorised editor/submission access; unauthorised access blocked; private evidence access/bindings where enabled; documented recoverable D1/asset backups and tested restoration | `productionBackupAndRestoreVerified` plus security findings |
| Mobile, accessibility and performance | Representative iPhone/iPad/desktop journeys; forms, errors, keyboard focus, menus, trust bar, chat and carousels; measured load performance | `mobileAndAccessibilityReviewSignedOff` |
| Final domain and recovery | Effective DNS/TLS, host redirects, preserved email DNS, exact cutover steps, previous release/hosting recovery and tested rollback | `productionDomainAndRollbackConfirmed` |

All seven gate values are still `false` in the repository. Treat these as **unrecorded sign-offs**, not proof that recent Cloudflare work is absent. Reconcile completed work with evidence and named approvals; do not mark gates complete solely because automated checks pass.

**Priorities:** P0 blocks launch (for example failed enquiry delivery, unauthorised private access, material routing loss or incorrect indexing). P1 is resolved before launch unless explicitly accepted (material mobile/accessibility, tracking, content or performance defects). P2 is a follow-up improvement.

Confirm whether launch is recommended, list unresolved blockers and provide a staged implementation proposal. Explain any CMS/platform recommendation against the current setup, editing needs, ownership, security, lead handling, support and cost. Do not assume a WordPress rebuild is necessary.

## 5. Access and operational boundaries

SDS/agency account owners should provide Search Console for the original SDS property, analytics, backlinks and historic routing data; GTM/consent/call tracking access; original form rules; approved notification/CRM destinations; and DNS/hosting baselines. The review domain's Search Console data cannot establish historical SDS traffic or backlink value.

Use read-only/least-privilege access for assessment. Share confidential exports and credentials through an agreed secure channel, never the public repository. Editor/submissions links do not grant permissions. Agree synthetic test details and destinations before submitting; do not send real customer enquiries for testing.

SDS approves legal/service content and confirms operational ownership. The agency supplies evidence-backed SEO/development findings. The developer/domain owner verifies deployment, recovery and cutover. Record an owner and deadline for each blocker.

## 6. Cutover and future automation

After evidence-backed sign-off, follow [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) and [PRODUCTION_READINESS_PLAN.md](PRODUCTION_READINESS_PLAN.md). Preserve the review host's noindex controls; verify final SDS HTTPS, routing, robots/indexability, canonicals, sitemap, tracking and enquiry delivery at cutover. Monitor against pre-launch baselines and retain a named rollback owner.

The proposed n8n/Jira agent workflow is future work, not a launch prerequisite or an existing integration. Intended decisions are **Disapprove**, **Approve and backlog**, or **Approve and action**. Implementation approval applies only to the ticket's scope, with migration protections, GitHub checks and human legal/content review. Assess current publication controls independently of that proposal.

## Further reference

- [Developer handover](HANDOVER.md)
- [Editor/publication workflow](EDITOR_WORKFLOW.md)
- [Production readiness plan](PRODUCTION_READINESS_PLAN.md)
- [Production SEO implementation](PRODUCTION_SEO.md)
- [SEO launch actions](SEO_LAUNCH_ACTIONS.md)
- [Content parity evidence](CONTENT_PARITY_UPDATE.md)

For the superseded version-76 brief and historical evidence, use this file's Git history. This documentation update changes no website content, URLs, routing, indexing settings, release gates, secrets or DNS.
