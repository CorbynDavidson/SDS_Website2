# Rollback

Keep the existing SDS host/domain serving the original site until production gates pass. Review deployment failures do not require changing SDS DNS.

Before cutover, record the current website DNS records/TTL, original hosting backup, saved good review version, deployment source commit and private database/evidence backup. Confirm the domain owner can restore the old records and that the old host will still accept the domain.

If a new review deployment fails, redeploy its previous saved Site version using the hosting account/tools. Additive migrations retain earlier enquiries. Do not drop new tables or reverse applied schema history to roll back code.

If production suffers a confirmed loss of forms, unavailable content, wrong indexing or operational routing failure, restore the previously verified deployment or the recorded old-host DNS values. DNS recovery is subject to cached TTL. Preserve all enquiries/evidence created after launch and reconcile them privately; code rollback must not erase those records.

Rehearsal: automated tests verify legacy-table preservation and Worker restart persistence. A production host/DNS/database restore rehearsal still requires the actual hosting/domain access and is a launch gate. This document does not claim that rehearsal has happened.
