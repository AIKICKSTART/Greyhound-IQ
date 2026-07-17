# Abuse-case map

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-13
Owner: Security and trust/safety owners

Controls must be tied to actor, object and business cost. One global IP limit is not sufficient, and CAPTCHA is not credited unless implemented and tested.

| Flow | Abuse objective | Required dimensions | Current evidence | Status |
|---|---|---|---|---|
| Account creation | Bulk/fraud accounts | Device/risk, email verification, actor/IP velocity | WorkOS hosted flow; tenant controls not inspected | Not verified |
| Sign-in/recovery | Credential stuffing/enumeration | Account, IP/risk, generic errors, provider throttling | WorkOS only | Not verified |
| Invitations | Spam, token theft, privilege injection | Inviter/tenant/recipient quota, single-use hash, role allowlist | Token hash/expiry model; admin organisation invitation now allowlists member/admin | Abuse quotas, tenant/single-use runtime matrix still Not verified |
| Friend/follow requests | Harassment and graph spam | Sender/recipient cooldown and block policy | Social services exist | Not verified |
| Group joining | Membership flooding/bypass | Actor/group limits and approval state | Complete group model absent | Control missing |
| Posting/commenting | Spam, stored XSS, brigading | Actor/topic/content limits, duplicate detection, moderation | Selected content/rate controls | Not verified |
| Reactions | Metric manipulation | Actor/object rate and uniqueness constraint | Reaction models/services | Not verified |
| Messaging | Spam, harassment, costly media | Sender/recipient/new-account/relationship limits | Conversation limits and block checks in services | Partially verified |
| Call invitations | Ring spam and token cost | Caller/callee/object cooldown, active-room cap | Call membership/token controls | Not verified |
| Listing creation/publication | Inventory spam/fraud | Seller/day/status limits, verification, idempotency | Marketplace safety checks | Not verified |
| Marketplace enquiries | Seller harassment/scraping | Buyer/listing/seller/day limits and duplicate detection | Enquiry ownership model | Not verified |
| Ownership/verification claims | Fraud and queue flooding | Actor/dog/evidence quota, dedupe and review | Admin review actions | Not verified |
| Reports/support/feedback | Retaliation, spam, staff overload | Actor/target/type quota, duplicate/abuse scoring | Queues exist | Not verified |
| Search/scraping | Bulk data extraction and DB cost | Query complexity, page cap, actor/IP budget | Some pagination caps | Not verified product-wide |
| Upload | Malware, quota theft, decompression/media bombs | File/actor/storage/processing limits and quarantine | Media validation/scanner design | Partially verified; live pipeline Not verified |
| Download/export | Exfiltration and resource exhaustion | Owner/object/day/size limits, field allowlist, fail-closed result and byte limits | Media auth focused test; export has explicit projections, per-collection caps, 8 MiB response cap, private `no-store`, rate limit and forbidden-key assertion | Partially verified; full suite/runtime cross-user checks and state-changing GET review remain `SEC-H-003` release blockers |
| Account deletion | Delete/recover cycling, counterparty corruption or incomplete provider deletion | Re-auth, cooldown, idempotent deletion ledger, exact storage-prefix validation | 30-day grace; sender-only message tombstone; bounded queued storage deletion with audit | Partially verified; provider/session/backup completion remains `SEC-H-002` release-blocking |
| AI runs | Cost exhaustion, prompt/tool abuse | Run/token/provider-cost budget, concurrency, tool allowlist | Usage events; static tier gate | Blocked `SEC-H-007` |
| Checkout creation | Duplicate sessions/plan tampering | Actor/plan/idempotency/server allowlist | Server price IDs | Partially verified |
| Billing webhooks | Forged/replayed/out-of-order state | Signature, provider event ID, binding, state machine | Signature, DB dedupe, settlement checks | Partially verified |
| Admin mutations | Privilege escalation and repeated destructive action | Exact permission, reason, confirmation, idempotency/audit | Admin guards/reasons; resource/status schemas; new plan/price/invitation/source/support/bug/entitlement allowlists; transactional last-admin check | Export/retention/deletion target allowlists, last-owner and runtime negative/concurrency tests remain blocked under `SEC-H-001`, `SEC-H-008` |
| Internal jobs | Unauthorised costly/destructive execution | Route-specific workload identity, POST, replay key | Interchangeable static secrets | Blocked `SEC-H-009` |
| Racing ingestion | Provider scraping, duplicate/corrupt feed | Schedule lock, provider quota, schema, dedupe | Unique constraints and parsers in places | Not verified end-to-end |

## Required test pattern

For each flow, test signed-out, wrong role/tier/tenant/owner/relationship, blocked/private/deleted state, duplicate submission, concurrency, rate/quota exhaustion, malformed and oversized input, dependency timeout, audit failure and safe recovery. Tests must assert that protected data is not returned and side effects are not created—not only that an error status occurs.

## Operational response

Rate-limit and abuse alerts need a named owner, threshold, investigation steps, containment action and test. No production alert routing or alert-drill evidence was inspected, so automated detection remains Not verified.
