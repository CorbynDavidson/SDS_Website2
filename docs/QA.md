# Migration verification

These results describe the retained migration candidate (versions 42–45). The user rejected its visual layout and the review site was restored to version 41. Do not attribute the candidate's exact-content coverage or new form handlers to that restored deployment.

`npm run check:migration` builds the retained candidate, runs independent whole-document raw-source parity checks and runs Node tests against the real additive SQL schema. The source baseline is compressed anonymous HTML, not text manufactured by the replacement builder.

## Current approved-design content release

Normal `npm run check` validates all 296 captured routes against immutable original HTML. It independently compares original SEO and exact paragraph, heading, list, FAQ and form-label blocks; verifies the complete visible-copy token inventory; confirms approved styles/fonts/shared navigation/footer and homepage carousels; checks original media hashes/types and internal links; verifies owner access, review noindex, production blocking and unknown-route 404s. Generated page fragments must match served main content byte-for-byte.

Thirteen backend tests cover seven original schemas, persistence, invalid submissions, CSRF/honeypot protection, durable rate limits, duplicate requests, owner-only access, legacy data, escaping, CSV safety, drafts/stale hashes, private evidence and signed JWT verification. They run against the actual additive local SQL schema.

The selected release is documented in [CONTENT_MIGRATION.md](CONTENT_MIGRATION.md). Original missing assets and links remain explicit in the reports. Checks do not claim whole-document equality with the old CMS layout or completed browser/mobile/accessibility/performance sign-off.

Original media are retained byte-for-byte and packaged as fallback static files. Hashed source-media URLs pass through the Worker with correct MIME types and use checksum-addressed R2 copies when present. No Lighthouse/Core Web Vitals score is claimed without measuring the final deployment.

## Historical candidate browser observations (6 October 2026)

The desktop homepage rendered with original copy, new logo/theme, all captured content and functioning external SRA/reviews embeds. Browser inspection identified legacy form click interference and border/label styling; source fixes were applied. A final browser reload/recheck was blocked by automatic approval review because the review service was at capacity. The resulting form handler and CSS corrections still require a browser recheck; all 13 backend tests and full copy/metadata checks pass. No completed mobile/device audit is claimed.

## Historical candidate live handler verification

The review deployment accepted synthetic enquiries for all seven schemas (HTTP 201), and the new D1 table recorded them. An initial homepage test record was also verified directly. Anonymous and forged owner-header calls to the editor API returned 401. Synthetic records are clearly labelled and use reserved `example.invalid` addresses where the original schema has an email field. No email/CRM notification was sent. The real owner browser flow and final UI recheck remain outstanding.

## Historical candidate hosted asset verification

All 269 responses matched the expected byte size and SHA-256. The strict report records 158 content-type failures on the host's direct static delivery, including WebP images and fonts. The `_headers` candidate correction has not been verified as effective on Sites. Keep `allVerified: false`; resolve the actual host delivery policy before republishing the candidate. The design restoration preserves the earlier embedded-asset delivery.
