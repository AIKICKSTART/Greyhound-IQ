# GreyhoundIQ production QA evidence — 2026-07-23

## Outcome

The non-video source and verification work that could be completed safely off the live VPS is complete for this session. The release candidate builds successfully and passes type checking, linting, diff validation and the focused interaction/contract tests listed below. A fresh serial production-route audit passes **97 of 99** registered routes.

This is not a production-complete claim. Two deterministic community-thread fixtures remain absent, the fresh off-VPS recovery-point gate is incomplete, authenticated role and LiveKit end-to-end checks remain outstanding, and the user deferred replay coverage and training-video capture.

No production database write, restore, replacement, restart, image deployment or DNS change was performed during this QA pass. The authoritative VPS database was not reverted or migrated.

## Release-candidate verification

Candidate worktree: `E:\greyhoundiq-replay-release-20260722`

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| Production build | PASS | `APP_ENV=demo`; `DEMO_AUTH_MODE=full-access`; `NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3310/callback`; `npm run build -- --webpack`; 56 static pages generated |
| Whitespace/error-marker validation | PASS | `git diff --check` |
| Route audit | PARTIAL | 97/99 passed; serial concurrency 1; local audit connection pool 4; `output/demo-route-audit/latest.json` and `latest.md` |
| Route-audit source digest | RECORDED | SHA-256 `669a1f3e232f19db9a704937fdcad56632805b8fbf9e18c2f11891d309991afd`; 438 source files; commit base `f9fb87957c68283c6ce162366c13892b3077f9c9` |

The route audit was generated at `2026-07-22T18:41:07.557Z` (`2026-07-23 04:41:07 AEST`). It used serial route execution with a four-connection local audit pool. A preceding one-connection run passed 94/99 but produced P2024 timeouts on `/races`, `/admin` and `/admin/jobs`; all three passed once the audit pool matched their legitimate parallel-query demand. No application or database mutation was used to obtain those passes.

Regenerating Prisma Client from the current schema removed the earlier `Profile.racingDayTrackIds` query failures. The field is absent from the current Prisma schema, while a stale generated client still selected it. This was a local generated-artifact mismatch, not evidence that the database needed to be changed. No column was added or removed.

Focused passing tests cover:

- demo route registry and route metadata;
- screen permission and state contracts;
- public racing interactions and racing onboarding;
- product story capabilities;
- automated source gates;
- product information-understanding inventory: 92 routes and 344 checks;
- non-navigation link inventory: 154 links;
- Design Lab sync, pending-work panel, workspace shell, deployment-race and master-audit logic;
- breeding combobox accessibility;
- replay source selection, provider precedence and forward-only sync behavior;
- race photo-finish image behavior;
- query validation and query performance evidence.

The Design Lab delivery-progress test remains blocked by the absent independent-review evidence file `output/demo-route-audit/design-lab-user-stories-independent-review-final.json`. It was not fabricated.

## Route audit — unresolved 2

| Route | HTTP | Main | H1 | Stream error | Classification / next action |
| --- | ---: | --- | --- | --- | --- |
| `/forum/threads/[id]` | 404 | yes | yes | no | Audit placeholder has no matching seeded thread; replace with an asserted real fixture or explicit not-found contract |
| `/groups/threads/[id]` | 404 | yes | yes | no | Audit placeholder has no matching seeded thread; replace with an asserted real fixture or explicit not-found contract |

The other 97 routes return their required success status, `<main>`, H1 and stream-safe render. This includes `/races`, `/forum`, `/forum/[slug]`, `/groups`, `/groups/[slug]`, every account route, every admin route, and all six Design Lab/device-preview routes. The all-or-nothing master route evidence gate correctly remains closed: an audit with any failed route is invalid and cannot expose a partial passed-route set as release evidence. That fail-closed behavior was retained.

## Source work completed but not deployed

- Restored the server/client boundary for Design Lab pages by serializing server audit state into client components.
- Added pure master-audit completion logic and removed server-only imports from client bundles.
- Added a client-safe admin device-frame definition.
- Added complete `/breeding/cross` and `/vets` route, permission, state, action, onboarding and source-audit contracts. Both routes pass the fresh audit.
- Corrected invalid breeding navigation targets to `/dogs`.
- Restored the meeting loading-state H1.
- Corrected CORS and map CSP evidence.
- Aligned the source-controlled LiveKit configuration with the VPS hostname, private HTTP control plane and intended UDP/TCP ports.
- Added forward-only official replay selection/provider precedence and photo-finish behavior without restoring or downgrading the database.
- Added query-validation and query-performance evidence and widened dog search behavior to match the stated interface contract.
- Updated route inventories to 99 and the dependent exact-count assertions.

These changes are in a dirty release-candidate worktree alongside earlier candidate changes. They have not been committed, pushed or deployed. A clean reviewable candidate and independent review are still required before any VPS release.

## Read-only database evidence

The following catalog/data findings were recorded without mutation:

- 115/115 tables have primary keys.
- 209 foreign keys are valid.
- 579 indexes are present.
- 3 check constraints remain `NOT VALID`.
- 7 foreign keys lack a leading supporting index.
- 40 races have zero distance.
- 635 `FormEntry` records have dog/race identity mismatches.
- 1 duplicate runner group was found.
- Duplicate natural-key groups: Race 12, Meeting 44, RaceVideo 49.
- Pedigree anomalies: one two-node cycle, 1,491 female-labelled sire links, 16,417 male-labelled dam links, one dog with identical sire and dam, 202,626 dogs with neither parent and 224,136 unlinked identities.

These are investigation and forward-repair inputs, not authority to rewrite pedigree or racing history. Exact authoritative identity assertions, a fresh recovery point and rollback/retest evidence are required before production corrections.

## Security and access evidence

- The inspected Stage 11 security catalog reports RLS and `FORCE ROW LEVEL SECURITY` on 114/114 tables with 246 policies.
- The production VPS security catalog has not yet been independently proven equivalent.
- The `Profile` public policy remains a candidate exposure requiring an authenticated/anonymous matrix review.
- Seven `SECURITY DEFINER` routines use `search_path=public` and require hardening review.
- The role taxonomy does not yet have verified coverage for `unverified`, `punter`, `support`, `super-admin` and `disabled` states.
- LiveKit TLS and unauthenticated rejection behavior passed negative checks. Authenticated publish/subscribe, TURN fallback, mobile-network behavior and screen sharing remain unverified.
- The source-controlled LiveKit target is the VPS host with UDP 3478, TCP 7881 and UDP 50000-60000; port 7880 remains private.

No penetration-test claim is made. Intrusive security testing requires a separately confirmed production scope, rate limits and maintenance window.

## Cost evidence

The current compute-and-disk comparison records the Contabo public base at approximately EUR 49 / AUD 79.91 per month, Oracle Cloud at AUD 679.48, Google Cloud at AUD 1,179.25, Azure at AUD 1,228.41 and AWS at AUD 1,405.65 for the compared footprint. The Contabo invoice, location surcharge and currency conversion remain unverified. Network egress, CDN/WAF, object storage, backups, email, observability, TURN traffic, tax and support are excluded and must not be represented as an exact all-in price.

## Remaining blockers and acceptance gates

1. Create and verify a fresh, off-VPS recovery point before any production schema or data write.
2. Replace the two fake community thread audit IDs with deterministic, asserted fixtures or explicitly test the not-found contract.
3. Keep Prisma Client generation mandatory in build/deployment so generated artifacts cannot drift from `prisma/schema.prisma`.
4. Produce a clean release candidate, independent diff review and the missing Design Lab independent-review evidence.
5. Run the authenticated role/permission matrix, including anonymous and disabled users.
6. Complete authenticated LiveKit browser/mobile end-to-end verification.
7. Verify the live VPS security catalog, firewall/container exposure and current scheduler/source-health state.
8. Verify the Contabo invoice/region and calculate the full monthly operating-cost envelope.
9. Complete replay coverage and training-video work only when the user resumes those deferred workstreams.

Until those gates pass, the master ledger must remain conservatively dependency-normalised and the project must not be reported as fully complete.
