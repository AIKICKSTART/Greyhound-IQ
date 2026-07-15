# Release security report

Decision: **BLOCKED — do not promote Design Lab approval to production**
Evidence date: 2026-07-15
Decision owner: GreyhoundIQ security lead and release owner; named individuals required
Candidate commit/image: Not supplied; this is a repository review, not a candidate attestation

## Executive decision

GreyhoundIQ is not approved for production release. Twelve High findings remain release-blocking, no High risk is accepted, the complete endpoint/action/query trace is not verified, live Google Cloud/Supabase/WorkOS/Stripe/Lago/LiveKit/racing-provider configuration was not inspected, and no successful production-like restore test was supplied.

Recent remediation materially reduced risk: administrator-only page guards, sender-safe deletion with durable bounded storage jobs, bounded explicit user export, strict entitlement parsing, typed privileged inputs, transactional last-active-administrator protection, settled/bound Stripe entitlement processing, blocked-conversation Realtime revocation and private-media moderator-bypass removal all have focused source tests. These are **Partially verified**, not release approval, until authorised staging/runtime and complete registry evidence pass against one immutable candidate.

## Scope and method

Evidence used:

- application, server action, route handler, Prisma, migration, test, CI/CD and deployment source in this repository;
- the 2,288-item security master checklist and its current evidence merge;
- machine registries under `security/`;
- focused and full source-test results reported in this workstream;
- OWASP ASVS 5.0.0, OWASP Top 10:2025, OWASP API Security Top 10:2023, NIST SSDF 1.1 and OAIC APP 11/NDB guidance.

Not performed:

- intrusive or destructive production testing;
- live production/staging DB, IAM, network, secret, provider, backup or log inspection;
- extraction of real private data, credentials, sessions or webhook payloads;
- complete browser E2E/accessibility/responsive security journey execution;
- generated SQL capture or representative query-plan review.

## Coverage snapshot

The status block is checked directly against the live security master registry by `npm run docs:check`.

<!-- design-lab-security-status:start -->
| Master security status | Count |
| --- | ---: |
| Verified | 1797 |
| Partially Verified | 6 |
| Not Assessed | 452 |
<!-- design-lab-security-status:end -->

| Metric | Current evidence | Interpretation |
|---|---|---|
| Master security requirements | See the managed live status block; 2,288 total | All are release-blocking in the current master registry |
| Source endpoint inventory | 177 entries: 104 HTTP methods from 83 route files, plus 73 server actions | Structural source discovery passes; deployed-surface parity is Not verified |
| Endpoint authentication coverage | 177 records: 13 Partially verified, 164 Not verified; 163 authentication unknown | Endpoint presence is not security verification |
| Security traces | 9 Partially verified | Far below all user/system actions; trace registry is a seed |
| Database operations | 25 registered: 7 complete gates, 18 open | Completed isolated loopback runtime proofs include normalised SQL, plans and exact runtime-role evidence; representative-volume performance and complete query coverage remain open |
| Current local Design Lab audits | 90/90 routes, 13/13 HTTP scenarios, 24/24 hydrated core, 55/55 hydrated wave two and 136/136 representative responsive cases | Source-bound local evidence only; it does not prove production IAM, data isolation, deployed parity or release readiness |
| Registered third parties | 4: WorkOS AuthKit, Stripe, Supabase Realtime and Supabase Storage | Lago, LiveKit, racing providers, cloud/CI and any AI provider still require registry coverage |
| Registered audit events | 9 Partially verified contracts | Privileged/destructive/product-wide coverage not proven |
| Frontend actions | Total Not verified | No complete frontend-action-to-trace scan |
| Privileged operations | Total Not verified | Admin server actions are discovered, but privilege/audit completeness is not established |
| Critical findings | 0 identified in inspected evidence | Not proof of absence because scope is incomplete |
| High findings | 12 open, all release-blocking | See `risk-register.md` |
| Medium/Low findings | Not comprehensively triaged | Must not be interpreted as zero |
| Accepted/expired risks | 0 / 0 | No risk acceptance was supplied |
| Named finding owners/calendar dates | 0 / 12 complete | Accountable role is listed; named assignment/date is a release requirement |

The machine registry validator currently reports zero structural errors for the discovered entries. This means the seed records are internally consistent; it does not mean the product surface is complete or secure. `DESIGN_LAB.SCREEN.REVIEW` is now Partially verified: an exact policy allows local access, denies absent/non-exact production flags, requires administrator access in the production app and allows an explicitly isolated synthetic full-access demo; all six routes call the guard. Runtime proof that every preview remains free of production data and mutations is still release-blocking.

## High-risk disposition

| Finding | Remediation state | Remaining release evidence |
|---|---|---|
| `SEC-H-001` admin/moderator separation | Administrator-only nav/page guards, moderator landing/brand routing and explicit read-only queue presentation have static regression tests | Runtime direct-route/API/mutation denial and minimal projections for every actor/surface |
| `SEC-H-002` account deletion | Sender-only message tombstone, social-actor scrub and durable exact-prefix storage jobs; 108 source tests/typecheck/lint/build pass | WorkOS user/session lifecycle, Stripe customer/subscription policy, managed-page last-owner transfer, live storage/provider and backup evidence |
| `SEC-H-003` export | Explicit projections, limits, forbidden-field assertion, `no-store`, safe `413`; 108 source tests/typecheck/lint/build pass | Runtime BOLA/large-account/header tests, managed background export and GET artifact-side-effect decision |
| `SEC-H-004` cloud privilege | No complete remediation | Separate narrow identities/secrets plus live IAM/network negative evidence |
| `SEC-H-005` release binding | Commit/evidence/digest/web smoke controls exist | Signed provenance, SBOM, final scans, migration/restore binding, scanner smoke and rollback |
| `SEC-H-006` database/RLS | Context code/policies exist | Passing RLS check, role/TLS/grant proof, pool/system isolation and query/plan matrix |
| `SEC-H-007` entitlements | Strict `-1`/snapshot parser focused test added | Effective atomic run/token/cost enforcement and purchasable Pro+ parity |
| `SEC-H-008` privileged mutations | Many typed allowlists and transactional last-admin guard/tests added | Export/retention/deletion target contracts, last-owner control and runtime DB concurrency |
| `SEC-H-009` internal jobs | Live sync is POST-only with a route regression test | Workload identity, idempotency and isolated readiness writes |
| `SEC-H-010` audit/correlation | Structured logs/audit tables exist | Bounded trusted IDs, end-to-end fields, integrity/retention and audit-failure behavior |
| `SEC-H-011` presence privacy | Global member presence removed; token and UI regression tests pass | Isolated Supabase RLS, expiry, reconnect and revocation proof remains |
| `SEC-H-012` governance | New evidence layer corrects status and OAIC wording | Reconcile stale planning claims, owner approval and automated evidence checks |

## Required output status

| Required evidence output | Status at this review |
|---|---|
| Security architecture, trust boundaries and data-flow diagrams | Implemented in `docs/security/`; live deployment validation missing |
| Authorization, authentication and session reviews | Implemented; product-wide/runtime matrices incomplete |
| Threat model and abuse-case map | Implemented and evidence-qualified |
| Webhook review | Implemented; provider/runtime negative tests incomplete |
| Privacy lifecycle and incident response | Implemented with corrected APP 11/NDB wording; privacy/legal owner approval missing |
| Backup/recovery and supply-chain review | Implemented; restore/provenance evidence missing |
| Security test matrix, risk register and this report | Implemented; release remains blocked |
| `security/traces.ts`, endpoints, policies, DB operations, audit events, classifications, limits and third parties | Seed registries implemented and structurally validated |
| Complete API inventory documentation/JSON and deployed parity | Source inventory and secret-free JSON implemented; 177 source entries are not deployed parity |
| Frontend-server-database map for every action | Evidence-qualified map implemented; only nine seed traces are registered |
| Complete database/schema/role/query inventory with captured normalised SQL/plans | Source inventories implemented; generated SQL, plans and live role evidence remain missing |
| Complete data classification, third-party and secrets registers | Evidence-qualified registers implemented; live owner/retention/credential metadata missing |
| File upload/download review | Standalone evidence-qualified review implemented; live scanner/storage verification missing |
| Logging/alerting register with tested owners/runbooks | Register implemented; live delivery, owners and exercised runbooks remain missing |

## Release-blocking completion criteria

| # | Criterion | Status and evidence |
|---:|---|---|
| 1 | Every discovered action has a trace ID | **Not verified** — nine trace records; frontend action total unknown |
| 2 | Every trace reaches actual datastore/provider and response | **Not verified** — seed traces only |
| 3 | Every deployed API is inventoried | **Not verified** — 177 source entries; deployed parity absent |
| 4 | Every protected endpoint authenticates server-side | **Partially verified** — 163 endpoint auth entries remain unknown and 164 remain Not verified |
| 5 | Every protected endpoint authorises server-side | **Partially verified** — selected policies/tests only |
| 6 | Every identifier endpoint enforces object authorization | **Not verified** — no exhaustive BOLA matrix |
| 7 | Every mutation has a field allowlist | **Not verified** — improved admin contracts; remaining and product-wide paths open |
| 8 | Every tenant operation enforces isolation | **Not verified** — database/RLS blocker `SEC-H-006` |
| 9 | Every database query is parameterized | **Partially verified** — normal Prisma values; complete SQL registry absent |
| 10 | Every collection query is bounded | **Not verified** — export bounded; product-wide query inventory absent |
| 11 | Every sensitive response has explicit output schema | **Partially verified** — export and selected routes; endpoint-wide schemas missing |
| 12 | Every privileged mutation is audited | **Partially verified** — `AdminAction`/reasons exist; coverage/correlation/integrity incomplete |
| 13 | Every destructive action has confirmation and authorization | **Partially verified** — no complete action matrix |
| 14 | Every payment state is server-confirmed | **Partially verified** — focused Stripe settlement/binding tests pass; full provider lifecycle missing |
| 15 | Every webhook is authenticated and idempotent | **Partially verified** — Stripe/Lago/LiveKit mechanisms differ; full replay/order tests missing |
| 16 | Every upload is validated and ownership controlled | **Partially verified** — source controls exist; live scanner/storage pipeline not verified |
| 17 | Every private download is authorized | **Partially verified** — media focused test; all download/export paths not proven |
| 18 | Every job validates payload/execution authority | **Not verified** — shared internal secret and incomplete worker inventory |
| 19 | Every external response is treated as untrusted | **Not verified** — third-party registry incomplete |
| 20 | Every high-risk flow has abuse controls | **Not verified** — abuse/resource matrix incomplete |
| 21 | Every secret is outside source/client bundles | **Partially verified** — secret scan/Secret Manager design; live config/client bundle not inspected |
| 22 | Every production datastore network exposure is reviewed | **Not verified** — no live GCP/Supabase network evidence |
| 23 | Every critical backup has a successful restore test | **Not verified** — no restore evidence |
| 24 | Every high-risk endpoint has negative tests | **Not verified** — focused tests only |
| 25 | Design Lab cannot access/mutate production data | **Partially verified** — exact reviewer policy and six route guards plus safety/read-only/isolation tests exist; live no-production-data/mutation proof remains unproved |
| 26 | No known unresolved Critical/High vulnerability | **Failed** — 12 unresolved High findings |
| 27 | Every remaining risk has named owner and expiry/target | **Failed** — role owners only; no named individuals/calendar targets; no acceptance |
| 28 | Final report accurately states residual risk | **Partially verified** — this report states limitations; independent security/privacy approval missing |
| 29 | No evidence is fabricated | **Process requirement met in this report** — unknowns are marked; independent review still required |
| 30 | No conclusion depends only on frontend behavior | **Process requirement met in this report** — server/database/provider evidence is required; coverage remains incomplete |

## Minimum re-review package

Do not request production approval until one immutable candidate has:

1. all 12 High findings remediated and retested, with named owners and dates;
2. every source/deployed endpoint, server action, frontend action and background entry linked to a trace/security policy;
3. exact database roles, query IDs, safely captured normalised SQL, bounds and representative plans;
4. authorised staging actor/tenant/object/property negative tests, including moderator/admin and Design Lab reviewer controls;
5. provider/IAM/network/session/webhook/upload/download/job evidence without exposing secrets or private data;
6. signed image provenance, SBOM, final scans, migration and restore evidence bound to one digest;
7. web and scanner candidate tests plus an exercised rollback;
8. successful backup restore and deleted-account non-reactivation test;
9. privacy/legal approval of collection, retention, deletion and NDB procedures;
10. a regenerated release report showing no unresolved Critical/High finding and no expired acceptance.

## Final statement

The defensible outcome is traceable, secure-by-design and repeatably verified software with explicit residual risk—not a claim of perfect security. GreyhoundIQ has useful security foundations and several verified remediation units, but the present evidence does not satisfy the release-blocking criteria. The production gate must remain closed.
