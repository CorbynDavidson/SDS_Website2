# Migration verification

These results describe the retained migration candidate (versions 42–45). The user rejected its visual layout and the review site was restored to version 41. Do not attribute the candidate's exact-content coverage or new form handlers to that restored deployment.

`npm run check` builds the Worker, runs independent raw-source parity checks and runs Node tests against the real additive SQL schema. The source baseline is compressed anonymous HTML, not text manufactured by the replacement builder.

The generated coverage report checks every captured route against its original wording, headings, title, meta attributes, canonical/alternate/icon links and structured-data strings. It verifies source/resource hashes and bytes, all 248 original sitemap URLs, mapped internal links, genuine unknown-route 404s, review noindex and disabled tracking, production metadata and replaced form actions. Existing source 404 assets remain visible in the report instead of being counted as successful captures.

Thirteen backend tests verify complete original form schemas, invalid data, CSRF, honeypot, durable limits, idempotency/restarts, owner-only access, legacy records, HTML escaping, CSV formula protection, durable drafts/stale hashes, evidence uploads/private downloads, signed JWT verification, checksum-constrained media import and release-mode behaviour.

Browser review is carried out on the internal supervised development preview, using synthetic data only. Record representative templates and observed issues here after verification. Full mobile/device accessibility, original CMS conditional branching, production tracking/consent and lead routing remain explicit launch gates.

Performance: the build measures compressed Worker size and media bytes. Original media are bundled in `dist/client` and use static delivery with release hash ETags; R2 is an optional checksum-addressed fallback and the private evidence store. `scripts/verify-hosted-assets.py` compares every hosted asset with its expected byte size and SHA-256. Original media are retained to avoid changing content. High-resolution original JPEGs can be optimised with approved visual-equivalence checks after the immutable originals are preserved. No Lighthouse/Core Web Vitals score is claimed without measuring the actual deployment.

## Browser observations (6 October 2026)

The desktop homepage rendered with original copy, new logo/theme, all captured content and functioning external SRA/reviews embeds. Browser inspection identified legacy form click interference and border/label styling; source fixes were applied. A final browser reload/recheck was blocked by automatic approval review because the review service was at capacity. The resulting form handler and CSS corrections still require a browser recheck; all 13 backend tests and full copy/metadata checks pass. No completed mobile/device audit is claimed.

## Live handler verification

The review deployment accepted synthetic enquiries for all seven schemas (HTTP 201), and the new D1 table recorded them. An initial homepage test record was also verified directly. Anonymous and forged owner-header calls to the editor API returned 401. Synthetic records are clearly labelled and use reserved `example.invalid` addresses where the original schema has an email field. No email/CRM notification was sent. The real owner browser flow and final UI recheck remain outstanding.

## Hosted asset verification

All 269 responses matched the expected byte size and SHA-256. The strict report records 158 content-type failures on the host's direct static delivery, including WebP images and fonts. The `_headers` candidate correction has not been verified as effective on Sites. Keep `allVerified: false`; resolve the actual host delivery policy before republishing the candidate. The design restoration preserves the earlier embedded-asset delivery.
