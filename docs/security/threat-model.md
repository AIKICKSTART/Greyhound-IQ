# Product-area threat model

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-13
Owner: GreyhoundIQ security lead
Supersedes as evidence: `docs/planning/security-threat-model.md`

The planning document contains controls not found in the inspected implementation, including CAPTCHA, first-post/new-account cooldowns, a periodic moderator agent, agent Docker/network isolation and a missing incident runbook. Those claims are not evidence and are captured as `SEC-H-012`.

## Method

For each product area, the review considered spoofing, tampering, repudiation, information disclosure, denial/resource exhaustion, privilege elevation, business-flow abuse, privacy harm and external-provider failure. Status has the prompt-defined meaning: Verified, Partially verified, Not verified, Control missing, Implementation vulnerable, Test coverage missing or Blocked from release.

## Public website and authentication

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Contact spam, injection and email-header injection | Form and input code; no end-to-end abuse evidence reviewed | Not verified | Schema, header allowlist, actor/IP/object limits and negative tests |
| Open redirect and return-path manipulation | `resolveWorkosReturnTo`; `workos-redirect.test.ts` | Verified | Staging callback integration |
| Account enumeration and credential attacks | Hosted WorkOS flow | Not verified | Tenant anti-abuse/MFA/recovery evidence |
| Public error leakage | Safe callback recovery implemented | Partially verified | Route-wide malformed/error tests and production header/body sample |
| Cache poisoning/cross-user caching | CSP and proxy headers exist | Not verified | Cache-key and `no-store` tests for private responses |
| Public scraping/resource exhaustion | Per-endpoint controls vary | Not verified | Search/cardinality budgets and rate-limit matrix |

## Racing intelligence

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Provider credential exposure or provider impersonation | Server-only clients intended | Not verified | Secret bundle scan, host allowlist, tenant credential scope |
| Malformed, stale, duplicate or conflicting source records | Source fields/raw archives and parser tests exist | Partially verified | Schema/adversarial fixtures, conflict policy, correction audit |
| Enumeration of unpublished/restricted records | Public services use status projections in places | Not verified | Object-state tests for every dynamic route/API |
| Expensive search/statistics/query abuse | Some list caps exist | Not verified | Query budget, index plan and maximum-row evidence |
| Cache leakage/provenance loss | Source/update fields exist | Not verified | Cache security context and disclosure tests |
| Unsafe replay/media URLs and SSRF | Replay proxy/signing code exists | Partially verified | Private/link-local/DNS-rebinding/redirect/size/timeout tests |
| Internal sync abuse | Static secret and mutating GET | Blocked from release | OIDC service identity, POST only, replay/idempotency tests; `SEC-H-009` |

## Community, groups and forum

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Stored/reflected/DOM XSS in posts/comments/profiles | React escaping and content cleaning in services | Partially verified | Stored-render tests for HTML, Markdown, URLs and AI/provider strings |
| Spam/reaction/friend/follow automation | Rate-limit implementation exists for selected flows | Not verified | Per-actor and per-object flow limits; no CAPTCHA claim without implementation |
| Private-profile, block, deleted-content or notification leakage | Visibility and block services exist | Partially verified | Cross-role/object search, notification and share-link tests |
| Unauthorised edit/delete and mass assignment | Ownership guards in services | Not verified product-wide | Direct API tests for another owner's post/comment/media |
| Group-membership and moderation bypass | Product audit found incomplete group model | Control missing | Membership state machine and scoped moderator policy |
| Report abuse/moderator escalation | Report/admin paths exist | Partially verified | Duplicate/retaliation controls and moderator-vs-admin negative tests |

## Messaging, presence and calls

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Conversation/room ID enumeration and non-member access | Participant filters, Realtime exact grants | Partially verified | Direct API/WebSocket cross-user tests for every event |
| Block bypass and stale Realtime grants | Revalidation/revocation and focused tests | Partially verified | Apply RLS SQL then staging subscription test |
| Presence and read-receipt privacy | Shared member-presence topic | Blocked from release | Relationship-scoped grants; `SEC-H-011` |
| Attachment access after relationship/deletion change | Media service tests owner/participant paths | Partially verified | Signed URL revocation, cache and post-delete tests |
| Message replay, impersonation, ordering and duplication | Message IDs/receipts exist | Not verified | Idempotency and reconnect/concurrency tests |
| Call-token theft, invitation spam and room enumeration | 10-minute scoped token and membership checks | Partially verified | Token reuse, revoked membership, limits and provider tenant tests |
| Webhook replay/out-of-order | LiveKit signature verification; one idempotence probe | Partially verified | All event types and replay/freshness tests |

## Marketplace

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Listing ownership/publication/status bypass | Listing domain service and moderation state | Partially verified | Another-seller and invalid-transition negative tests |
| Verification/seller/payment status forgery and mass assignment | Server data intended authoritative | Not verified | Unknown/security-field rejection tests |
| Enquiry spam, scraping and saved-listing enumeration | Selected limits/ownership checks | Not verified | Actor/object/daily quotas and BOLA tests |
| Malicious or misleading media/files | Scan pipeline and disclosure UI | Partially verified | Live scanner/quarantine test and moderation evidence |
| Archived/deleted/private listing leakage | Public status predicates exist | Partially verified | Search/detail/cache tests across every status |

## Account, teams and privacy

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Profile/email/security-setting takeover | WorkOS plus local profile guards | Not verified | Re-auth/step-up, session rotation and ownership tests |
| Privacy or notification-setting bypass | Account services exist | Not verified | Direct API/property tests and audit evidence |
| Invitation theft, role escalation, last-owner removal | Admin/member records exist | Blocked from release | Token single use, tenant binding, last-owner/admin concurrency; `SEC-H-008` |
| Invoice/export/support-ticket BOLA | Owner filters in selected routes | Partially verified | Cross-user direct endpoint tests |
| Export over-collection/resource exhaustion | Explicit fields, 500-row collection caps, 20 nested-media cap, 8 MiB limit, forbidden-key assertion, same-origin/rate control and private `no-store`; focused tests pass | Partially verified; release-blocked pending full/runtime tests | Cross-user, large-account, header and GET-side-effect tests; `SEC-H-003` |
| Account deletion corrupts counterparties or leaves providers/storage | Sender-only message tombstone plus bounded, leased, audited exact-prefix storage jobs; focused tests pass | Partially verified; release-blocked on provider/session/backup lifecycle | Provider cancellation/deletion, session revocation, live storage and backup expiry evidence; `SEC-H-002` |

## Administration and operations

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Moderator-to-admin data or function escalation | Identified high-risk reads declare `minimumRole: "admin"` and call `requireAdminProfile()`; moderator landing routes to reports; support/bug/feedback are explicitly read-only with static contract tests | Partially verified; release-blocked pending runtime negative E2E | Runtime direct-route/API/mutation denial and permission-by-projection matrix; `SEC-H-001` |
| Free-form privileged state and storage-path mutation | Typed allowlists now cover plan/price, interval/AUD, invitation, source-health, support, bug and entitlement inputs | Partially verified; release-blocked | Authoritative export/retention/deletion target and storage-path contracts; `SEC-H-008` |
| Self-lockout/last-admin/last-owner race | Transactional advisory lock and last-active-admin contract with pure regression tests | Partially verified | Real DB concurrent last-admin test and last-owner transfer/removal controls |
| Audit repudiation/tampering | Audit rows and required reasons exist | Blocked from release | Correlation IDs, append-only/integrity control; `SEC-H-010` |
| Unsafe webhook/job reprocessing | Event records and dedupe exist | Not verified | Role, idempotency, audit and provider re-fetch tests |
| Diagnostic/internal endpoint abuse | Static shared secrets | Blocked from release | Per-route OIDC identities/private ingress; `SEC-H-009` |

## AI tools

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Direct/indirect prompt injection and output injection | Input length/cleaning and structured service | Not verified | Untrusted-content isolation and rendered-output tests |
| Cross-user/tenant memory leakage | User predicates exist | Not verified | Adversarial cross-user retrieval/tool tests |
| Unauthorised tool invocation/excessive agency | No protected mutation path evidenced in reviewed agent service | Not verified | Explicit tool allowlist using ordinary server policies |
| Secret exposure/provider retention/unsafe logging | Server-side env expected | Not verified | Provider DPA/retention, prompt redaction and client bundle scan |
| Cost exhaustion/stale entitlements | Usage events and strict entitlement-snapshot parser test exist; launch still uses a static tier check | Partially verified; release-blocked | Effective snapshot plus atomic monthly run/token reservation and Pro+ checkout parity; `SEC-H-007` |
| Runtime escape/network access | Planning doc claims unobserved Docker isolation | Blocked from release | Actual runtime identity, filesystem, egress and timeout evidence; `SEC-H-012` |

## Design Lab and delivery

| Threat / abuse | Existing evidence | Status | Required release evidence |
|---|---|---|---|
| Indexing/public enablement/production mutation | Exact access policy, administrator requirement for production app, six route guards and noindex/read-only/isolation tests | Partially verified | Built deployment and direct API/data isolation test; confirm isolated demo remains synthetic/public only |
| Query parameter changes real role/permission | Fixture controls are intended local only | Not verified | Production build test across selector permutations |
| Production data in fixtures | Synthetic fixture contract exists | Partially verified | Fixture secret/PII scan and DB network-deny test |
| CI secret exposure/supply-chain compromise | Gitleaks, Semgrep, npm audit, lockfile | Partially verified | SBOM, provenance, signing, artifact policy |
| Cloud deployment privilege and scanner secret access | Shared broad identities/secrets | Blocked from release | Service-specific IAM and secrets; `SEC-H-004` |
| Unverified/irreversible release | SHA/evidence/digest and web candidate smoke exist | Blocked from release | Scanner smoke, migration/backup binding and rollback; `SEC-H-005` |

## Residual-risk rule

No high finding in this model is accepted. Any future accepted medium/low risk requires a named individual owner, reason, severity, compensating controls, expiry, remediation plan and retest requirement. Expired acceptance blocks release.
