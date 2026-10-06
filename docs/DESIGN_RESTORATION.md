# Design restoration

On 6 October 2026 the user rejected the layout introduced during the exact-content migration and requested the design from before migration. The approved visual baseline is saved **Site version 41**, source commit `f241782af256486d1523a2fb4c8d70a410d8e7a4`.

The review site was restored to that saved version. The migration candidate is retained on GitHub branch `migration/exact-sds-content`, with immutable original source, all 296 captured routes, original metadata, media, form handlers, additive migrations, tests and audit reports. Its layout is not approved for further publication.

Normal `main` builds must use the earlier `src/index.html`, `src/brand.css`, `src/service.css`, `scripts/build-worker.mjs` and `worker/index.template.js` design. Review protection may add response headers without altering these page bodies. The restored design's earlier content includes rewritten/generic routes; it does **not** constitute the completed exact-copy SDS migration.

The authorised metadata pass now copies original SEO onto all 296 captured routes through a head-only overlay. It also adds the 13 previously missing routes using the current-design shell and original article wording. Existing bodies, styling and interactive scripts are unchanged. See [METADATA_MIGRATION.md](METADATA_MIGRATION.md).

To continue the replacement, map the captured original wording and metadata into version 41's existing layouts. Preserve its header, colours, typography, rounded sections, carousels, cards and page templates. Do not substitute the old Concrete CMS layout or publish the rejected migration CSS. Re-run independent raw-source parity checks and obtain the outstanding browser/device sign-off before publication.

Earlier `enquiries`, new migration submissions, drafts and private R2 evidence remain in their existing stores. Code rollback must not drop tables or erase submissions. The restored earlier submissions screen reads the legacy `enquiries` table; the migration candidate's new records are retained separately.

The production SDS domain and email DNS have not changed. All production release gates remain pending.

## Follow-up restoration

The original content and metadata are now integrated across all 296 captured routes, with the later requested layout adjustments through version 53 retained. The version-54 global grey-panel restyling was rejected and the version-53 layout stylesheet restored in version 55.

That first rollback still displayed incorrectly: the production SEO pass had changed the `brand.css` and `service.css` resource links to absolute primary-domain URLs. On the review domain they loaded from the old SDS hosting instead of the new build, leaving the base cream/coral styles and broken header/form sizing visible. The correction keeps local resources root-relative while preserving production canonicals, sharing metadata and navigation links. Both served stylesheet hashes must match the saved version-53 files on review and production hosts. Content, SEO, forms, private data and the primary-domain DNS are retained.
