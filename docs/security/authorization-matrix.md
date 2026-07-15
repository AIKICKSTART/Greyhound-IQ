# Authorisation matrix

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-14
Owner: GreyhoundIQ security lead

The matrix records observed server controls, not labels or hidden buttons. `src/lib/auth.ts` is the shared identity/role entry point. Domain services must add object, property, relationship, status and tenant checks.

## Actor matrix

| Actor | Authentication | Permitted scope | Server authority observed | Verification and gaps |
|---|---|---|---|---|
| Signed-out visitor | Public | Marketing, legal, public racing, approved public listing/profile data | Anonymous/public queries and route projections | Partially verified; full endpoint inventory absent |
| Ordinary member | Required | Own account; permitted community, messaging, saved items and enquiries | `requireCurrentUserProfile` | Partially verified |
| Racing member | Required for paid features | Public racing plus entitled analysis/tools | `normalizeTier`, `hasTier`, product services | Entitlement consumption incomplete; `SEC-H-007` |
| Buyer | Required for private actions | Search public listings; own saves/enquiries | Current profile plus buyer-owned records | Full BOLA matrix Not verified |
| Seller | Required | Own listing drafts/media/status transitions | Listing service ownership/status checks | Full property/status allowlist Not verified |
| Greyhound owner/breeder/trainer | Required | Own verified dog/page/breeding workflows | Profile role, ownership records, verification status | Complete object matrix Not verified |
| Community/group member | Required | Visible posts/groups/threads; own mutations | Profile, visibility, membership/ownership checks | Group membership lifecycle incomplete in product audit |
| Group moderator | Required | Assigned group moderation only | No central scoped group-moderator policy identified | Control missing |
| Page member/manager | Required | Assigned managed-page scope | Custom-page membership/owner checks | Complete role-transition tests Not verified |
| Team member/owner | Required | Assigned organisation/team scope | Membership and owner fields | Last-owner protection not proven; `SEC-H-008` |
| Support operator | Required | Minimum support-ticket context only | No distinct support guard identified in shared auth | Control missing |
| Moderator | Required | Explicitly permitted trust/safety, support and moderation surfaces only | `requireModeratorProfile` accepts moderator/admin; report bans allow only explicit member/breeder/trainer target roles and deny self, peer, administrator, missing and unknown roles | Peer-target policy and wiring are source-tested; runtime moderator-negative E2E and per-surface policies remain missing, so `SEC-H-001` remains release-blocking |
| Administrator | Required | Explicit high-risk platform mutations | `requireAdminProfile`; required reasons; typed admin-input contracts; report-ban authority subject to self-lockout and transactional last-active-admin guards | Export/retention/deletion target allowlists, last-owner and runtime concurrency remain incomplete; `SEC-H-008` |
| Billing operator | Required | Minimum billing operations | No distinct billing-operator guard identified | Control missing |
| AI feature user | Required + tier | Allowed agent type for effective entitlement and budget | Static tier comparison in `assertAgentTier` | Snapshot/usage enforcement incomplete; `SEC-H-007` |
| Design Lab reviewer | Local allowed; production app requires exact enable flag and administrator; explicitly isolated full-access demo allowed | Synthetic state and simulated actions only | `evaluateDesignLabAccess`, `requireDesignLabReviewer`, proxy read-only block, route safety/isolation tests | Six routes enforce the guard; complete runtime no-production-data/mutation proof remains Partially verified |
| Suspended/banned user | Session may exist | No protected application data or mutation | `requireCurrentUserProfile` rejects `isBanned` | Old session/provider revocation Not verified |
| Blocked user | Required | No blocked party's protected relationship content | Conversation service and Realtime block checks | Focused messaging tests pass; all product areas Not verified |
| Deleted user | No active account access | Recovery only during declared grace period; no access after finalisation | Deletion flags, local identity/social-actor scrub, sender-authored message tombstones and queued storage-prefix deletion | Counterparty integrity is fixed in focused tests; provider cancellation/deletion, session revocation and backup lifecycle remain release-blocking under `SEC-H-002` |

## Guard hierarchy

| Guard / policy | Function-level decision | Required additional checks | Evidence | Status |
|---|---|---|---|---|
| Public route | No session required | Visibility, publication, record status, bounded projection | Public pages and services | Not verified product-wide |
| `requireCurrentUserProfile` | Authenticated, local profile exists, not banned | Object owner/member, block/privacy, tier, state transition | `src/lib/auth.ts` | Partially verified |
| `requireModeratorProfile` | `moderator` or `admin` | Queue-specific permission and minimal output projection | `src/lib/auth.ts` | Partially verified; use is restricted on identified admin-only pages, but every remaining use still requires an explicit policy and runtime negative coverage (`SEC-H-001`) |
| `requireAdminProfile` | `admin` only | Property allowlist, last-owner/admin, reason, confirmation, audit | `src/lib/auth.ts`, `src/app/admin/mutations.ts` | Partially verified; `SEC-H-008` |
| `withDbRequestContext` | Sets user/profile/role/tier transaction GUCs | Runtime DB role and RLS must enforce exact row predicates | `src/lib/db-context.ts` | Not verified in production; `SEC-H-006` |
| `withDbSystemContext` | Sets `app.system=true` | Narrow caller identity and operation-specific allowlist | `src/lib/db-context.ts` | Control missing at DB-role boundary; `SEC-H-006` |
| Realtime grants | Exact short-lived topic grant | Current membership plus no block at grant and event time | `issueRealtimeAuthorization`, RLS SQL | Partially verified |
| Media access | Owner or linked permitted record | Visibility/participant and deletion/scan state | `src/lib/media-service.ts` | Focused test verified; product-wide Not verified |
| Billing settlement | Provider signature, binding, paid invoice, allowlisted price | Idempotency, event order, authoritative provider/customer | `src/lib/billing/stripe-webhooks.ts` | Focused test verified |

## Administrative route exposure

`src/app/admin/admin-nav-data.ts` now explicitly marks the dashboard, people/access, billing, compliance, retention, exports, audit/actions, jobs, webhooks, usage, source-health, page-rules and site-content surfaces with `minimumRole: "admin"`. Their page loaders call `requireAdminProfile()`. Moderator `/admin` redirects to `/admin/reports`; desktop/mobile brand links resolve through `adminHomeForRole`. Support, bug and feedback pages visibly identify moderator access as read-only and mutation controls as Administrator required. `src/app/admin/admin-nav-data.test.ts` and `src/app/admin/admin-moderator-read-only-contract.test.ts` prove these source contracts. This does not yet prove runtime denial, minimal response projections, alternate entry points, or mutation denial for every moderator-visible trust/safety, support and bespoke route.

The report-ban boundary reloads actor and target state inside the serialized transaction, then applies `assertReportUserBanAllowed` before changing the target user. A moderator may target only the explicit `member`, `breeder`, or `trainer` roles. Self, `moderator`, `admin`, missing, and unrecognized roles fail closed. An administrator may target moderators or other administrators, but cannot ban themselves or the last active administrator. These are pure-policy and source-wiring results; no request-level browser proof or PostgreSQL concurrency proof is claimed.

Required remediation:

1. Define a central permission for every remaining moderator-visible screen and data projection.
2. Keep administrator-only navigation metadata and page-loader guards in sync through the existing static test.
3. Add runtime tests for the route and direct server/API entry point as member, moderator, support operator, billing operator and administrator.
4. Add PostgreSQL concurrency tests for the implemented last-administrator and self-lockout guards, and implement/test last-owner transitions.

## Property-level denylist is insufficient

Every mutation must parse an explicit allowed object and reject unknown fields. Browser fields such as `userId`, `ownerId`, `role`, `permissions`, tier/entitlement/payment/verification/moderation state, audit actor and deletion timestamps are never authoritative. `src/lib/admin-input-contract.ts` and `src/lib/admin-status-contract.ts` now allowlist plan/price state, monthly/yearly interval, AUD, organisation invitation member/admin roles, source-health status, support status/priority, bug status/severity, entitlement keys and the `-1..100000000` limit range. Export type, retention/deletion target type and storage-target contracts still lack an authoritative product allowlist; see `SEC-H-008`.
