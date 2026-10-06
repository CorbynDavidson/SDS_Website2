# Original SDS source capture

Run `python -m pip install -r requirements-migration.txt`, then `python scripts/capture-sds.py`.

The capture uses the live Concrete CMS sitemap, visits every published sitemap URL, discovers additional first-party links, preserves raw anonymous HTML in deterministic gzip files, records original metadata and wording hashes, and downloads first-party page resources plus CSS dependencies.

No CMS credentials or client enquiry records are read. Captured HTML may contain the original public form's short-lived anonymous anti-spam/CSRF values; the importer removes these CMS-dependent values from the replacement forms.

The source manifest explicitly records unavailable URLs and assets. Unresolved original pages or failed resources other than verified original 404s block the migration checks. Twelve resource URLs already returned 404 on the original site; those remain documented source issues and are not counted as captured media. Confirmation and administrative URLs retain the source indexing behaviour rather than being made indexable automatically.

To request a fresh capture in GitHub, change the request identifier in `migration/capture-request.json` and commit it, or run the Capture original SDS source workflow manually. The workflow commits the capture, assets and inventory back to `main` with the repository's GitHub Actions credential. It does not change the production domain or deploy a website.

Source captures are immutable migration baselines. Editing their wording to make a parity check pass is not an acceptable content change workflow.
