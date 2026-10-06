# Original metadata on the approved design

Historical version-47 metadata-only release. The current full-content release is documented in [CONTENT_MIGRATION.md](CONTENT_MIGRATION.md). The unchanged-body counts below apply to the metadata-only build.

Authorised 6 October 2026: add the metadata from the previous migration branch while keeping the restored design intact, and add missing pages in that design.

## What is now built

- All **296 captured routes** receive their original title, SEO meta attributes, canonical/alternate links and JSON-LD strings. The immutable original HTML is the comparison baseline; missing original fields stay missing.
- The existing **283 route bodies, CSS, executable scripts, fonts, icons and display settings are unchanged**. Source headings are not substituted into existing pages.
- The missing **13 routes** are added: **nine distinct paths and four listing pagination variants**. Their original article wording is fitted into the current header/footer, service hero, rounded cards and responsive typography. Native disclosure controls replace the original Bootstrap accordion behaviour.
- All **248 original sitemap URLs** are included in the review sitemap, alongside the current design's additional URLs. Original production canonicals remain `https://www.sds-solicitors.com`.
- Original images used in added articles are served through checksum-addressed Worker routes with verified bytes and image content types. The original social-sharing image is also available.
- Review noindex and the production-release block remain active. This is a review deployment, not the SDS domain cutover.

## Missing pages added

| Path | Content |
|---|---|
| `/about-us/case-studies/topic/359/housing-disrepair/` | Original case-study listing and captured pages 1/2 |
| `/about-us/news/topic/358/housing-disrepair/` | Original housing news listing and captured pages 1/2 |
| `/about-us/news/topic/78/about-sds/` | Original SDS news listing |
| `/complaints/www.legalombudsman.org.uk` | Original captured complaints alias |
| `/complaints/www.ombudsman-services.org` | Original captured complaints alias |
| `/complaints/www.small-claims-mediation.co.uk` | Original captured complaints alias |
| `/flooding-water-damage-claims/` | Original water-damage article |
| `/housing-disrepair/leaks-plumbing-drainage-claims/` | Original leaks/plumbing article |
| `/privacy-policy/` | Original privacy policy |

The complaints aliases responded 200 on the original site and keep that behaviour and original canonical metadata. Their malformed external links are recorded as original-source issues in the handover. Corrected phone/email URI schemes and enquiry anchors on the added pages retain their visible wording.

## Copying policy

SEO comes from `src/seo/sds/pages/`, verified against compressed raw source in `migration/source-pages/`. The exact previous-branch commit is `85624a3bd76c8fde9290c1b3425971a8e68d622f`; `config/metadata-source-provenance.json` records the Git blob hashes independently retrieved from that branch.

The current charset, viewport, HTTP-equivalent fields, format detection, generator, theme colour, tile settings, colour scheme, icons and manifest remain current-design settings. The former Concrete CMS assets, styling, tracking code and layout are not imported. Original malformed smart-quoted robots names are retained and reported rather than silently rewritten.

For added pages, the original article is the central primary column or the service banner content and content sections. Shared navigation, sidebar material, legacy forms and the old global footer are replaced by the approved current-design shell. Article wording and ordering are independently checked against that selected immutable raw content. Added enquiry buttons link to the existing current-design callback form. This does not reintroduce the rejected migration candidate's seven-form backend or claim complete whole-document copy parity.

Existing pages retain their earlier rewritten/generic wording. Fitting the remaining original content into those pages is still required before a full exact-copy replacement. All production launch gates remain pending.

## Developer verification

```sh
npm ci --ignore-scripts
npm run check
```

The build regenerates corresponding added-page HTML and reports. Validation independently compares served metadata against raw captures, checks all existing page bodies and display fragments byte-for-byte, verifies added article wording, pagination/link destinations, media hashes/types, the original sitemap URLs, HEAD behaviour, unknown-route 404s, review noindex, the existing cross-origin form guard and the production block.

Reports: `docs/migration/metadata-to-current-design.json`, `docs/migration/metadata-validation.json`, `docs/migration/current-design-sitemap.xml` and `docs/design-build.json`. GitHub CI runs the same checks and retains these artifacts. GitHub source updates and Sites publication are both part of this authorised change; future GitHub pushes alone do not publish Sites.

The previous final browser review was blocked when the automatic approval review service was at capacity. No completed browser/device audit is claimed by these source and served-response checks.

## Publication evidence

Published successfully as **Site version 47** at https://housingconditionclaims.org on 6 October 2026. Native source commit: `ce570fd52c071791424a506202d7b622e788d4d8`. GitHub implementation commit: [`84bcd381a984f90632bffdaa297a4753cb7b21f9`](https://github.com/CorbynDavidson/SDS_Website2/commit/84bcd381a984f90632bffdaa297a4753cb7b21f9).

[GitHub validation run 37399509344](https://github.com/CorbynDavidson/SDS_Website2/actions/runs/37399509344) completed successfully. All 32 implementation and generated files were compared by Git blob hash between the published source and GitHub and matched. The confirmed version, deployment, archive hash and validation counts are retained in `docs/migration/deployment.json`.
