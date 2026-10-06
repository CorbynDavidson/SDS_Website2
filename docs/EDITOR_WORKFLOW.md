# Editing and Git-backed publishing

The restored version-41 website retains its earlier browser draft helper. Its saved drafts are browser-local and do not publish to GitHub or the public site. Do not describe it as a connected staff CMS.

To change the approved current design, edit the corresponding `src/` template/style or builder, run `npm run check`, commit the source to GitHub and publish the same validated source through Sites. Keep the layout and original design baseline intact unless the user specifically approves a design change.

The retained `migration/exact-sds-content` branch implements authenticated D1 drafts and structured change-request downloads. That candidate editor/backend is not currently active. Its copy-parity policy rejects wording changes; it must be integrated with the approved design before staff use or production publication.

The original-source capture workflow imports and commits content, SEO, media and reports. It does not publish an edited page or replace the active design. Freeze the old site's source before cutover; never capture the replacement as an original baseline.
