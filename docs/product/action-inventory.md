# GreyhoundIQ action inventory

Status: 97/97 screen action cells contract-complete; runtime journeys incomplete  
Snapshot: 2026-07-14 AEST  
Owner: Product engineering

## Evidence rule

“Observed” means the control was rendered or its link/form contract was read in production without submission. It does not prove the destination API, server authorization, mutation result, analytics event or audit log.

“Verified source contract” means the complete page-owned action inventory, destination, query enforcement and runnable source assertions agree. It does not claim a hydrated browser submission, mutation result, authorization decision or production deployment.

The managed registry block below is checked by `npm run docs:check`. Complete claims have strict tested/verified/excluded evidence; Captured only remains open.

## Machine-readable completeness boundary

`src/components/demo-experience-registry.ts` is the authoritative screen-to-action index. It currently maps all 97 registered screen cells to 431 route-scoped action entries: 87 production action contracts, four tested zero-action exclusions with an owner and reason, and six source-mapped Design Lab manifests. Stable ids are unique within each route; repeated ids on a legacy redirect and its canonical destination intentionally describe the same canonical control surface.

The focused action-inventory test compares every registered page's recursive local import closure with its action contract, zero-action exclusion or Design Lab manifest. This completes inventory and source mapping only. It does not prove hydrated execution, pending, success, failure or permission-denied behavior, server authorization, mutation results, analytics or audit events, accessibility, current browser-audit freshness, deployed parity or production readiness.

<!-- design-lab-actions-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-actions-counter:end -->

## Global navigation actions

| Surface | Action | Result | Responsive exposure | Status |
| --- | --- | --- | --- | --- |
| `SiteHeader` | Open home | `/` | All widths | Observed |
| `SiteHeader` | Search races, tracks or runners | GET `/races?q=…&sort=relevance` | Desktop; compact menu contains the same search | Observed, not submitted |
| Desktop primary navigation | Open Home, Races, Results, Tracks, Dogs, Breeding, Agents, Marketplace, Groups, Feed, Discover, Pulse, Pricing | Internal same-tab navigation | Full header at 1280px in crawl | Observed |
| Compact navigation | Open product/community routes, Log in or Go Pro | Internal same-tab navigation | 390px, 820px and 1024px | Observed |
| Desktop footer | Open product, About, Pricing, Contact, Privacy, Terms and Responsible use | Internal navigation; Responsible use is `/terms#responsible-use` | Desktop | Observed |
| Compact footer | Open Races, Marketplace, Pulse, Privacy and Terms | Internal navigation | Phone/tablet | Observed; About and Contact absent |
| Cookie preference region | Accept or Decline optional analytics | Client preference change | Public pages while undecided | Control observed; result not tested |

## Production-observed page actions

| Route | Action | Visible result or destination | Trust boundary | Status |
| --- | --- | --- | --- | --- |
| `/` | View today’s races | `#races` | Public | Observed |
| `/` | See pricing | `/pricing` | Public | Observed |
| `/` | Explore form / predictions / breeding / statistics | `/dogs`, `/agents`, `/breeding`, `/statistics` | Public | Observed |
| `/` | Open meeting, race, latest or next race | Dynamic track/race route | Public data | Observed; representative links checked |
| `/races` | Search; select/all dates; date jump; filter state/status; sort | GET `/races` with allowlisted query state | Public query boundary | Verified source contract; browser submission not claimed |
| `/races` | Open race, replay, next-to-go race or track | `/races/[id]`, `/tracks/[id]` | Public data | Verified source contract; representative route rendering only |
| `/races/[id]` | Open previous or next race in the meeting; return to the original filtered list and meeting section | `/races/[id]?from…`, `/races?date=…&state=…&q=…&status=…&sort=…#meeting-…` | Public data | Verified bounded same-origin context contract; exact pixel scroll, focus and browser-history restoration remain separate runtime concerns |
| `/results` | Filter by order/date/track; clear filters | GET `/results` with allowlisted loaded values | Public query boundary | Verified source contract; browser submission not claimed |
| `/results` | Open race or dog | `/races/[id]`, `/dogs/[id]` | Public data | Verified source contract; representative route rendering only |
| `/tracks` | Filter by state | GET `/tracks` with an Australian-state allowlist | Public query boundary | Verified source contract; browser submission not claimed |
| `/tracks` | Open track or race | `/tracks/[id]`, `/races/[id]` | Public data | Verified source contract; representative route rendering only |
| `/dogs` | Search for a greyhound | Client search control | Public/API boundary unknown from UI evidence | Observed; endpoint not asserted |
| `/discover` | Search people, pages, businesses or dogs; open visible actor or dog | GET `/discover?q=…`, `/p/[handle]`, `/dogs/[id]` | Public visibility rules | Verified source contract; permissions remain separately open |
| `/groups` | Open group/thread, marketplace or start-thread entry | Group/thread route | Public/auth boundary | Public links observed; creation untested |
| `/marketplace` | Search/filter | GET `/marketplace` | Public query boundary | Observed, not submitted |
| `/marketplace` | Open item or create-item entry | Detail/new route | Public/auth boundary | Observed |
| `/marketplace/new` | Sign in | `/sign-in` | Authentication | Observed |
| `/pricing` | Start Free | `/sign-in?plan=free` | Authentication intent | Observed; safe return untested |
| `/pricing` | Go Pro / Pay yearly | POST `/api/billing/checkout` | Billing mutation | Form observed; deliberately not submitted |
| `/agents` | Choose Race Analyst, Breeding Advisor or Form Reader; preview run | Client interaction/agent boundary | Tier, auth and AI execution | Controls observed; handlers and endpoints not asserted |
| `/feed` | Sign in or view plans | `/sign-in`, `/pricing` | Authentication/tier | Observed empty signed-out state |
| `/pulse` | Sign in | `/sign-in` | Authentication/private data | Observed |
| `/account` | Sign in | `/sign-in` | Authentication/private data | Observed |
| Standard 404 | Back to home / Search dogs | `/`, `/dogs` | Public recovery | Observed |

## Expected action areas not yet evidenced product-wide

| Area | Examples | Current status | Related trace |
| --- | --- | --- | --- |
| Feed | create/edit/delete post; react/comment/save/share/hide | Route/API foundations exist; product-wide interaction proof absent | `FEED-01` pending |
| Friendship/privacy | request/accept/decline/cancel/remove/follow/block/report | Service foundations exist; complete role/privacy matrix absent | `FRIEND-01` partial |
| Messaging/calls | send/retry/edit/delete/reaction/read/call/device/permission/reconnect | UI/service foundations exist; two-browser proof absent | `CHAT-01`, `CALL-01` partial |
| Marketplace seller | draft/publish/edit/unpublish/archive/sold/delete/media/evidence | Partial public foundation; owner lifecycle not proven | `MK-03` partial, `MK-06` pending |
| Account/team | profile/privacy/security/notifications/billing/team/delete/export/support | Routes exist; mutation registry and authenticated journeys absent | `AUTH-01`, `REL-01` partial |
| Administration | queue filters and audited allowlisted mutations | All screen action cells have source-bound contracts; request-level signed-out/member/moderator/admin denial and hydrated mutation transitions remain unverified | `OPS-01`, `REL-01` blocked/partial |
| AI | run/history/cancel and protected mutations | Route and APIs exist; tier/run-state E2E absent | No completed trace |

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| ACTION-01 | Gap | Product engineering | All 97 screen action cells have strict source/test/exclusion evidence, but that registry does not prove hydrated pending, success, failure or denial behavior | Authenticated staging journeys linked to each mutating action and representative GET/navigation controls |
| ACTION-02 | Gap | Product engineering | Public DOM evidence cannot prove server handlers or authorization | Route/API tests and staging E2E linked to each mutating control |
| ACTION-03 | Gap | Product engineering | Disabled “Coming soon” remains on pricing and preview controls exist without completion evidence | Implemented result or explicit exclusion with owner, reason and non-interactive presentation |
| ACTION-04 | Gap | Product engineering | Responsive navigation loses About and Contact from global phone/tablet access | Mobile/tablet browser evidence that all required company/legal destinations remain reachable |
