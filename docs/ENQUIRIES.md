# Enquiries and operator access

All seven captured original schemas are in `src/content/sds/forms.json`. The visible labels, select options and consent paragraphs remain the original SDS wording. CMS-specific expiring tokens are removed and forms submit to `/api/forms/<key>`. Successful enquiries redirect to the captured `/contact-us/thank-you/` page.

Records are in `form_submissions`: created time, source path, form identity, labelled answers and unique request key. Duplicate retries store one record. The old `enquiries` table is preserved and shown alongside new records. CSRF checks require a matching Origin; honeypot responses store nothing; IP addresses are hashed with a private salt into hourly rate buckets. Raw IPs and form values are not logged.

The original five-step Reform journey is reconstructed for review using the source's visible questions/state classes. All responses are retained for final submission. Original private conditional/eligibility/routing rules require CMS verification before launch; no automated legal eligibility judgment is implemented from an inferred rule. Original evidence wording is retained, with native upload controls. Up to five JPG/PNG/GIF/MOV/MPEG files, each at most 8 MiB, are accepted; this storage limit needs SDS approval against its existing policy.

Evidence objects use private R2 keys, with D1 ownership through `form_uploads`. File signatures/extensions are checked, browser-script formats are rejected, and downloads are served as attachments only to the authorised operator. Confirm the organisation's malware scanning/quarantine requirements before allowing real uploads in production; the original Snapshot configuration indicates quarantine and is a launch gate.

Operator link: **https://housingconditionclaims.org/submissions**. CSV: `/submissions.csv`. Owner allowlist currently contains `corbyn.davidson@hotmail.com`; authentication is handled by Sites and authorisation by the Worker. Anonymous and non-owner users cannot view records, CSV, files or drafts. Staff access is added only after SDS identifies the intended people/roles. Portable hosting requires verified Cloudflare Access JWTs.

No outgoing notification or CRM connection is configured by this migration. SDS must assign someone to monitor the private submissions view and verify follow-up routing before production. Test routing only with explicitly approved test destinations. Use reserved `example.invalid` addresses and clearly labelled synthetic data for verification; never submit another person's real data as a test.
