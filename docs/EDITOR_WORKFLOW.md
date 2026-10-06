# Editing and Git-backed publishing

`https://housingconditionclaims.org/?edit=1` and `/editor` require the allowlisted owner's sign-in. Page drafts are saved durably in D1, attributed to that account and protected against stale base hashes. The editor can download a structured JSON change request. Drafts do not modify the public website or GitHub until reviewed and applied in the repository.

Original wording is frozen for this migration. `npm run publish:patch -- /path/to/sds-page-change.json` verifies the original page hash and matching content structure and rejects wording changes. It never imports arbitrary draft scripts, forms or links. A future approved copy change needs an explicit change to the copy policy and parity baselines/approved exceptions; do not silently weaken the migration checks.

For current production preparation, edit the corresponding Git source (`public/sds-theme.css`, runtime scripts, configuration, or imported page presentation), run `npm run check`, review the diff and commit. Publish the exact validated commit through the documented host workflow. The workflow is reproducible and auditable; the browser draft surface is not advertised as a connected staff CMS.

The capture workflow refreshes raw published source and imports it automatically, then commits content, SEO, media and reports. Trigger intentionally by changing `migration/capture-request.json` or running its manual workflow. Freeze the old-site source immediately before cutover; do not run a fresh source capture against the replacement and treat it as the original baseline.
