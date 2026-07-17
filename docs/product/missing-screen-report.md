# GreyhoundIQ missing-screen report

Status: incomplete; route presence is not screen completeness  
Review snapshot: 2026-07-14 AEST  
Owner: Product engineering

## Registered baseline

`src/components/demo-experience-registry.ts` currently registers 90 screens across public, racing, community, Marketplace, account, administration, AI and Design Lab families. The route-tree test proves those page routes exist in source. The last local route audit rendered all 90, but its source fingerprint must be refreshed after current source changes.

## Missing or incomplete screen classes

- Authentication callback recovery exists locally; successful, cancelled, expired and provider-failure journeys still need immutable staging evidence.
- Billing return, payment failure and entitlement-processing system states are not complete as screen contracts.
- Marketplace seller edit, manage, inventory, enquiries, drafts, archive, unavailable, verification, ownership and media-management journeys remain incomplete.
- Account page creation, transfer/deletion, team invitations, support flows and export/deletion progress need complete screen stories and negative states.
- Design Lab exposes the route registry, but most production screens still lack action, form, permission, state, onboarding and interaction-test evidence.
- Production parity for locally added or repaired screens remains unverified until deployment and recrawl.

## Closure criteria

Every required system and product screen must have one authoritative screen contract, a reachable route or explicit exclusion, actor and permission rules, default/loading/empty/error/private/not-found states, responsive and accessibility evidence, Design Lab fixtures, and user-story tests. This report records the gap; it does not close those implementation gates.
