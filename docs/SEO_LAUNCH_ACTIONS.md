# SEO migration actions 1–4

This work prepares the approved new design for the existing primary domain. The current SDS DNS and production hosting have not been switched. The new host remains in review mode, with production canonicals and a production sitemap.

## 1. Historic URLs

The public Wayback CDX inventory contains 940 successful HTML captures, spanning October 2007 to June 2026. Filtering unrelated hosts, system/feed routes and application queries produced 812 eligible public URL paths. Six additional destinations from measured redirects are checked separately. Current original-site responses are measured separately; an archive capture alone is not evidence that a redirect is appropriate today.

Individually measured current redirects and retired 410 responses are stored in `config/historic-url-routing.json`. These supplement the original routing rules. Measured redirects to already retired 410 destinations retain that status; they do not recover retired content. Identical historic contact aliases consolidate to the existing `/contact-us/` canonical after comparison of the original visible text. Missing live news/case-study filter pages are captured separately in `migration/supplemental-source-manifest.json`, imported into `src/content/supplemental/` and `src/seo/supplemental/`, and rendered by the existing design. The original capture and its pinned source hashes remain unchanged. Filter pages retain their original canonicals and are excluded from the indexable sitemap where appropriate.

Search Console, analytics, backlink exports, old redirect configuration and historical request URLs still require account evidence. This public archive is not a complete 25-year backlink inventory. Import CSV exports locally, without committing account data:

```sh
python scripts/audit-historical-urls.py \
  --private-export gsc=.data/seo/gsc.csv \
  --private-export analytics=.data/seo/landing-pages.csv \
  --private-export backlinks=.data/seo/backlinks.csv \
  --output .data/seo/private-url-inventory.json --live
node scripts/reconcile-historical-urls.mjs \
  --input .data/seo/private-url-inventory.json \
  --output .data/seo/private-route-reconciliation.json
```

The CSV importer accepts common Page, URL, Landing page, Target URL and Request URL columns. Credentials and sensitive query values are discarded; private reconciliation outputs must remain under ignored `.data/`. Select public URL rules for review separately. Do not sign off `searchConsoleInventoryReviewed` until the account exports have been reconciled. The final public reconciliation is recorded in `docs/migration/historical-route-reconciliation.json`; URLs already missing on the current site and broken/private legacy destinations are kept as explicit review cases rather than given invented replacement content.

## 2. Public crawl and assets

The initial default Python client received Cloudflare 1010. Identified browser-profile public requests loaded the site successfully. This does not prove access by a verified Googlebot IP, and no WAF rules were disabled.

The asset audit found that static-first hosting served some original images/fonts with generic MIME types, despite correct bytes. Original public asset URLs now execute the Worker and fetch exact bytes from internal packaged storage paths. MIME types, cache headers, ETags and existing URLs are retained. The same correction keeps robots and sitemap responses in the host-aware Worker rather than the static-first layer. `public/sitemap.xml` and the repository sitemap remain available in Git.

Repeat checks against the deployed review release:

```sh
node scripts/create-hosted-audit-expectations.mjs https://housingconditionclaims.org
python scripts/audit-hosted-pages.py
python scripts/verify-hosted-assets.py --origin https://housingconditionclaims.org
```

These checks use ordinary, identified browser-profile HTTP headers, without authentication, spoofed Googlebot identity or access-control changes. Search Console live URL inspection and verified crawler/WAF logs remain required for actual Googlebot confirmation.

## 3. Domain and indexation

Both `sds-solicitors.com` and `www.sds-solicitors.com` are registered with the new host, pending validation/TLS. Exact provider responses are in `docs/migration/production-domain-plan.json`; current DNS/HTTPS evidence is in `docs/migration/primary-domain-baseline.json`.

SDS currently uses **ns0.ukfast.net / ns1.ukfast.net**. DNS records must be entered in that authoritative zone. Namecheap Advanced DNS changes will not take effect while the domain uses these external nameservers. Keep the existing nameservers and email records for this migration.

Enter the verification TXT records first; they do not move website traffic. Verify domain/TLS status with the host before the final A/CNAME switch. The DNS labels below are relative to `sds-solicitors.com`:

| Type | Host | Value | Stage |
|---|---|---|---|
| TXT | `_openai-site-verification` | `openai-site-verification=g3Ls0mw4dMok4e4DjWMrKdXCpC7gK-8gd2doCf10eos` | Validation |
| TXT | `_cf-custom-hostname` | `c4a56770-8f21-44c7-982c-214d167abae3` | Validation |
| TXT | `_openai-site-verification.www` | `openai-site-verification=63LryPCN5_acBYJYJP8DQk9DVCe-gcF6ju8EuKHhg3c` | Validation |
| TXT | `_cf-custom-hostname.www` | `d698ef04-9aa1-4dc7-afd0-fe9d507c6923` | Validation |
| A | `@` | `162.159.143.30` | Signed-off cutover |
| A | `@` | `172.66.3.26` | Signed-off cutover |
| CNAME | `www` | `custom-domains.chatgpt.site.` | Signed-off cutover |

The current apex and www A records resolve to `82.145.55.47`, with approximately 60-second TTLs. Save the authoritative zone before edits. At cutover, replace the website A records rather than leaving the old and new servers mixed. A CNAME cannot coexist with an A/AAAA record at `www`. Keep the current Outlook MX, SPF, DKIM, DMARC and unrelated records. Re-read provider validation records if a domain is removed/re-created; do not reuse expired ownership tokens.

Complete `config/release-gates.json` with real operational evidence before changing only the hosted `RELEASE_MODE` to `production` and deploying the tested saved release. Preserve the database, upload storage, owner authentication, secrets and public audience. Review hosts remain noindex; only HTTPS/www SDS public pages become indexable. Apex/HTTP/path changes use permanent redirects. Confirm new TLS is active, switch DNS, then run:

```sh
python scripts/audit-production-domain.py
node scripts/create-hosted-audit-expectations.mjs https://www.sds-solicitors.com --production
python scripts/audit-hosted-pages.py --output build/production-pages-verification.json
```

The expectations generator uses review mode by default; `--production` verifies the primary host against production responses. Recheck the production sitemap, canonicals, robots, old URLs and actual Googlebot access. Keep the old hosting and the recorded old DNS values available during monitoring. Because the primary domain stays the same, this is a hosting/design replacement rather than a domain change.

## 4. Browser and performance QA

The managed-browser review uses the actual compiled site, plus development-only same-origin frames at 320, 390, 760 and 1280 pixels. These frames are not production routes. This is responsive browser QA, not a physical iPhone/Android or screen-reader certification.

Verified narrow-screen issues were corrected: location headings expanded the grid beyond the viewport, and inner pages hid Explore without a replacement mobile menu. The fixes constrain narrow grids, wrap long headings, keep the homepage carousel controls and imported media within very narrow viewports, and reuse the existing Explore menu. Desktop layout, colours, original page copy, form schemas and approved brand/service styles remain intact. The questionnaire still has its title/intro above its original form.

Google PageSpeed Insights returned HTTP 429 because the available API quota was exhausted. No Lighthouse score or field Core Web Vitals result is claimed. Public HTTP timings are diagnostic and include the audit environment; they are not throttled-mobile LCP/INP/CLS measurements. Run Lighthouse/PageSpeed and Search Console Core Web Vitals with the production property after cutover and retain the real results. Mobile/browser evidence alone does not sign off the broader accessibility gate.

The remaining private-account, verified-Googlebot, domain/TLS, field-performance and operational checks are deliberate pending launch requirements. Their release gates have not been marked complete without evidence.

## Verified Sites packaging

The managed static staging layer may copy public files back into `dist/client` after a build. Publish the stable filtered snapshot, rather than archiving that mutable directory. Raw captured asset URLs, `robots.txt` and `sitemap.xml` must execute the host-aware Worker; otherwise static-first delivery bypasses the MIME and review-indexation policy.

After checks and the native source push, run these commands from the project root:

```sh
node scripts/finalize-static-assets.mjs
python scripts/package-verified-release.py /absolute/path/sds-verified-release.tar
```

The finalizer copies a filtered snapshot into ignored `build/deployment-client`, checks every captured asset against its byte length and SHA-256, and excludes raw public asset paths and static crawl controls. The packager creates an uncompressed USTAR archive containing the compiled Worker, hosting configuration and this exact snapshot; it verifies every archived byte and writes `build/verified-release-package.json`. Save the version with the exact pushed source SHA and this verified archive, then deploy the saved version. Do not substitute an archive of mutable `dist/client`.

The public reconciliation checks 818 paths: 73 preserved page, 342 preserved redirect, 83 preserved redirect to gone, 173 historic url already missing on original, 124 preserved gone, 23 historic url needs review. No measured redirect to an available retained page is left unimplemented. The 23 review cases include broken original redirects and old private membership routes; they are not evidence of retained live public content. The account inventory and potential recovery of older removed content remain pending.

Responsive evidence is in `docs/migration/browser-qa-2026-10-06.json`, including observed initial defects, final 320px homepage checks, representative page layouts, resource-menu checks and empty-enquiry validation/focus. The final narrow homepage has no horizontal overflow; the saved desktop review screenshot is `docs/migration/browser-review-desktop-2026-10-06.jpg`. No real enquiry was created during browser QA.

Version 65 is published on the review host with `RELEASE_MODE=review` and environment revision 2. Initial live probes confirm the review robots deny indexing, the XML sitemap serves production URLs, a recovered News route returns 200, and original WebP/WOFF2 assets return their proper MIME types. The full hosted page/asset audits run separately and their results are not inferred from these probes. Deployment provenance is in `docs/migration/seo-actions-release.json`.
