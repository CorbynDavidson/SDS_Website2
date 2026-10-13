# Edit-link SEO controls

The editor supports page slug changes, LegalService details, visible FAQs with
FAQPage JSON-LD, and custom local 301 redirects. GitHub remains the source of
truth; a draft/proposal never changes the deployed sitemap.

## Use the controls

1. Open a website page with `?edit=1` and sign in as the owner.
2. Choose **SEO & redirects**. Select another page using the page selector.
3. Edit the slug, optionally customize LegalService details, or add/remove FAQ rows.
   The home page keeps `/`; page slug changes stay in the current parent folder.
4. Use **Manage 301 redirects** to add, edit or remove exact local rules.
   Migration redirects, current page URLs, assets, private routes, cycles and missing destinations are
   rejected. Required redirects for renamed pages must be retained.
5. **Save** creates a GitHub branch and PR containing the SEO/redirect source
   changes and sitemap proposal documentation. Review the branch/PR links.
6. **Publish saved proposal** runs the existing validation and Cloudflare preview
   checks. The publisher merges only the expected files at the expected commit
   and main base. It confirms live settings after deployment.
7. **Check progress**, **Discard**, and retry after a failed unmerged proposal use
   the same publication workflow. Reopen saved proposals from **All pages**.

A published old URL redirects to the new URL with HTTP 301. Both old slash
variants are recorded in `_redirects`, and the build compiles rules into Worker
routing. This is necessary because Cloudflare static `_redirects` rules do not
apply to HTML returned by Worker code.

## Repository implementation

| File | Responsibility |
| --- | --- |
| `worker/editor-seo.mjs` | Validation, exact redirect graph, safe schema, visible FAQs and dynamic XML sitemap |
| `scripts/lib/editor-seo-build.mjs` | Stable source records, public URL mapping, link/form updates and deployed page index |
| `worker/editor-publish.mjs` | Authenticated SEO API and atomic Git tree proposals |
| `worker/editor-pages.mjs` | Protected manager HTML |
| `public/editor-seo.js` | Page selector, schema fields, FAQ repeater, redirect modal and workflow buttons |
| `public/sds-runtime.js` | Authenticated edit-link toolbar entry |
| `worker/runtime.mjs` | Protected API/manager routing and sitemap handler |
| `worker/production-routing.mjs` | Custom redirects on production/review origins |
| `scripts/build-content-current-design.mjs` | Content pipeline and packaged route integration |
| `scripts/package-cloudflare.mjs` | Derived static `_redirects` copy |
| `_redirects` | Editor-managed redirect source; never maintain a second editable copy |
| `src/page-seo/<source-path SHA-256>.json` | Published page URL/schema record |
| `docs/editor-seo/<proposal UUID>.md` and `.sitemap.xml` | Reviewable proposal notes and proposed sitemap |

The stable `sourcePath` identifies the original page and wording override file.
`path` identifies its current public URL. Captured SDS source records remain
unchanged. Original source entries retained for audits are marked `seoMovedTo`
and excluded from the editor's public page list and sitemap. Existing forms
accept the new source URL; historic source URLs remain accepted during migration.
Case study listing links follow the new public URL and archive records retain
their original source identity.

The new API is `/api/editor/seo` and the manager is `/editor?seo=1`, reusing the
existing Cloudflare Access editor entry point. API writes enforce owner
identity, same-origin requests, UUID/idempotency, size limits and current
page/release baselines. No browser GitHub token or new secret is required.

Example page save payload:

```json
{
  "action": "save",
  "scope": "page",
  "id": "a fresh UUID",
  "path": "/current-page/",
  "baseSha256": "current deployed page hash",
  "page": {
    "slug": "new-page",
    "legalService": null,
    "faq": [{"question": "Can you help?", "answer": "Contact our team."}]
  }
}
```

`legalService: null` keeps the site's existing business schema. Enabling the
fields replaces the LegalService node while preserving SDS's regulatory
identifier and the stable corporation ID used by existing Service nodes.
Unrelated schema nodes survive. FAQ answers are rendered on-page as well as in
JSON-LD; script terminators are escaped when serializing user text.

## Sitemap

`GET /sitemap.xml` generates XML from `data.pageIndex` in the serving build.
Only canonical, indexable HTTP 200 URLs on the configured production origin are
included. Redirects, drafts, query variants, gone pages and invalid canonicals
are excluded. HEAD returns the same headers without a body. The route uses
`no-store`; a deployment updates the inventory and sitemap together. A global
indexing pause produces an empty sitemap. Review hosts retain their noindex
controls and use production canonical URLs.

This uses the deployed page list rather than a new D1 table. D1 continues to
store proposals/statuses and enquiries; pending publication rows are not a
crawler inventory. If pages are later served directly from D1, use a separate
published inventory keyed by serving release ID.

When a proposal changes sitemap membership, Save also commits all three XML snapshots in the same Git tree. The build writes the same production XML to `sitemap.xml`,
`public/sitemap.xml`, and `docs/migration/current-design-sitemap.xml` for review.
`lastmod` is omitted until actual content modification timestamps are available.

## Verification and release

Run `npm run check` and `npm run deploy:check`. Tests cover owner/origin guards,
atomic save/publish, no-op file handling, source identity after rename,
redirect chains/conflicts, schema safety, visible FAQs, sitemap filtering and
the final Cloudflare package routes. Migration audits must resolve approved SEO
moves and keep their original source/content coverage assertions.

Use the normal feature branch/PR/checks/deployment process. Never modify a
tracked generated Worker output directly; change its source modules and rebuild.

## Primary references

- Cloudflare redirect behavior: https://developers.cloudflare.com/workers/static-assets/redirects/
- LegalService: https://schema.org/LegalService
- FAQPage: https://schema.org/FAQPage
- Google Search updates: https://developers.google.com/search/updates

FAQPage is valid Schema.org markup. Google stopped displaying FAQ rich results
starting 7 May 2026, so this feature does not promise FAQ snippets in Google.
