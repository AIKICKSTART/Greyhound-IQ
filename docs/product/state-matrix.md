# GreyhoundIQ screen-state matrix

Status: 61 production source contracts and six Design Lab contracts complete; browser fixture coverage incomplete  
Snapshot: 2026-07-15 AEST  
Owner: Product engineering

## Registry declaration

The managed registry block below is checked by `npm run docs:check`. All six Design Lab routes have tested state evidence and 61 production routes have exact source-verified state inventories; the other 23 routes remain captured only. The full production-route browser, offline, mutation and hard-404 state requirements remain open in the atomic master checklist.

<!-- design-lab-states-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-states-counter:end -->

The earlier blanket names `initial-loading`, `empty`, `recoverable-error` and `offline` are not treated as implemented for every route. The production contracts below count only their named source states and focused assertions.

That declaration is not browser evidence. The 84 source-verified production rows intentionally have no fixture IDs and do not prove offline behavior, mutation transitions, hard-404 HTTP status or a selectable rendered fixture; the six Design Lab rows remain separately governed simulation contracts.

## Source-verified production contracts

| Route | Registered states | Source owners | Evidence status |
| --- | --- | --- | --- |
| `/` | Loading, empty, populated, recoverable error | `src/app/page.tsx`, `src/app/error.tsx` | Verified source contract |
| `/pricing` | Populated, disabled Pro+ CTA, checkout returned, checkout cancelled, billing first-use | `src/app/pricing/page.tsx` | Verified source contract |
| `/races` | Loading, empty, populated, recoverable error | `src/app/races/page.tsx`, local loading/error boundaries | Verified source contract |
| `/races/[id]` | Loading, missing, empty runners, populated, recoverable error | Race detail page plus local loading/not-found and parent error boundaries | Verified source contract; HTTP behavior remains open |
| `/results` | Loading, empty, populated | Results page and local loading boundary | Verified source contract |
| `/tracks` | Loading, empty, populated | Tracks page and local loading boundary | Verified source contract |
| `/tracks/[id]` | Loading, missing, empty results, populated | Track detail page, local loading and root not-found boundaries | Verified source contract; HTTP behavior remains open |
| `/discover` | Loading, first-use, no matches, populated | Discover page and local loading boundary | Verified source contract |
| `/forum` | Loading, empty groups, empty threads, populated | Forum page and local loading boundary | Verified source contract |
| `/messages` | Loading, signed out, empty, populated, recoverable error | Messages page and local loading/error boundaries | Verified source contract |
| `/messages/[id]`, `/messages/friends`, `/pulse`, `/pulse/[id]`, `/pulse/friends` | Loading where applicable; signed out, inaccessible/private thread, blocked-by-me/other, empty, populated and recoverable error states according to route | Canonical Messages pages, their local loading/error boundaries and the thin Pulse aliases | Verified source contract; browser and database-backed cross-role transitions remain open |
| All 32 `/admin` routes | Shared loading plus route-specific empty/populated or default/populated states; bug reports, feedback and support also expose moderator read-only states | Admin page sources and `src/app/admin/loading.tsx` | Verified source contract; browser transitions remain open |
| `/account`, `/account/appearance`, `/account/billing`, `/account/notifications`, `/account/pages`, `/account/pages/[id]`, `/account/privacy`, `/account/profile`, `/account/saved-listings`, `/account/security`, `/account/support`, `/account/team`, `/account/usage`, `/agents` | 43 explicit signed-out, empty, populated, unavailable, missing, disabled, preview and tier-gated source states according to route | Account and agent page sources plus `production-screen-member-access-state-evidence.test.ts` | Verified source contract; browser, database-backed and deployed-role transitions remain open |

## Current route boundaries

| Boundary | Local routes with a dedicated file | Status |
| --- | --- | --- |
| Loading | `/`, `/admin`, `/breeding`, `/discover`, `/dogs/[id]`, `/feed`, `/forum`, `/messages`, `/races`, `/races/[id]`, `/results`, `/statistics`, `/tracks`, `/tracks/[id]` | Implemented for listed routes; root boundary owns the rest |
| Recoverable error | `/`, `/admin`, `/messages`, `/messages/[id]`, `/races` | Implemented for listed routes; recovery behavior not comprehensively tested |
| Not found | `/`, `/races/[id]` | Root 404 observed; dedicated dynamic coverage incomplete |

## Production-observed states

| Route/surface | State | Observation | HTTP behavior | Evidence status |
| --- | --- | --- | --- | --- |
| `/` | Populated/current schedule | Meetings and race cards with live, upcoming and resulted labels | 200 | Observed |
| `/races` | Initial loading → populated | “Loading race cards” resolved to schedule, filters and next-to-go | 200 | Observed |
| `/tracks` | Initial loading → populated | “Loading tracks” resolved to 50 active venues | 200 | Observed |
| `/feed` | Initial loading → signed-out empty | “Loading your feed” resolved to “No feed posts yet” and auth CTAs | 200 | Observed |
| `/groups` | Populated plus local empties | Four groups; groups without threads show explicit empty copy | 200 | Observed |
| `/discover` | First-use | Requires at least two characters before results | 200 | Observed |
| `/pulse` | Authentication required | Private-message explanation and sign-in CTA | 200 | Observed |
| `/account` | Authentication required | Account explanation and sign-in CTA | 200/index-follow | Observed; indexing behavior open |
| `/marketplace/new` | Authentication required | Seller ownership explanation and sign-in CTA | 200 | Observed |
| `/agents` | Subscription/auth explanation | Pro entry explanation, per-agent Pro or Pro+ requirements, disabled unavailable options, and sign-in/pricing CTAs | 200 | Source-tested; render recapture and run-state coverage remain open |
| Ordinary missing path | Missing record | Safe “Off-track” UI, Back home and Search dogs | 404/noindex | Observed |
| Missing race/dog/track ID | Missing record | Standard 404 | 404/noindex | Observed |
| Missing marketplace/group/thread | Missing record | Standard 404 UI | 200; marketplace index-follow | Observed defect |
| `/callback` | Authentication failure | Safe generic JSON error | 500 JSON | Observed; no recovery screen |
| `/design-lab` in production | Feature unavailable | Standard not found | 404/noindex | Observed production gate |

## Required state coverage versus evidence

| State | Registry declaration | Distinct fixture/test evidence |
| --- | --- | --- |
| Default | All 90 | Route/demo render evidence only |
| Initial loading | Nine production contracts plus six Design Lab inventories | Nine production loading states are source-verified; browser transitions remain open |
| Background refresh | Not registered | Gap |
| Skeleton loading | Not distinguished from initial loading | Gap |
| Empty | Applicable per-route only | Route-specific source branches are verified where registered; 23 route cells remain open overall |
| No search results | `/discover` source contract | Source branch verified; browser fixture open |
| Partial/stale/delayed data | Not registered | Gap |
| Recoverable error | Four production contracts | Reset controls source-verified for home, races, race detail and messages; browser recovery open |
| Permission denied | Not registered | Gap |
| Authentication required | Family metadata plus `/messages` signed-out state | Messages source branch verified; broader authenticated journeys open |
| Subscription required | Family metadata only | Agents explanation observed |
| Feature disabled | `/pricing` disabled CTA source contract | Pro+ CTA disabled source state verified; production Design Lab 404 separately observed |
| Private/blocked | Not registered | Gap |
| Deleted/archived/suspended | Not registered | Gap |
| Missing record | Race and track detail source contracts | `notFound()` and boundary UI verified; hard-404/noindex behavior remains open |
| Offline | Design Lab scenario simulator plus broad route declarations | Synthetic Design Lab offline behavior is hydrated; production-route offline behavior remains open |
| Success/optimistic/pending/failed mutation | Populated states plus pricing return states | Source rendering verified only; optimistic/pending/failed mutation fixtures remain open |
| Long text/large volume/missing or broken media | Design Lab scenario simulator | Hydrated synthetic review exists; no complete production-route state matrix |

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| STATE-01 | Gap | Product engineering | 23 route cells still rely on captured default state coverage without a verified route-specific inventory | Per-route supported-state registry with fixture ID and recovery action |
| STATE-02 | Gap | Product engineering | The verified source subset does not close required permission, private, blocked, mutation and data-quality browser states | Design Lab fixtures and component/route tests for every applicable state |
| STATE-03 | Gap | Product engineering | Offline is declared for all routes without evidence | Offline fixture, browser behavior and recovery test for supported routes, or explicit per-route exclusion |
| STATE-04 | Gap | Product engineering | Dynamic missing records do not use consistent HTTP/noindex behavior | Hard-404/noindex tests for race, dog, track, marketplace, group, thread and profile records |
| STATE-05 | Gap | Product engineering | Callback failure is JSON-only and lacks safe recovery | Design Lab and browser evidence for loading, cancelled, expired and provider failure with retry/support |
