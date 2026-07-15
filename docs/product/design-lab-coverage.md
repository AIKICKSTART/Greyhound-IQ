# GreyhoundIQ Design Lab coverage

Status: all visual routes registered; contract depth incomplete  
Snapshot: 2026-07-15 AEST  
Owner: Product engineering

## Source of truth

`src/components/demo-experience-registry.ts` owns the 91 screen contracts, including 84 production-enabled screens. `src/components/master-audit-requirements.ts` merges the immutable 1,027-item product prompt extraction and 2,288-item security prompt extraction with the separate evidence overlay. `src/components/demo-experience-registry.test.ts` proves that the route list matches `src/app/**/page.tsx`; the master-requirement tests prove stable IDs, section coverage and evidence rules.

## Checklist snapshot

The blocks below are checked directly against the machine registries by `npm run docs:check`. Completed means the strict evidence rule passed; Captured and Partially verified items remain open. Output-existence requirements prove only that their named durable outputs exist. The working tree is not a release attestation: source-bound audit artifacts must be regenerated after source changes, and `npm run check:design-lab-release -- --require-ready` must remain fail-closed until every requirement and exact-candidate integrity check passes.

<!-- design-lab-live-counters:start -->
| Gate slice | Complete | Total | Open |
| --- | ---: | ---: | ---: |
| Aggregate production gate | 3724 | 4271 | 547 |
| Screen contracts | 873 | 873 | 0 |
| Master requirements | 2819 | 3315 | 496 |
| Product master requirements | 958 | 1027 | 69 |
| Security master requirements | 1861 | 2288 | 427 |
| Pre-production requirements | 5 | 61 | 56 |
| Database operation contracts | 27 | 27 | 0 |
<!-- design-lab-live-counters:end -->

<!-- design-lab-screen-counters:start -->
| Coverage area | Total | Complete | Captured only | Blocked | Open |
| --- | ---: | ---: | ---: | ---: | ---: |
| Route | 97 | 97 | 0 | 0 | 0 |
| User Stories | 97 | 97 | 0 | 0 | 0 |
| Actions | 97 | 97 | 0 | 0 | 0 |
| Forms | 97 | 97 | 0 | 0 | 0 |
| Permissions | 97 | 97 | 0 | 0 | 0 |
| States | 97 | 97 | 0 | 0 | 0 |
| Design Lab | 97 | 97 | 0 | 0 | 0 |
| Onboarding | 97 | 97 | 0 | 0 | 0 |
| Tests | 97 | 97 | 0 | 0 | 0 |
<!-- design-lab-screen-counters:end -->

## Existing review evidence

| Evidence pack | Count | What it proves | What it does not prove |
| --- | ---: | --- | --- |
| App templates × docks × devices | 108 frames | Deterministic review matrix and selected visual variants | All 90 product screens or states |
| Role blueprints | 72 frames | Four role blueprints across templates/devices | Real authorization or data privacy |
| Marketplace templates | 18 frames | Six marketplace layouts across devices | Seller lifecycle, save/enquiry or production data safety |
| Live demo route audit | 90/90 passed against the current source binding | Every registered route returned 200 with main/H1 under the isolated demo header | Production deployment parity, authenticated authorization or mutation safety |
| Design Lab HTTP scenarios | 13/13 passed against the current source binding | The registered HTTP scenario set rendered successfully | Hydrated interaction or production behavior |
| Hydrated Design Lab core | 24/24 passed against the current source binding | Core and scenario-control browser cases completed, including the synthetic state simulator | Production data, production mutations or release approval |
| Hydrated Design Lab wave 2 | 55/55 passed against the current source binding | The expanded hydrated review cases completed | Every production user journey or privileged identity |
| Responsive workspace audit | 136/136 passed across 17 widths and eight representative surfaces | The current representative responsive matrix completed | Responsive proof for every state of all 90 production screens |
| Current registry test | 91 routes | Route tree and registry agree; checklist exists | Browser execution for every contract dimension |
| Focused action/form contracts | 91/91 screen cells | Every production interaction route now has an exact source-bound action/form contract or route-specific exclusion; the final admin batch expands 21 page callsite sets into exactly 39 referenced shared forms, while `/account/appearance` owns one GET-only URL preview form | Hydrated browser success, validation-error and authorization-denial transitions; `/account/appearance` persistence and default production availability are explicitly not claimed |
| Focused permission contracts | 91/91 screens | Every registered route has an exact source/policy contract for its public, member, owner, tier, moderator, administrator or Design Lab access decision; the production-disabled `/account/appearance` preview now also fails closed behind authenticated identity if enabled | Source-static evidence only; staging identities, deployed IAM, cross-role database proof and product-wide object/field filtering remain separate gates |
| Focused state contracts | 84/84 production screens plus 6/6 Design Lab screens | Every registered route has an exact source-bound state inventory covering its implemented loading, empty/first-use, populated, default, recoverable-error, missing, signed-out, private, blocked, disabled or read-only paths | Selectable production-route browser fixtures, offline and mutation transitions, hard-404 HTTP behavior and deployed-runtime parity remain separate gates |

## Production parity snapshot

| Measure | Count | Status |
| --- | ---: | --- |
| Local visual routes | 91 | Registered |
| Production-reachable public route patterns | 26 | Observed |
| Production unique internal destinations checked | 1,026 | All 200 in safe bulk pass |
| Design Lab route contracts | 91 | Present; all 84 production-enabled screens have a unique default fixture and screen-explorer entry point |
| Production-enabled Design Lab routes | 0 by contract | Production `/design-lab` observed 404/noindex |
| Route-level state inventories | 61 production source contracts plus 6 Design Lab contracts | Production-route browser fixture expansion remains open |
| Onboarding step fixtures | 0 documented | Gap |

## Safety contract

Design Lab routes are `noindex`, production-disabled unless explicitly enabled, and use review fixtures. The production root returned 404/noindex for `/design-lab`. This observation does not prove every Design Lab action is unable to mutate production; that requires negative mutation tests and isolated-service environment evidence linked to `CLOUD-01`.

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| DLAB-01 | Partial | Product engineering | Current source-bound route and browser audits pass locally; immutable candidate and CI binding remain open | Repeat the 90/90 route, 13/13 HTTP, 24/24 hydrated-core, 55/55 wave-two and 136/136 responsive audits against the approved candidate |
| DLAB-02 | Gap | Product engineering | Action and form screen cells are complete; 25 permission, 23 state and 81 onboarding cells remain open | Contract-depth gate that fails for missing permission, state and onboarding fixtures plus runtime interaction evidence |
| DLAB-03 | Partial | Product engineering | Allowlisted selector URL state, copy/reload and invalid-value fallback are locally tested | Bind the same tests to the immutable release candidate without expanding the simulator into a production-data claim |
| DLAB-04 | Gap | Product engineering | Production mutation isolation is contractual, not exhaustively tested | Negative tests proving Design Lab cannot call production mutation endpoints or use production secrets/data |
| DLAB-05 | Partial | Product engineering | The 136-case representative responsive matrix passes; full accessibility/state coverage is not tied to every production screen | Explicit per-screen coverage or justified exclusions for the remaining production states |
