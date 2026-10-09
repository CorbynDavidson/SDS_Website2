# UK-resident enquiry service — implementation checkpoint

The owner requires UK-only enquiry data. The existing `sds-website2` Cloudflare Worker remains a review website with no D1/R2 enquiry bindings. Do **not** direct live forms or real client files to it. This implementation is isolated under `uk-intake/`; there is no deployed AWS service or form switch yet.

## Proposed AWS London topology

| Component | Configuration to create |
| --- | --- |
| Region | `eu-west-2` (London) for every application resource; deny unintended region creation in account policy. |
| Intake compute | ECS Fargate service in two London availability zones, reachable only from an HTTPS Application Load Balancer; health route `/health`. |
| Database | RDS PostgreSQL in private subnets, no public access, TLS certificate validation, same-region automated backups and no cross-region replica/copy. Run `uk-intake/schema.sql` once after provisioning. |
| Evidence | Private S3 bucket in `eu-west-2`, Block Public Access, encryption, versioning and same-region backups. No public object URL or cross-region replication. Task role restricted to this bucket. |
| Secrets | London Secrets Manager entries for `DATABASE_URL` and `RATE_LIMIT_SECRET`; task role accesses only those entries. Supply the public RDS CA bundle as `RDS_CA_CERT_PEM`. |
| Logs | London CloudWatch log group with retention and no request bodies, email addresses or file names in application logs; review load balancer and security logs for location and retention. |
| DNS | An `intake` hostname pointed directly at the London ALB, with Cloudflare proxy disabled for this hostname. Use ACM TLS on the ALB. |

Staff access is a separate gate: design a London-region authenticated portal with MFA and a restricted download route before any staff use. The container currently implements **submission only**, with no staff or evidence retrieval API. Do not publish a CSV or public S3 object link. Cloudflare's existing `/submissions` route is not connected to this database.

## Current code and deployment gates

`uk-intake/core.mjs` accepts the existing form payload format, permits one configured site origin, validates the captured form schema, caps files to five at 8 MiB each, checks file signatures, and hashes the client IP with an hourly HMAC key for rate limiting. `uk-intake/repository.mjs` writes PostgreSQL metadata and private S3 objects in a transaction with rollback cleanup. `uk-intake/server.mjs` limits total requests to 42 MiB. The application fails startup if AWS region, RDS endpoint, TLS CA, S3 bucket location or storage connection is wrong. These checks need verification in the actual AWS account.

1. Provision the London account, network, ECS, RDS, S3, secrets, ALB, certificate, DNS, monitoring and backup policies. Review provider terms and any exceptions to UK-only processing with SDS's data protection lead. AWS's region choice controls customer content, but service-specific logs, support access and transfers require review.
2. Obtain a dependency lockfile with `npm install --package-lock-only` inside `uk-intake/` in a connected environment, review dependency and image security, then replace the Dockerfile's `npm install` with `npm ci`. Build, scan and push the image to London ECR; set the ECS task's `AWS_REGION=eu-west-2`, `ALLOWED_SITE_ORIGIN` to the exact site origin, `EVIDENCE_BUCKET`, `DATABASE_URL`, `RATE_LIMIT_SECRET`, and `RDS_CA_CERT_PEM` via the task/secrets configuration. Never commit values or credentials.
3. Run `npm run build` at repository root followed by `node scripts/package-uk-intake.mjs` whenever the site form definitions change. Review the generated `uk-intake/forms.json` diff and deploy the matching intake image before changing any frontend form route.
4. Add a regional bot/abuse control at the ALB/API edge. Keep origin validation, honeypot, idempotency and database-backed limits. Perform an authenticated security review of staff access and file downloads.
5. On a private test hostname, update the browser form submission and contact-check paths so they go directly to the UK intake service. Do not proxy them through the Cloudflare Worker. The UK service's contact check currently performs syntax validation only and returns `unknown` for valid entries; it makes no third-party postcode/email lookup. Confirm cross-origin preflight, validation, labelled test submission, attachment, duplicate retry, denial and failure handling. Then review a production cutover while leaving the current Sites domain unchanged until accepted.

The staff portal is **not yet implemented** in the UK service. The frontend still calls the Cloudflare Worker for contact checks and form submission. A successful local test or a Cloudflare Worker deployment does not establish UK-only operation or a working enquiry flow. Before accepting real data, verify the AWS account's regional settings, backup destinations, logging, support arrangements, subprocessor terms and data flows; a London resource setting alone does not guarantee every aspect of processing remains in the UK.

## Local validation

```sh
node uk-intake/core.test.mjs
node --check uk-intake/server.mjs
node --check uk-intake/repository.mjs
```

The pure handler tests do not connect to PostgreSQL, S3 or AWS. Remote integration, deployment and end-to-end tests are required before real enquiries.
