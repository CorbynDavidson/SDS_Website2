# Editing and Git-backed publishing

## Current editor behaviour (6 October 2026)

Open any public page with `?edit=1`, or use `/editor` for the page list. The secure editor runs on all 325 built public templates, including FAQ and carousel text. Automatic carousel cycling pauses in edit mode; manual slide buttons still work.

Signed-out visitors see **Sign in to edit**. Use the existing website owner's ChatGPT account. Other users receive an owner-only notice. Sharing the URL with the agency does not grant editing access; permissions have not been expanded. Connection failures display an error rather than leaving the page silently unchanged.

Edit outlined wording directly or choose **All wording** to search and edit text, including words inside links and other slides. Actual enquiry forms and their controls are excluded. Saving a private draft reloads it when the owner reopens that page. It does not change public wording, GitHub or metadata. Outdated drafts remain available but are not automatically applied.

**Download change request** exports proposed wording for developer review; it does not publish. The command below remains a validator for the earlier content-element export, not a CMS publish button for all-wording drafts. Agree the ongoing publication workflow with the agency.

Two owner-approved homepage proofreading corrections are now recorded separately in `config/review-readiness.json`: `commited` → `committed`, and `comprises Some` → `comprises some`. Immutable captures are unchanged, and the content validator permits only those differences alongside the previously approved callback-form replacement. Further copy changes require explicit source/policy review and validation.

Migrated pages at `?edit=1` now use the owner-authenticated D1 draft editor. `/editor` lists migrated routes. The owner can edit marked paragraphs/headings, save a private draft and download a structured change request. `/submissions` links to this editor and includes all new and earlier enquiries.

Saving a draft does **not** publish it or update GitHub. Original wording is frozen for this migration. The old browser-local draft helper is removed from migrated pages; unchanged new-design routes outside the captured originals retain their earlier behaviour.

`npm run publish:patch -- /path/to/sds-page-change.json` validates a downloaded request against the current built page hash and matching content elements. It rejects wording changes while the migration is frozen. No arbitrary draft scripts, form controls, links or markup are imported. To approve new wording after migration, make an explicitly reviewed source/policy change and update the immutable baseline policy with evidence; do not silently bypass copy validation.

Design changes belong in the corresponding Git templates/styles/adapter. Generated migrated fragments are under `src/content/current-design/pages/`. Run `npm run check`, review the changes and commit implementation plus regenerated page files/index/reports. Publish the exact validated commit through Sites. GitHub CI validates pushes but does not automatically publish Sites.

The captured old-site sources remain in `migration/source-pages/`, `src/content/sds/` and `src/seo/sds/`. Keep them immutable for this release. A fresh source capture needs a deliberate freeze/import/review before cutover and must never capture the replacement as the original baseline.
