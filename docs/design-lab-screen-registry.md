# GreyhoundIQ Design Lab screen registry

Status: current route inventory  
Snapshot: 2026-07-13  
Owner: AI Kick Start delivery team

## Contract

`src/components/demo-experience-registry.ts` is the machine-readable source of truth for visual application routes included in Design Lab review; this document is its human-readable snapshot. A stable screen ID is `screen:<route>`; for example, `/tracks/[id]` is `screen:/tracks/[id]`. Every dynamic contract separately records its pattern and a bracket-free `concreteRoute` sample that must satisfy that pattern. Variant/device/component review IDs continue to use the existing `A1-MOBILE-RACE-NAV` contract.

The inventory is derived from `src/app/**/page.tsx`. It currently contains exactly **90 visual pages**. The route handlers under `src/app/**/route.ts` are non-visual and stay outside screenshot matrices unless they own a user-facing redirect or callback state; API/security tests retain ownership of their request contracts.

## State ownership

Every visual route owner must review these states where they can occur:

1. default populated state;
2. loading/skeleton state;
3. empty or first-use state;
4. recoverable error state;
5. missing-resource/not-found state for dynamic routes;
6. signed-out state for mixed/private routes;
7. forbidden/insufficient-role state for member and admin routes;
8. long-copy, dense-data and narrow-width stress state;
9. keyboard focus, reduced motion and semantic-label state.

The root boundaries at `src/app/loading.tsx`, `src/app/error.tsx` and `src/app/not-found.tsx` own the fallback whenever no closer boundary exists. A route-specific boundary is preferred when recovery language or skeleton geometry materially differs from the root.

| Family | Audience boundary | Local boundary coverage | State owner |
| --- | --- | --- | --- |
| Public website | Public | Root loading/error/not-found | Route page plus root App Router boundary |
| Racing intelligence | Public/member enrichment | Local loading for breeding, dogs detail, races list/detail, results, statistics and tracks list/detail; races has local error and detail not-found | Racing route owner |
| Community and messaging | Mixed public/member | Local loading for discover, Feed, forum and messages; messages list/detail have local errors | Community route owner plus auth/privacy services |
| Marketplace | Public browsing; member mutations | Root boundaries | Marketplace/listing route owner plus listing ownership policy |
| Account | Authenticated member | Root boundaries | Account route owner; signed-out and ownership states are mandatory |
| Administration | Authenticated moderator/administrator | Local admin loading/error plus root not-found | Admin route owner; least privilege, forbidden handling and non-leaking errors are mandatory |
| AI tools | Public/member by feature policy | Root boundaries | Agents route owner |
| Design Lab | Development or explicitly enabled isolated preview | Root boundaries plus production feature gate | Design Lab owner; never production data or secrets |

## Visual route inventory

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

`/account/appearance` is a production-gated, non-persistent review surface. It validates URL-only A1-C2, D1-D6, M1-M6 and sponsored-visibility selections; it does not write an account preference.

### Administration — 32

`/admin`, `/admin/account-deletion`, `/admin/actions`, `/admin/audit`, `/admin/bespoke`, `/admin/billing`, `/admin/billing-events`, `/admin/bug-reports`, `/admin/compliance`, `/admin/dog-ownership`, `/admin/entitlements`, `/admin/exports`, `/admin/feed`, `/admin/feedback`, `/admin/invitations`, `/admin/invoices`, `/admin/jobs`, `/admin/listings`, `/admin/organizations`, `/admin/page-rules`, `/admin/payments`, `/admin/plans`, `/admin/reports`, `/admin/retention`, `/admin/safety`, `/admin/site-content`, `/admin/source-health`, `/admin/subscriptions`, `/admin/support`, `/admin/usage`, `/admin/users`, `/admin/webhooks`

### AI tools — 1

`/agents`

### Design Lab — 6

`/design-lab`, `/design-lab/demo-experience`, `/design-lab/dock-skins`, `/design-lab/role-blueprints`, `/feed/device-preview`, `/marketplace/design-lab`

All six routes are `noindex` and use the shared `requireDesignLabReviewer()` server gate. In production they return not found unless `ENABLE_DEVICE_PREVIEWS=true`; outside the explicitly isolated full-access demo they also require an administrator profile. They use mock/review data only and must not introduce production secrets, background jobs, billing mutations or preference writes. `/design-lab` and `/design-lab/demo-experience` expose the same derived 90-screen contract and completion checklist; dynamic patterns link to a runnable sample or their owning list screen.

## Atomic master-prompt checklist

The Design Lab also renders every requirement from both authoritative prompt extractions:

- 1,027 product and Design Lab requirements across 51 sections;
- 2,288 security, API, database, privacy and release requirements across 138 sections;
- 3,315 total atomic requirements, each with a stable ID, owner, release-blocking flag, status and evidence list.

`src/components/master-audit-evidence.ts` is the only completion overlay. A requirement does not count as complete without durable evidence. Partially verified or merely captured requirements remain release blockers. Temporary risk acceptance counts only for current medium/low risks with every required owner, reason, compensating control, expiry, remediation and retest field; critical/high findings remain blocking. The checklist filters persist as `auditPrompt`, `auditSection`, `auditStatus` and `auditQuery` URL parameters.

## Current route-specific boundaries

- Loading: `/`, `/admin`, `/breeding`, `/discover`, `/dogs/[id]`, `/feed`, `/forum`, `/messages`, `/races`, `/races/[id]`, `/results`, `/statistics`, `/tracks`, `/tracks/[id]`.
- Error: `/`, `/admin`, `/messages`, `/messages/[id]`, `/races`.
- Not found: `/`, `/races/[id]`.

These lists describe current files, not approval. Missing local boundaries remain explicit review gaps until a route demonstrates that the root fallback is sufficient.

## Review matrices

- App templates and docks: `6 app templates × 6 dock skins × 3 devices = 108` frames.
- Role blueprints: `4 roles × 6 app templates × 3 devices = 72` frames.
- Marketplace templates: `6 marketplace templates × 3 devices = 18` frames.

The typed registries are implemented in `src/components/design-lab-review-matrix.ts`: 108, 72 and 18 unique frame IDs with deterministic viewports and review links. Visual design selection is not production release approval. Production promotion remains a separate, server-side, commit-bound gate even when a visual decision has already been recorded.

Do not record a winning template merely because a frame renders. Approval requires the state checklist above, exact asset identity, no overflow, usable touch/focus targets, and an explicit decision record with rejected alternatives.

## Drift check

Use this command before a Design Lab review or release:

```powershell
rg --files src/app -g 'page.tsx' | Sort-Object
```

The automated registry contract test compares `src/app/**/page.tsx` with the machine-readable screen contracts. It also checks dynamic sample-path matching, exact source-file ownership, explicit page-level `robots.index=false` metadata against each `noindex` value, and the Design Lab production-enabled policy. If the count, paths or policies differ, the test fails and this document must be regenerated or updated in the same change. Route handlers remain separately governed by API/security contracts.
