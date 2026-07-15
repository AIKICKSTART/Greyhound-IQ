# GreyhoundIQ route inventory

Status: complete route and screen inventory; interaction, permission, state, and onboarding verification remains separately gated  
Snapshot: 2026-07-13 AEST  
Owner: Product engineering

## Authority and evidence

`src/components/demo-experience-registry.ts` is the machine-readable source of truth for visual routes. This document is a review snapshot, not a second registry. Route drift is checked by `src/components/demo-experience-registry.test.ts`, which compares the registry with `src/app/**/page.tsx`.

Production observations come from the read-only crawl in [`production-link-audit.json`](../../output/product-audit/production-link-audit.json). The crawl proves only the recorded public HTTP and rendered-browser observations. It does not prove authenticated permissions, API authorization or mutation safety.

## Current visual route count

This managed block is checked against the live screen registry by `npm run docs:check`.

<!-- design-lab-route-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-route-counter:end -->

| Family | Registered routes | Registry status |
| --- | ---: | --- |
| Public website | 8 | Implemented and registered |
| Racing intelligence | 9 | Implemented and registered |
| Community and messaging | 15 | Implemented and registered |
| Marketplace | 6 | Implemented and registered |
| Account | 13 | Implemented and registered |
| Administration | 32 | Implemented and registered |
| AI tools | 1 | Implemented and registered |
| Design Lab | 6 | Implemented, noindex and production-disabled by contract |
| **Total** | **90** | Route files and registry agree |

“Implemented and registered” means a `page.tsx` route and contract entry exist. It does not mean every action, state, permission or journey is tested.

## Registered visual routes

### Public website — 8

`/`, `/about`, `/auth/error`, `/contact`, `/pricing`, `/privacy`, `/responsible-use`, `/terms`

### Racing intelligence — 9

`/breeding`, `/dogs`, `/dogs/[id]`, `/races`, `/races/[id]`, `/results`, `/statistics`, `/tracks`, `/tracks/[id]`

### Community and messaging — 15

`/discover`, `/feed`, `/forum`, `/forum/[slug]`, `/forum/threads/[id]`, `/groups`, `/groups/[slug]`, `/groups/threads/[id]`, `/messages`, `/messages/[id]`, `/messages/friends`, `/p/[handle]`, `/pulse`, `/pulse/[id]`, `/pulse/friends`

### Marketplace — 6

`/listings`, `/listings/[id]`, `/listings/new`, `/marketplace`, `/marketplace/[id]`, `/marketplace/new`

### Account — 13

`/account`, `/account/appearance`, `/account/billing`, `/account/notifications`, `/account/pages`, `/account/pages/[id]`, `/account/privacy`, `/account/profile`, `/account/saved-listings`, `/account/security`, `/account/support`, `/account/team`, `/account/usage`

### Administration — 32

`/admin`, `/admin/account-deletion`, `/admin/actions`, `/admin/audit`, `/admin/bespoke`, `/admin/billing`, `/admin/billing-events`, `/admin/bug-reports`, `/admin/compliance`, `/admin/dog-ownership`, `/admin/entitlements`, `/admin/exports`, `/admin/feed`, `/admin/feedback`, `/admin/invitations`, `/admin/invoices`, `/admin/jobs`, `/admin/listings`, `/admin/organizations`, `/admin/page-rules`, `/admin/payments`, `/admin/plans`, `/admin/reports`, `/admin/retention`, `/admin/safety`, `/admin/site-content`, `/admin/source-health`, `/admin/subscriptions`, `/admin/support`, `/admin/usage`, `/admin/users`, `/admin/webhooks`

### AI tools — 1

`/agents`

### Design Lab — 6

`/design-lab`, `/design-lab/demo-experience`, `/design-lab/dock-skins`, `/design-lab/role-blueprints`, `/feed/device-preview`, `/marketplace/design-lab`

## Non-visual and system routes

The 90 count excludes route handlers and boundaries. User-facing non-page contracts still include:

| Contract | Local owner | Production observation | Status |
| --- | --- | --- | --- |
| Sign-in redirect | `src/app/sign-in/route.ts` | Redirects through WorkOS to a staging-named AuthKit host | Observed; security acceptance open |
| Authentication callback | `src/app/callback/route.ts`, `/auth/error` | Production direct/error requests returned HTTP 500 JSON; local failures now redirect no-store to an allowlisted recovery state | Local remediation implemented; deployment and success-flow evidence pending |
| Root loading | `src/app/loading.tsx` | Public async loading states observed resolving on Feed, races and tracks | Partially observed |
| Root recoverable error | `src/app/error.tsx` | Not forced in production | Implemented; untested by crawl |
| Root not found | `src/app/not-found.tsx` | Safe “Off-track” UI with recovery links | Observed and hard-404 for ordinary missing paths |
| Route APIs | `src/app/api/**/route.ts` | Excluded from public crawl | Separate security/API ownership |

## Production-reachable public patterns

The crawl discovered 26 public patterns:

`/`, `/about`, `/agents`, `/breeding`, `/contact`, `/discover`, `/dogs`, `/dogs/[id]`, `/feed`, `/groups`, `/groups/[slug]`, `/groups/threads/[id]`, `/marketplace`, `/marketplace/[id]`, `/marketplace/new`, `/pricing`, `/privacy`, `/pulse`, `/races`, `/races/[id]`, `/results`, `/sign-in`, `/statistics`, `/terms`, `/tracks`, `/tracks/[id]`

The bulk check covered 1,026 unique internal destinations found on 26 representative source pages. All returned HTTP 200. Sign-in, callback and API routes were excluded from that bulk pass and checked separately.

## Production aliases

| Alias | Canonical destination | Production status |
| --- | --- | ---: |
| `/forum` | `/groups` | 308 |
| `/forum/[slug]` | `/groups/[slug]` | 308 |
| `/forum/threads/[id]` | `/groups/threads/[id]` | 308 |
| `/messages` | `/pulse` | 308 |
| `/messages/[id]` | `/pulse/[id]` | 308 |
| `/messages/friends` | `/pulse/friends` | 308 |
| `/listings` | `/marketplace` | 308 |
| `/listings/[id]` | `/marketplace/[id]` | 308 |
| `/listings/new` | `/marketplace/new` | 308 |

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| ROUTE-01 | Local remediation; production pending | Product engineering | `/responsible-use` is registered locally with footer navigation, canonical metadata and a contract test; production still returns 404 | Deploy and re-crawl the page, then attach HTTP, browser and Design Lab fixture evidence |
| ROUTE-02 | Gap | Product engineering | Callback failure is a route-handler JSON 500, not a recoverable screen | Browser evidence for loading, cancelled, expired and provider-failure states with safe retry and support actions |
| ROUTE-03 | Partially remediated | Product engineering | Local signed-out public group/thread/listing misses are guarded before streaming and return true 404s; authenticated Marketplace misses remain soft to avoid leaking private record existence or breaking owner/moderator previews | Add authenticated pre-stream authorization and hard-404 tests for owner, moderator, unrelated member and signed-out actors; deploy and re-crawl |
| ROUTE-04 | Gap | Product engineering | The registry does not inventory callback, billing-return and other route-handler states as screen contracts | One non-duplicated system-screen registry linked to handlers, Design Lab fixtures and tests |
| ROUTE-05 | Gap | Product engineering | Route presence is tested, but deep links, query validation, back/forward context and every entry point are not exhaustively tested | Automated route and browser evidence for each registered entry point, parameter shape and recovery path |
