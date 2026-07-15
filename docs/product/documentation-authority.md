# GreyhoundIQ product-audit documentation authority

Status: canonical ownership map for product-audit documentation  
Updated: 2026-07-15 AEST  
Owner: Product engineering

## Purpose

This file assigns one canonical Markdown owner to each product-audit topic. The machine registries and focused tests remain the authority for live counts and completion status; these documents explain the evidence, scope, gaps and operating decisions. Other documents may link to a canonical owner, but must not maintain a competing copy of its inventory or claim newer evidence without updating the owner.

## Canonical owners

| Authority key | Master requirement | Canonical document | Primary machine authority |
| --- | --- | --- | --- |
| `route` | `DOC.PATH.route` | [`route-inventory.md`](route-inventory.md) | `src/components/demo-experience-registry.ts` |
| `stories` | `DOC.PATH.stories` | [`user-story-matrix.md`](user-story-matrix.md) | `src/components/demo-experience-registry.ts` and focused story contracts |
| `actions` | `DOC.PATH.actions` | [`action-inventory.md`](action-inventory.md) | `src/components/screen-contracts/production-screen-coverage.ts` |
| `forms` | `DOC.PATH.forms` | [`form-field-registry.md`](form-field-registry.md) | production interaction contracts and source audits |
| `permissions` | `DOC.PATH.permissions` | [`permissions-matrix.md`](permissions-matrix.md) | screen permission and access-state contracts |
| `states` | `DOC.PATH.states` | [`state-matrix.md`](state-matrix.md) | production screen-state contracts |
| `onboarding` | `DOC.PATH.onboarding` | [`onboarding-map.md`](onboarding-map.md) | onboarding route-tour registries |
| `design-lab` | `DOC.PATH.design-lab` | [`design-lab-coverage.md`](design-lab-coverage.md) | Design Lab screen registry and release gate |
| `parity` | `DOC.PATH.parity` | [`production-parity.md`](production-parity.md) | dated read-only production crawl plus current local registry |
| `final` | `DOC.PATH.final` | [`final-audit-report.md`](final-audit-report.md) | aggregate master and release-gate registries |

## Non-duplication rules

- Update the canonical owner when evidence changes; link to it from summaries instead of copying its tables.
- Preserve dates and scope on production, browser, database and deployment evidence. A historical observation must not be rewritten as a current runtime claim.
- Keep live counters inside their generated marker blocks. Do not hand-maintain a second total elsewhere.
- Domain documents such as advertising, architecture and security may own their specialist design, but must link back to the relevant product-audit owner for route, action, form, permission, state, onboarding or parity status.
- If ownership changes, update this map, the relevant `DOC.PATH.*` evidence and the documentation checker in the same change.

## Verification boundary

The focused authority test proves unique canonical ownership, required paths, the parity report’s historical/current distinction and the final report link. It does not prove that prose outside this managed product-audit set contains no repeated sentences, that browser evidence is current, or that GreyhoundIQ is production-ready.
