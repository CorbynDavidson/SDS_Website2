# Editing and Git-backed publishing

## Status — 10 October 2026

The owner editor now has a Git-backed publishing implementation. Production publishing is now enabled in `wrangler.jsonc`, with GitHub App ID
`5257347` and installation ID `169779665`. The private key is configured separately
as a Cloudflare production secret; preview publishing remains disabled.
Cloudflare Access authentication and the first connected live publishing test
still need verification before this integration is considered fully activated.
Saving a draft still only saves to D1. It does not publish.

Editable field IDs are now assigned in the server build. Browser features such
as Safari's automatic telephone links may split text inside a field without
changing its ID or shifting later fields. The editor validates those stable
fields against the server catalog before allowing publication. Older drafts
from a different page version remain available through Saved draft and require
review rather than silently remapping shifted field IDs.

If Cloudflare Access redirects an editor API request to sign-in, the editor
shows a Sign in to edit link to the protected page index instead of a generic
connection error. Missing publishing credentials and wording-map mismatches
also have visible status messages, including on touch devices.

## Owner journey

1. Open a page with `?edit=1`, or use `/editor` to select a page. Sign in through
   Cloudflare Access. Edit outlined text or open **All wording**. Forms remain
   excluded. Automatic carousel cycling pauses; manual slide controls work.
2. **Save draft** saves privately to `content_drafts`. Reopening the same version
   restores it. **Publish changes** first saves that draft, then queues a durable
   publication in `editor_publications`.
3. The publisher creates an `editor/<request-id>` branch from the exact deployed
   `main` commit. It commits only the page's JSON wording override under
   `src/content-overrides/` and opens a PR. The editor displays its PR link.
4. The existing GitHub `validate` check and Cloudflare preview build run. A
   scheduled Worker checks the queue every minute, including when the browser
   is closed. Both checks must report success from their recognised GitHub Apps
   before the exact PR head may merge. Missing, pending or failed checks do not
   merge. A changed main branch or additional PR files stops publication.
5. Merging triggers the existing Cloudflare main build. The editor shows
   **Deploying**, then **Live** only when main checks pass and the running
   deployment contains the requested wording. Reload before another edit.

**Retry** closes an unmerged failed proposal and creates a fresh checked branch.
**Discard proposed changes** closes an unmerged PR while retaining the saved
draft. Neither discards deployed changes. If main has moved, wait for deployment,
reload, review the draft and republish. Do not overwrite newer wording silently.

A failure after merge needs a checked revert PR and verification of the previous
release. The system reports that separately; it does not claim a merged edit can
be discarded or automatically promise rollback. Only one publication runs at a
time; other drafts can still be saved.

## Content and migration integrity

Original SDS captures, generated migration evidence and SEO metadata are retained.
Owner-approved wording is a separate versioned overlay, applied to public pages
at the end of the build. Each field contains both the original wording and the
replacement. The build validates every field against the assembled baseline;
missing fields, changed originals and unknown page paths fail the build.

Only non-empty wording can be published; removing an entire element requires a
developer PR so field positions remain consistent. HTML is escaped, and script/style/form nodes, controls,
carousel counters, chatbot UI and editor UI are excluded. URLs, layout, metadata,
indexing switches and form schema still require a normal developer PR. A page
edit applies to that page; shared navigation or footer wording is not silently
changed on other pages. The editor compares its wording map to the server map and
disables publication if dynamic page content or stale code makes them differ.

Migration validation continues to check the immutable baseline. Override tests
check the additional owner-approved publication layer. A body-heading edit does
not automatically rewrite title tags, descriptions, structured data or FAQ
schema; those require a coordinated SEO/content review.

## One-time GitHub App setup

Create a private GitHub App owned by the repository owner and install it on
**CorbynDavidson/SDS_Website2 only**. A webhook is not required for this design.
Set these repository permissions:

| Permission | Access |
| --- | --- |
| Contents | Read and write |
| Pull requests | Read and write |
| Checks | Read-only |
| Commit statuses | Read-only |
| Metadata | Read-only (automatic) |

No Actions-write, Workflows-write, organisation access or administration permission
is required. The runtime App is separate from ChatGPT's GitHub connection.
GitHub App installation tokens trigger normal checks when they open a PR.

In the production Cloudflare Worker settings add:

| Name | Type | Value |
| --- | --- | --- |
| `GITHUB_APP_ID` | Variable | The App ID from the App settings |
| `GITHUB_APP_INSTALLATION_ID` | Variable | The installation ID after installing on this repo |
| `GITHUB_APP_PRIVATE_KEY` | Secret | Complete downloaded PEM private key, including headers and newlines |
| `EDITOR_PUBLISH_ENABLED` | Variable | `true` after access is configured |

The Worker supports GitHub's downloaded RSA PEM format and PKCS#8 PEMs. It signs a
short-lived JWT and requests an installation token restricted to this repository.
Credentials never go to the browser or repository. No OpenAI key is involved.

Keep `EDITOR_PUBLISH_ENABLED` in `wrangler.jsonc` synchronised when activating:
change it through a checked PR, otherwise the next Git deployment can restore
`false`. Keep previews without publishing credentials and publishing disabled.

## Cloudflare Access and database

Configure an Access application covering `/editor`, `/api/editor/*` and
`/submissions*` on the review hostname, allowing only the approved owner email.
Set `AUTH_PROVIDER=cloudflare-access`, `CF_ACCESS_TEAM_DOMAIN`,
`CF_ACCESS_AUD` and `ADMIN_EMAILS` in the production Worker. The existing
JWT-verifying backend must authenticate successfully before draft saving or
publishing is allowed. Merely knowing `?edit=1` gives no publishing access.

D1 uses the existing `DB` binding. The publisher idempotently creates
`editor_publications` on first authorised use; the same schema is also recorded
in `drizzle/0002_editor_publications.sql` and `db/schema.ts`. It retains the patch,
branch/head/PR/merge identifiers, status and errors for recovery and audit. Active
jobs have a unique database lock and a short lease to prevent overlapping cron
and editor requests from publishing twice.

The one-minute cron is in `wrangler.jsonc`. While publishing is disabled, it exits
without D1 queries or GitHub calls. When enabled, it reads at most five active
jobs per tick. Polling reports status only; publication proceeds in the background.

## Activation verification

After configuring access and the App, make one small owner-approved wording edit
and confirm: saved draft → branch and one-file commit → PR → both checks pass →
merge → Cloudflare deployment → correct public wording. Then publish a checked
revert of that edit. Verify another email and signed-out requests cannot publish.
Record this live acceptance test before considering the integration activated.

The local automated tests cover authentication/origin gates, escaping and stale
fields, request deduplication, commit scope, genuine checks, exact-head merging,
changed-main protection, unexpected PR files, and deployment confirmation. They
mock GitHub and do not substitute for the first connected live test.

Technical references: [GitHub App authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app), [pull request merge API](https://docs.github.com/en/rest/pulls/pulls), and [Checks API](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-checks).
