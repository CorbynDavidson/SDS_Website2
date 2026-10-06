# Editing and Git-backed publishing

Migrated pages at `?edit=1` now use the owner-authenticated D1 draft editor. `/editor` lists migrated routes. The owner can edit marked paragraphs/headings, save a private draft and download a structured change request. `/submissions` links to this editor and includes all new and earlier enquiries.

Saving a draft does **not** publish it or update GitHub. Original wording is frozen for this migration. The old browser-local draft helper is removed from migrated pages; unchanged new-design routes outside the captured originals retain their earlier behaviour.

`npm run publish:patch -- /path/to/sds-page-change.json` validates a downloaded request against the current built page hash and matching content elements. It rejects wording changes while the migration is frozen. No arbitrary draft scripts, form controls, links or markup are imported. To approve new wording after migration, make an explicitly reviewed source/policy change and update the immutable baseline policy with evidence; do not silently bypass copy validation.

Design changes belong in the corresponding Git templates/styles/adapter. Generated migrated fragments are under `src/content/current-design/pages/`. Run `npm run check`, review the changes and commit implementation plus regenerated page files/index/reports. Publish the exact validated commit through Sites. GitHub CI validates pushes but does not automatically publish Sites.

The captured old-site sources remain in `migration/source-pages/`, `src/content/sds/` and `src/seo/sds/`. Keep them immutable for this release. A fresh source capture needs a deliberate freeze/import/review before cutover and must never capture the replacement as the original baseline.
