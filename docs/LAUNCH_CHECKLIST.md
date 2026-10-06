# SDS domain cutover checklist

The review site is prepared independently of the old production domain. Do not switch SDS DNS until all `config/release-gates.json` entries are true and `node scripts/check-release.mjs` succeeds.

- Compare the exact public URL/metadata/content report with Search Console, analytics, ad destination and backlink exports. Capture any missing legacy URLs and confirm redirects without redirecting unrelated pages to the homepage.
- Confirm original Reform eligibility/branching, all seven forms, evidence quarantine/size policy, authorised staff roles, notifications/CRM and operational follow-up. Test every distinct journey with approved synthetic destinations.
- Verify production analytics, consent, GTM events, WhatConverts call numbers, Search Console verification, SRA/HLPA and ReviewSolicitors integrations on the final origin.
- Sign off desktop/mobile templates, menus, keyboard focus, screen-reader labels/errors, uploader, legal pages, representative news/case study/profile/location/provider content and performance.
- Export and restore-rehearse private D1/R2 state, and retain the old site/hosting snapshot. Record exact current website DNS values/TTL and email DNS privately.
- Connect `www.sds-solicitors.com` to the verified selected host and configure root-to-www/HTTP-to-HTTPS redirects. Obtain actual DNS records from that host; preserve MX, SPF, DKIM and DMARC. Change no records based on example IPs.
- Set production release mode only after gates pass. Check robots/indexability, original canonical domain/sitemap, response codes, assets and every form. Review must remain noindex.
- Submit the production sitemap in the existing Search Console property. The primary domain remains the same; a Change of Address request is not part of this hosting replacement.
- Monitor enquiries, follow-up, conversions, errors, crawl/index coverage and traffic after cutover. Compare with pre-launch baselines; act on specific failures and keep the rollback owner available.
