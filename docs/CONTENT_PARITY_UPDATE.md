# Mapped SDS wording in the existing website format

Owner-authorised update, 6 October 2026. The supplied `SDS_URL_Migration_Map_410_plan.xlsx` is the mapping authority; its SHA-256 and all 324 retained/captured URL pairs are recorded in `config/content-url-map.json`. The original workbook is unchanged. Its historic status observations and provisional retirements are not treated as fresh live HTTP results.

## Content coverage

All 324 mapped source routes, including all 248 current SDS sitemap rows, passed the independent original-content and SEO audit against immutable 6 October captures. The report records each corresponding destination, source hash, generated content file and section heading/hash/block count in `docs/migration/content-url-map-validation.json`. Full original wording remains inspectable in the source captures and corresponding generated page files; the report does not duplicate all paragraphs.

The preceding implementation already retained the calculator's detailed introduction, damages explanation, percentage bands, £5,150 worked example, claim-value factors, limitations and FAQs. They were not missing merely because their presentation differed. This release moves five complete guide sections into a manual rotator without summarising them. All text exists in the initial HTML; without JavaScript every section is visible. “Read full guide” expands the same content in place. The form, opening content, FAQs, benefits and other supporting sections stay intact. The homepage's existing rotator gains a brief linked introduction to the guide.

The old adapter excluded entire sidebar regions, including substantive specialist attribution. One captured specialist block per matching source card is now retained in the main content on 165 route instances. Names, qualifications, job titles, contact details and images are original; no new author or solicitor review claim is invented. Shared navigation, repeated enquiry widgets and CMS modals remain subject to the previously documented layout/form exceptions. Dedicated captured solicitor profile pages remain available.

## Formatting and controls

Existing brand styles, source heading wording, logo, navigation, footer, trust bar, enquiry fields and established mobile spacing remain. New CSS is scoped to the guide and restored specialist cards. The guide uses the existing page width, rounded panel, light background and brand colours. Controls sit outside the text; panel height follows the text. Labelled topic buttons, previous/next, keyboard navigation, swipe and print/full-guide display are supported. It never advances automatically or fetches text after a click. The short homepage introduction uses the existing carousel markup and styles.

## Verification and boundaries

The independent capture comparison verified 324 source-content routes, 324 SEO titles/heads, 21,752 original copy blocks, 71 source media files and 160 internal links. Workbook verification covered all 324 mappings and their production targets. Production SEO and review-readiness checks passed across all 325 public templates; all 23 provisional SDS-only 410 paths retained their existing policy. All 33 JavaScript tests and two Python tests passed, including full guide availability without JavaScript and manual/keyboard/expanded controls. Source whitespace checks passed.

Public review pages retain `noindex, nofollow`, current-origin review links and existing owner-only editing. SDS production URL/canonical/sitemap strategy, DNS, environment variables and existing SDS production website are unchanged. No live enquiries were sent.

This is a compiled-response/captured-source audit, not a fresh crawl of every original URL, a ranking guarantee, or legal review of compensation examples. Existing approved proofreading, Reviews and form/layout exceptions remain explicitly recorded. Automated checks confirm unchanged shared styles and structure; no new browser/physical-iPhone visual sign-off was possible because the required browser-control skill is unavailable. The remaining agency/cutover gates in `config/release-gates.json` remain open.

Reproduce with `npm ci --no-audit --no-fund` and `npm run check`. Generated content and reports must accompany the implementation in GitHub. Publication/version evidence is recorded separately in `docs/migration/content-parity-release.json` after deployment.
