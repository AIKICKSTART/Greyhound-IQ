# GreyhoundIQ production parity audit

Status: public production surface observed; authenticated and mutation parity excluded  
Crawl date: 2026-07-13 AEST  
Owner: Product engineering

Canonical owner: [`documentation-authority.md`](documentation-authority.md) (`DOC.PATH.parity`)

Machine-readable evidence: [`production-link-audit.json`](../../output/product-audit/production-link-audit.json)

## Scope and method

The read-only crawl covered `https://www.greyhoundsiq.com.au`, apex/www HTTPS behavior, both HTTP variants, 26 representative rendered source pages, shared desktop/compact navigation, legal/footer links, dynamic race/dog/track/group/marketplace links, query shapes and missing-record states.

No contact, authentication, billing, search or mutation form was submitted. No production login, private data, payment, call, upload, administrator action or API mutation was attempted.

## Crawl summary

| Measure | Result |
| --- | ---: |
| Reachable route patterns | 26 |
| Representative source pages | 26 |
| Internal edges parsed | 2,448 |
| Unique exact internal destinations checked | 1,026 |
| Successful destination statuses | 1,026 HTTP 200 |
| Bulk-check failures | 0 |
| Sitemap URLs | 65: 15 static and 50 track details |

The 1,026 result excludes `/sign-in`, `/callback` and `/api/*`; those trust boundaries were inspected separately.

## Host behavior

| Request | Result | Status |
| --- | --- | --- |
| `http://greyhoundsiq.com.au/` | 308 to `https://greyhoundsiq.com.au:8080/`, then timeout | Defect |
| `http://www.greyhoundsiq.com.au/` | 308 to `https://www.greyhoundsiq.com.au:8080/`, then timeout | Defect |
| `https://greyhoundsiq.com.au/` | 200 | Live |
| `https://www.greyhoundsiq.com.au/` | 200 | Live |

Both HTTPS hosts serve content without redirecting to one canonical host. Only 3 of 18 tested core pages exposed canonical tags (`/`, `/pricing`, `/dogs`), and those tags point to apex. Sitemap and robots also name apex.

## Reachable patterns

`/`, `/about`, `/agents`, `/breeding`, `/contact`, `/discover`, `/dogs`, `/dogs/[id]`, `/feed`, `/groups`, `/groups/[slug]`, `/groups/threads/[id]`, `/marketplace`, `/marketplace/[id]`, `/marketplace/new`, `/pricing`, `/privacy`, `/pulse`, `/races`, `/races/[id]`, `/results`, `/sign-in`, `/statistics`, `/terms`, `/tracks`, `/tracks/[id]`

All have matching local visual or redirect routes. Local also contains authenticated, admin and Design Lab routes not reachable from the signed-out public crawl.

## Alias parity

| Production alias | Destination | Status |
| --- | --- | ---: |
| `/forum` and descendants | `/groups` equivalents | 308 |
| `/messages` and descendants | `/pulse` equivalents | 308 |
| `/listings` and descendants | `/marketplace` equivalents | 308 |

## Public content/state parity

| Product area | Production observation | Local/Design Lab registration | Gap |
| --- | --- | --- | --- |
| Home | Hero, feature CTAs, today’s meetings, dynamic race/track links, live/upcoming/resulted labels | `/` registered | Transient data structure observed; fixture/state parity not exhaustively compared |
| Racing | Search/date/state/status/sort, next-to-go, track groups and detail links | Ten routes registered, including the stored `/meetings/[id]` detail resource | The 2026-07-13 production crawl did not expose a meeting-detail route; browser parity remains untested |
| Results | Populated results with race/dog links and filter selects | `/results` registered | No-data/correction/source-conflict fixtures unverified |
| Tracks | 50 active venues, state filter, race links and track detail | List/detail registered | Complete production snapshot parity unverified |
| Dogs | Search control and representative detail links | List/detail registered | Search result/unknown dog/missing breeding states unverified |
| Breeding | Current sire data plus explicit Phase 2/“Shipping in 6-8 weeks” content | `/breeding` registered | Placeholder product claims conflict with completion rule |
| Statistics | Box rates, trainer leaderboard and track records | `/statistics` registered | Source/update/missing/zero/conflict fixtures unverified |
| Community | Feed empty state, public groups/threads, discover first-use, Pulse auth gate | Fifteen routes registered | Authenticated create/react/message/call/privacy states untested |
| Marketplace | Three public items, search/category filter, detail and auth-gated creation | Six routes registered | Ownership, save/enquiry, status and media lifecycle untested |
| AI | Agent descriptions, preview controls and Pro+ explanation | `/agents` registered | Run/history/cancel/failure states untested |
| Account/admin | Signed-out account screen; admin client redirects to AuthKit | Routes registered | Server-side auth/noindex and real role enforcement untested |
| Design Lab | Production route is 404/noindex | Six local review routes registered | Isolated deployment/IAM evidence open |

## Forms and actions at trust boundaries

Observed GET forms: global race search; race search/date/state/status/sort; results order/date/track; track state; discover query; marketplace query/category. The pricing page renders POST checkout forms with hidden `plan` and `interval` values targeting `/api/billing/checkout`.

Those forms were not submitted. UI evidence does not prove query validation, endpoint existence, server-owned pricing, authentication, authorization, idempotency, analytics or audit logging. See [form and field registry](form-field-registry.md), [action inventory](action-inventory.md) and [permissions matrix](permissions-matrix.md).

## Responsive and navigation findings

| Width | Navigation | Footer | Page overflow |
| ---: | --- | --- | --- |
| 390 | Compact menu | Races, Marketplace, Pulse, Privacy, Terms | None on ten representative screens |
| 820 | Compact menu | Same reduced footer | No global issue observed |
| 1024 | Compact menu | Reduced footer | Homepage no overflow |
| 1280 | Full header navigation/search/auth actions | Full product/company/legal footer | Homepage no overflow |

Production currently omits About and Contact from compact global navigation, and an open compact menu survives expansion to desktop. The local application now includes both destinations in mobile/tablet navigation and the signed-in dock, and closes the portalled menu at the desktop breakpoint. Wide statistics/race tables and schedule rails were contained in horizontal scroll regions at 390px.

## Defects

| Gap ID | Production evidence | Owner | Acceptance evidence needed |
| --- | --- | --- | --- |
| PROD-HOST-01 | HTTP redirects to unreachable port 8080 | Product engineering | Four-host automated redirect test proving one canonical HTTPS destination without nonstandard port |
| PROD-SEO-01 | Both HTTPS hosts return 200; most core pages lack canonical tags | Product engineering | Canonical-host redirect and metadata test across public routes |
| PROD-AUTH-01 | Production `/callback` returns HTTP 500 JSON and auth ends on a staging-named AuthKit host. Local callback failures now redirect to a noindex, allowlisted recovery screen with a safe reference. | Product engineering | Deploy the local recovery route, correct the production identity host, and capture success/cancel/expire/failure/retry browser evidence. |
| PROD-ROUTE-01 | Production `/responsible-use` is 404; the local application now has a registered, linked and tested standalone page. | Product engineering | Deploy and re-crawl `/responsible-use` with its footer entry and canonical metadata. |
| PROD-STATE-01 | Production Marketplace/group missing records are soft 404s. Local signed-out public group/thread/listing misses now return true 404s; authenticated Marketplace misses remain streamed to preserve private owner/moderator access without record enumeration. | Product engineering | Deploy and re-crawl public misses; design an authenticated pre-stream authorization check and prove owner/moderator/private behavior before closing. |
| PROD-NAV-01 | Production compact navigation omits About/Contact and retains an open drawer after resize. Local mobile/tablet/header/dock navigation and breakpoint closure are implemented and tested. | Product engineering | Deploy, then repeat phone/tablet/orientation browser tests against production. |
| PROD-CONTENT-01 | Pricing exposes disabled “Coming soon”; breeding exposes Phase 2/“Shipping in 6-8 weeks” | Product engineering | Implemented destination or approved exclusion with owner/reason and non-interactive truthful copy |

## Explicit exclusions

| Exclusion | Reason | Required future evidence |
| --- | --- | --- |
| Authenticated/public-private parity | No staging credentials or private-data authority in crawl | Two staging identities across visitor/member/blocked/private states |
| Billing execution | Financial side effects were outside safe read-only scope | Staging checkout/return/failure/webhook/idempotency evidence |
| Contact/support submission | External message creation was not authorized | Staging ticket success/failure/duplicate/accessibility evidence |
| Uploads/calls/media permissions | Device/provider side effects were outside crawl | Two-browser/device staging evidence and security review |
| Admin mutations | Production mutation testing was prohibited | Staging moderator/admin/read-only operator matrix with audit records |
| Full 11-width matrix | Public crawl used representative widths | Automated matrix or justified per-route exclusions |

## Local changes after the dated crawl

The production observations and counts above remain the read-only 2026-07-13 snapshot. On 2026-07-15 the local registry added `/meetings/[id]` with bounded stored meeting, track, race, result and replay projections; explicit loading, missing, empty and populated states; and race-day, track, race and winning-dog navigation. This is local source and pure-helper evidence only. It does not mean the route is deployed, present in production, present in the historical crawl, or covered by a current source-fingerprint-bound browser audit.
