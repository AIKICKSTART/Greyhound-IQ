# GreyhoundIQ product audit report

Status: incomplete; foundational inventory established  
Snapshot: 2026-07-15 AEST  
Owner: Product engineering

## Outcome

GreyhoundIQ now has a documented 90-route visual inventory, a 3,315-item Design Lab master checklist, public production crawl evidence and linked matrices for stories, actions, forms, permissions, states and onboarding. This is not a complete product-wide audit and must not be represented as release acceptance.

The following managed block is checked against the live registries by `npm run docs:check`.

<!-- design-lab-live-counters:start -->
| Gate slice | Complete | Total | Open |
| --- | ---: | ---: | ---: |
| Aggregate production gate | 3716 | 4271 | 555 |
| Screen contracts | 873 | 873 | 0 |
| Master requirements | 2811 | 3315 | 504 |
| Product master requirements | 955 | 1027 | 72 |
| Security master requirements | 1856 | 2288 | 432 |
| Pre-production requirements | 5 | 61 | 56 |
| Database operation contracts | 27 | 27 | 0 |
<!-- design-lab-live-counters:end -->

## Evidence summary

| Contract | Evidence | Result | Interpretation |
| --- | --- | --- | --- |
| Visual route registry | `src/components/demo-experience-registry.ts` | 90 routes across 8 families | Implemented and registered |
| Route drift test | `src/components/demo-experience-registry.test.ts` | Route tree equals registry | Route presence tested |
| Atomic master checklist | `src/components/master-audit-requirements.ts` and Design Lab screen map | See the managed live counter block | Output-existence items prove artifact existence only; open controls remain release-blocking |
| Design Lab release gate | Source evaluator plus `npm run check:design-lab-release` | See the managed live counter block; source-bound artifacts must match the exact candidate | Production promotion remains blocked |
| Live demo route audit | `output/demo-route-audit/latest.json` | 90/90 passed against the current source binding | Current local route rendering; production deployment parity remains open |
| Design Lab HTTP scenarios | Source-bound HTTP story artifact | 13/13 passed | Current local HTTP scenarios only |
| Hydrated Design Lab core | Source-bound Playwright artifact | 24/24 passed | Core and scenario-control browser evidence; no production-data or release claim |
| Hydrated Design Lab wave 2 | Source-bound Playwright artifact | 55/55 passed | Expanded local browser evidence; privileged production journeys remain open |
| Responsive workspace | Source-bound Playwright artifact | 136/136 passed across 17 widths and eight representative surfaces | Representative matrix, not every state of all 90 screens |
| Public production link audit | `output/product-audit/production-link-audit.json` | 1,026/1,026 discovered destinations returned 200 | Public links only; exclusions apply |
| User stories | Registry and source-bound browser evidence | 90/90 satisfy the current strict evidence rule | Immutable release-candidate binding remains required |
| Actions | Registry and focused source tests | 90/90 screen cells have strict source-bound contracts or route-specific exclusions; this does not prove hydrated execution, success/error feedback or request-level denial | Contract complete; runtime evidence incomplete |
| Forms | Registry and focused source tests | 90/90 screen cells have strict source-bound contracts or exclusions; the admin operations proof expands 21 page callsite sets into exactly 39 referenced shared forms and the appearance studio is GET-only and non-persistent | Contract complete; browser submission evidence incomplete |
| Permissions | Registry plus focused source/policy tests | 90/90 complete at the screen-contract level, including fail-closed authentication for the production-disabled appearance preview when enabled | Source-static complete; deployed IAM, staging identities and cross-role/object-level runtime proof remain open |
| States | Registry plus focused source tests | 90/90 complete at the screen-contract level: 84 production-route inventories plus six Design Lab contracts | Source-static complete; selectable production fixtures, offline/mutation transitions, hard-404 behavior and deployed parity remain open |
| Onboarding | Registry | 9/90 complete legacy-route exclusions; canonical onboarding remains open | Incomplete |

## Material production findings

- Plain HTTP redirects to unreachable HTTPS port 8080.
- Apex and `www` both serve 200 without canonical-host redirection.
- Production authentication callback failures return JSON 500 and auth reaches a staging-named AuthKit host. The local application now has a noindex, allowlisted recovery screen with a safe support reference; deployment and successful-auth evidence remain open.
- Production `/responsible-use` is absent. The local page, footer navigation, canonical metadata and contract test are implemented but not deployed.
- Production missing Marketplace/group/thread records are soft 404s. Local signed-out public misses now return true 404s; authenticated Marketplace misses remain an explicit authorization-sensitive gap.
- Production compact navigation omits About and Contact and retains an open drawer after desktop expansion. The local header/dock destinations and breakpoint closure are implemented and tested, pending deployment parity evidence.
- Pricing/breeding retain explicit “Coming soon”/future-shipping surfaces.

## Security and release trace status

The dated ledger [`full-task-status-20260712.md`](../../output/orchestration/full-task-status-20260712.md) remains authoritative for these trace IDs. Public UI evidence does not close them.

| Trace | Dated status | Audit impact |
| --- | --- | --- |
| `AUTH-01` | Partial / blocked | Safe auth return and real session evidence open |
| `FRIEND-01` | Partial | Visibility/block matrix open |
| `CHAT-01` | Partial | Private messaging journey open |
| `CALL-01` | Partial / blocked | Call authorization/provider evidence open |
| `MEDIA-01` | Partial / blocked | Upload/scanning/ownership evidence open |
| `MK-03` | Partial | Marketplace public foundation only |
| `MK-06` | Pending | Seller workspace/lifecycle absent |
| `FEED-01` | Pending | Sponsored cadence/preference absent |
| `BILL-01` / `BILL-02` | Pending | Ledger/checkout acceptance absent |
| `OPS-01` / `OPS-02` | Pending / blocked | Authenticated load, restore and compliance evidence absent |
| `CLOUD-01` | Partial | Isolated Design Lab deployment not proven |
| `REL-01` | Partial | No release acceptance |

## Authoritative outputs

- [Route inventory](route-inventory.md)
- [User-story matrix](user-story-matrix.md)
- [Action inventory](action-inventory.md)
- [Form and field registry](form-field-registry.md)
- [Permissions matrix](permissions-matrix.md)
- [State matrix](state-matrix.md)
- [Onboarding map](onboarding-map.md)
- [Design Lab coverage](design-lab-coverage.md)
- [Broken-link report](broken-link-report.md)
- [Missing-screen report](missing-screen-report.md)
- [Missing-action report](missing-action-report.md)
- [Accessibility audit](accessibility-audit.md)
- [Responsive audit](responsive-audit.md)
- [Production parity](production-parity.md)
- [Product-audit documentation authority](documentation-authority.md)
- [Machine-readable production link audit](../../output/product-audit/production-link-audit.json)

## Consolidated gap register

| Area | Gap IDs | Owner | Acceptance evidence needed |
| --- | --- | --- | --- |
| Routes/system screens | `ROUTE-01`–`ROUTE-05` | Product engineering | Required route decision, callback/system screen registry, hard-404 and deep-link tests |
| User stories | `STORY-01`–`STORY-04` | Product engineering | Per-screen story contracts and E2E trace IDs |
| Actions | `ACTION-01`–`ACTION-04` | Product engineering | Handler/destination/feedback/permission registry and tests |
| Forms/fields | `FORM-01`–`FORM-04` | Product engineering | Complete form registry, validation/persistence/privacy and billing security tests |
| Permissions | `PERM-01`–`PERM-05` | Product engineering | Route/action/role/tier/ownership matrix with negative server tests |
| States | `STATE-01`–`STATE-05` | Product engineering | Applicable state fixtures, recovery actions and hard-404 consistency |
| Onboarding | `ONBOARD-01`–`ONBOARD-05` | Product engineering | Versioned tours, persistence, semantic targets and accessible responsive E2E |
| Design Lab | `DLAB-01`–`DLAB-05` | Product engineering | Fresh 90-route audit, contract-depth gate and isolation evidence |
| Production | `PROD-HOST-01`, `PROD-SEO-01`, `PROD-AUTH-01`, `PROD-ROUTE-01`, `PROD-STATE-01`, `PROD-NAV-01`, `PROD-CONTENT-01` | Product engineering | Host/auth/route/state/navigation/content corrections with automated evidence |

## Acceptance sequence

1. Correct host, callback, missing-record and compact-navigation defects; add focused regression tests.
2. Extend the machine screen contract rather than creating parallel registries: actions, forms, fields, permissions, states, onboarding and test IDs.
3. Add synthetic Design Lab fixtures for every applicable contract state and a gate that rejects missing coverage.
4. Run authenticated staging journeys for member, seller, team owner, moderator, administrator and AI user without production mutations.
5. Complete payment, media, call, privacy, restore and isolated Design Lab security gates.
6. Re-run route, interaction, accessibility and responsive automation and publish evidence before release acceptance.

## Completion decision

Completion is **not approved**. The inventory foundation is usable, but the non-negotiable outcome remains open because actions, forms, fields, permission enforcement, state fixtures, onboarding and authenticated/privileged journeys do not yet have complete evidence.
