# Temporary search indexing pause

Requested on 6 October 2026 for Housing Condition Claims to limit search cannibalisation during the SDS migration. The page content, design, canonicals, metadata, sitemap, forms, editor and access controls stay unchanged.

Set the Sites runtime variable `INDEXING_DISABLED=true`, then deploy the tested saved version. Public responses carry `X-Robots-Tag: noindex, nofollow`. Public crawling is allowed so search engines can read that directive; administrative and editor routes remain disallowed and protected. This does not change DNS or the original SDS hosting.

## Restore the exact previous state

Remove only the `INDEXING_DISABLED` runtime variable (or set it to `false`) and redeploy the same saved version. This restores the previous host-aware robots and indexing policy without reverting the editor fixes or any subsequent content edits.

The recorded previous state was Site version 68, source commit `01950de60968f8973b197c09e1cc1397908f8219`, environment revision 2, `RELEASE_MODE=review`, and no `INDEXING_DISABLED` variable. The Housing Condition Claims domain already returned `noindex, follow` and `robots.txt` disallowed all crawling. Consequently, restoring that exact state does **not** make Housing Condition Claims indexable. A later request to enable indexing must separately select the intended primary domain and release settings; do not silently change the canonical domain or apply production SDS redirects to the HCC domain.

Search engines process noindex on recrawl; this is not a confirmation that existing search results have already disappeared. No automatic restoration date is scheduled; keep the pause until the user requests restoration.


## Explicit HTML directives (6 October 2026)

Review responses now include exactly one `<meta name="robots" content="noindex, nofollow">` and one `<meta name="googlebot" content="noindex, nofollow">` in the HTML head, alongside the HTTP header. Conflicting robots/googlebot meta tags are removed from the served review HTML. Review HTML and robots.txt carry no-store cache directives. This transformation happens at response time, so production metadata is retained and can be restored at cutover. The compiled-Worker audit checks all 325 public templates.

Previously indexed results may persist until Google recrawls them. For prompt search-result suppression, the Search Console property owner should use the temporary Removals tool for the `https://housingconditionclaims.org/` URL prefix, while retaining the noindex controls and crawl access. Search Console removal is an account-side task; no removal request has been submitted from this workspace.

The review/pause directives were changed to `noindex, nofollow` at the owner’s request on 6 October 2026. Public crawling remains allowed so Google can read noindex; nofollow concerns links on the page and does not prevent the page itself being fetched.
