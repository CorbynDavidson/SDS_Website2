# Cloudflare D1/R2 intake setup — account work pending

On 9 October 2026, the owner selected Cloudflare D1 for enquiry answers and private R2 for uploads on the `sds-website2` Worker, with **automatic location and no jurisdiction restriction**, after being told that Cloudflare does not offer a UK-only jurisdiction for either product. This changes the earlier UK-only storage plan for this deployment. Cloudflare chooses the location; do not describe the result as UK-resident or as restricted to any country or region. SDS should review the provider terms and data-flow implications before sending real client information.

The public Sites project at `housingconditionclaims.org` already has a different D1/R2 pair. Its records and evidence do not automatically appear in the separate `sds-website2.corbyn-davidson.workers.dev` account. The AWS London implementation in draft PR #1 is not deployed or connected.

## Account resources

The repository already has seven-schema form handlers, D1 migrations in `drizzle/`, private evidence handling, a rate-limit secret, an owner-only submissions view, and `scripts/configure-cloudflare.mjs` to write the account bindings. The temporary Worker currently has **no** `DB` or `ASSET_STORAGE` binding; creating resources in the dashboard alone will not connect them.

1. Sign in to the Cloudflare account that owns the `sds-website2` Worker. Create a D1 database called `sds-enquiries` with **Automatic** data location. Do not specify a jurisdiction or location hint. Record its database ID. Jurisdiction cannot be changed after creation.
2. Create a private R2 bucket called `sds-enquiry-evidence` with **Automatic** location. Do not specify a jurisdiction or location hint, and do not enable a public bucket URL or custom domain. Record its exact name.
3. Create a Cloudflare Access application/policy for the Worker’s staff paths (`/submissions`, `/submissions.csv`, `/submissions/files/*`, `/editor`, `/api/editor/*`). Restrict it to named staff identities with MFA. Check that public pages and `/api/forms/*` remain reachable without staff sign-in. Record the Access team domain and application AUD. The Worker also verifies the Access JWT and `ADMIN_EMAILS`.
4. In a trusted authenticated development session, run `scripts/configure-cloudflare.mjs` with actual `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_R2_BUCKET`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAILS`, and `SDS_ALLOW_NON_UK_DATA_RESIDENCY=explicitly-approved`. Leave `CLOUDFLARE_R2_JURISDICTION` unset. It updates `wrangler.jsonc`. Review the diff: `DB` must point to the new D1 ID, `ASSET_STORAGE` to the private bucket **without a jurisdiction field**, and `AUTH_PROVIDER` to `cloudflare-access`. Do not commit secret values.
5. Set `RATE_LIMIT_SECRET` as a Worker secret, apply both existing migrations to the **remote new D1 database** using `npx wrangler d1 migrations apply DB --remote`, then deploy the reviewed Worker build. Resource creation, migrations, secrets and deployment have **not** been run in this workspace because Wrangler is not authenticated to the owner’s Cloudflare account.

## Verification before accepting enquiries

- Confirm `/health` reports `databaseReady: true` and `RELEASE_MODE=review`, then submit a labelled synthetic enquiry on a page using each form type. Verify its labelled fields in D1.
- Test a safe synthetic attachment and verify the private R2 object and staff download. Verify anonymous access to submissions, CSV, evidence and editor is denied. Test normal public form submission without an Access login.
- Check duplicates, rate limits, malformed files, and failure behaviour. Review malware scanning/quarantine, backups, retention and staff access before real files.
- Keep the Sites domain and data untouched until an explicit migration and data-retention plan is agreed. Changing DNS or merging the draft AWS code is not part of this setup.

This is an implementation checklist, not evidence that the Worker is connected or that any new enquiry has been stored. The account owner must supply authenticated access for the remaining account actions; do not send passwords, API tokens or enquiry data in chat.
