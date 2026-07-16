# GreyhoundIQ permissions matrix

Status: 97 screen-level route permission cells source/policy tested; deployed enforcement incomplete  
Snapshot: 2026-07-15 AEST  
Owner: Product engineering

The managed registry block below is checked by `npm run docs:check`. All 97 registered screen cells now have focused source/policy contracts: 33 public or optionally authenticated routes, all 32 administration routes, six Design Lab routes, six canonical/alias Pulse routes, 18 account/AI routes, and two authenticated canonical/alias seller-management routes. Every cell maps its declared actor, authentication mode, applicable roles and tiers, source file, and exact screen-level permission rules. This completes the screen-level permissions output; it does not complete deployed identity, endpoint/action, object-ownership, field-level, database-RLS, or cross-tenant enforcement.

<!-- design-lab-permissions-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-permissions-counter:end -->

## Registry access metadata

| Family | Authentication | Registered roles | Registered tiers | Feature flags | Evidence level |
| --- | --- | --- | --- | --- | --- |
| Public website | Public | visitor, member | free, pro, pro_plus | None | All eight screen cells have exact source/policy rules; contact and checkout denial ordering tested |
| Racing intelligence | Optional | visitor, racing-member | free, pro, pro_plus | None | All ten screen cells map the shared signed-out view decision; feature-action authorization remains a separate enforcement concern |
| Community and messaging | Optional | visitor, member, community-participant, page-manager | free, pro, pro_plus | None | All 15 screen cells mapped; six private Pulse cells add participant, non-participant and blocked-action decisions |
| Marketplace | Optional or required by route | visitor, marketplace-buyer, marketplace-seller | free, pro, pro_plus | None | Six browse/create cells map the public view decision; two edit aliases require an authenticated Pro seller and owner-scoped lookup |
| Account | Required | member, page-manager, team-member | free, pro, pro_plus | None | All 17 account screen cells have focused member, owner or enabled-preview source/policy evidence |
| Administration | Required | support-operator, moderator, administrator | free, pro, pro_plus | None | All 32 page guards source-tested; exact admin/moderator/read-only distinctions retained |
| AI tools | Required | ai-tools-user, administrator | pro, pro_plus | None | `/agents` signed-out, member-tier and Pro+ decisions are source-tested |
| Design Lab | Optional in isolated review environment | reviewer, administrator | free, pro, pro_plus | `ENABLE_DEVICE_PREVIEWS` | Six-route environment, exact-flag and administrator policy matrix tested |

The 97 focused contracts below bind every registered screen to an exact source/policy access decision. They do not prove deployed IAM, staging identities, product-wide object ownership checks or field-level data filtering.

## Tested permission contracts

| Route set | Tested decisions | Evidence boundary | Remaining limitation |
| --- | --- | --- | --- |
| 33 public or optionally authenticated Public, Racing, Community and Marketplace routes | Signed-out page view allowed on all 33 routes; signed-out support submission exits before rate limiting/database writes; signed-out checkout returns the 303 sign-in redirect before rate limiting or Stripe session creation | `src/components/screen-contracts/screen-permission-evidence.test.ts` checks every registered route cell plus the page, root-layout, auth, server-action and route-handler source contracts | Shared signed-out view rules do not prove every authenticated feature action, ownership decision, database policy or browser session |
| All 32 `/admin` routes | Signed-out and ordinary-member access denied before protected reads; 23 routes require administrator access, nine permit moderator reads, and support/bug/feedback mutation controls remain administrator-only | `src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts` extracts every page function and proves guard-before-read ordering against the shared auth helpers | Source authorization evidence is not a staging-identity browser test and does not prove every downstream object-level data policy |
| `/design-lab`, `/design-lab/demo-experience`, `/design-lab/dock-skins`, `/design-lab/role-blueprints`, `/feed/device-preview`, `/marketplace/design-lab` | Non-production allow; production deny without exact `ENABLE_DEVICE_PREVIEWS=true`; isolated-demo allow only after that flag; non-isolated production allow for `admin` and deny for moderator, member, reviewer label and signed-out callers | The focused test executes `resolveDesignLabAccessDecision` and `isAdminRole`, and source-checks each route plus `requireDesignLabReviewer`/`requireAdminProfile` | Isolated deployment IAM, secret separation and staging identity execution remain open under `CLOUD-01` |
| `/messages`, `/messages/[id]`, `/messages/friends` and their `/pulse` aliases | Signed-out private reads stop before service access; inbox/friends queries are current-profile scoped; thread identifiers require participant membership; blocked relationships reject new messages and calls | `src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts` extracts page/service functions, verifies guard ordering and proves aliases delegate to the reviewed canonical pages | Source proof does not establish production database RLS/BOLA behavior; existing history remains visible to conversation participants after blocking |
| Twenty account/AI and seller-management routes | Signed-out users are denied or redirected before protected reads; member, enabled Appearance preview, managed-page owner, owner-scoped listing editor and Pro+ agent decisions are bound to their source guards and queries | `src/components/screen-contracts/production-screen-member-access-state-evidence.test.ts` executes 48 explicit permission rules and verifies the reviewed source ordering | Source proof is not staging-identity, database-RLS or cross-tenant runtime evidence |

## Production-observed signed-out boundaries

| Route/surface | Signed-out result | HTTP behavior | Data exposure observation | Status |
| --- | --- | --- | --- | --- |
| `/account` | Sign-in-required account screen | 200, index-follow | No private account data observed | UI boundary observed; noindex/server behavior open |
| `/admin` | Client redirect to AuthKit | SSR 200/index-follow before redirect | No admin data observed | UI boundary observed; server-side redirect/indexing gap |
| `/pulse` | Sign-in-required private messaging explanation | 200 | No conversation metadata observed | Observed |
| `/marketplace/new` | Sign-in-required create state | 200 | No seller controls/data observed | Observed |
| `/feed` | Public empty state with sign-in/plans CTA | 200 | No private feed data observed | Observed |
| `/agents` | Product/tier explanation and preview controls | 200 | No secrets or internal prompts observed | Observed; execution enforcement untested |
| `/design-lab` | Production not found | 404/noindex | No preview data exposed | Observed production gate |

## Role and tier decisions requiring enforcement

| Capability | Visitor | Free member | Pro/Pro+ | Moderator | Administrator | Enforcement evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Browse public racing/community/marketplace | Intended | Intended | Intended | Intended | Intended | Public browse observed |
| Create community content | Sign in required | Intended by product | Intended | Moderation scope only | Full policy scope | Not proven end-to-end |
| Private messaging and calls | No | Product policy dependent | Intended | Only policy-authorized access | Only policy-authorized access | `CALL-01` partial/blocked |
| Create/manage listings | No | Pricing says unavailable | Intended | Moderation only | Administration | `MK-03` partial, `MK-06` pending |
| AI agent execution | No | Pricing/agents gate | Intended by agent/tier | Moderator agent only where allowed | Intended | Not proven end-to-end |
| Account/team mutations | No | Own account/team role | Own account/team role | No implicit account ownership | Audited support scope | Not proven end-to-end |
| Administrative mutations | No | No | No | Allowlisted subset | Allowlisted full scope | Demo only; real matrix untested |
| Design Lab state switching | Production no | Isolated reviewer only | Isolated reviewer only | Denied outside isolated demo | Exact flag + admin required outside isolated demo | Source/policy matrix tested; isolated IAM open |

## Security trace cross-references

Statuses below are copied from the dated execution ledger and are not upgraded by this document:

| Trace | Status | Permission relevance |
| --- | --- | --- |
| `AUTH-01` | Partial / blocked | Authentication redirect, callback and session boundary |
| `FRIEND-01` | Partial | Visibility, friendship, block and pagination policy |
| `CHAT-01` | Partial | Conversation eligibility and private-message UI |
| `CALL-01` | Partial / blocked | Call participant authorization and permissions |
| `MEDIA-01` | Partial / blocked | Upload ownership, signatures and quarantine |
| `MK-03` | Partial | Listing browse/save/ownership foundation |
| `MK-06` | Pending | Seller workspace and lifecycle permissions |
| `BILL-01` / `BILL-02` | Pending | Billing ledger and checkout trust boundary |
| `OPS-01` | Pending / blocked | Authenticated staging load and RLS evidence |
| `REL-01` | Partial | Release/security gate |

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| PERM-01 | Gap | Product engineering | All 97 screen cells have exact source/policy rules, but exhaustive action × role × tier × ownership × feature-flag enforcement is not yet proven | Endpoint/action matrix linked to server checks, object-level policies and denied-role tests |
| PERM-02 | Gap | Product engineering | Moderator versus administrator mutations are not proven with real identities | Staging E2E showing allowed moderator action, denied administrator-only action, audited administrator action and self-lockout protections |
| PERM-03 | Gap | Product engineering | Page-level source guards are mapped, but the remaining protected APIs/RSC payloads lack exhaustive negative request evidence | Negative API/RSC tests for signed-out, blocked, private and missing-resource requests |
| PERM-04 | Gap | Product engineering | Account/team ownership and last-owner rules are not mapped | Ownership transfer, invitation, removal, last-owner/admin and least-privilege tests |
| PERM-05 | Gap | Product engineering | The six-route Design Lab source/policy gate is tested, but isolated service IAM/secrets have no deployment proof | `CLOUD-01` evidence: isolated revision, no production secrets/data/jobs, explicit access policy and smoke results |
