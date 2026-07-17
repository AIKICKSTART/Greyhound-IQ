# Security test matrix

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-14
Owner: GreyhoundIQ security test lead

This matrix separates tests present in source from tests executed against an authorised environment. It does not infer production protection from a UI condition or a unit test. The authoritative requirement inventory is `src/components/security-master-requirements.ts`; its current evidence merge reports 2,288 release-blocking requirements: 6 Verified, 36 Partially verified and 2,246 Not assessed.

## Automated pipeline observed

`.github/workflows/ci.yml` creates an ephemeral PostgreSQL 16 database, applies migrations/seed data, runs source and dependency scans, executes application security checks, runs all `src/**/*.test.ts` files through `scripts/run-unit-tests.ts`, type-checks, lints, builds, starts the production server and runs the smoke suite.

| Layer | Command or test | Security purpose | Current evidence |
|---|---|---|---|
| Documentation | `npm run docs:check` | Reject invalid/missing documentation references and structure covered by the checker | Source present; this change must pass locally and CI |
| Secret scan | Pinned Gitleaks container in `.github/workflows/ci.yml` | Repository-history secret discovery | CI gate present; live latest run Not verified |
| SAST | Pinned Semgrep container with TypeScript, OWASP Top Ten and secrets rules | Injection, unsafe patterns and secret discovery | CI gate present; test files excluded; live latest run Not verified |
| Dependencies | `npm audit --audit-level=high` | Known npm vulnerability gate | CI gate present; latest result Not verified in this document |
| Environment/deploy | `check:env`, `check:production-safety`, `check:migrations` | Required variables, unsafe production flags and migration checks | CI gate present |
| Authentication | `check:auth-profile-sync`, `src/lib/workos-redirect.test.ts`, callback tests | Subject/profile binding and safe return paths | Partially verified in source |
| Internal authentication | `check:internal-auth` | Static-secret format/denial checks | Test exists; architecture remains high risk `SEC-H-009` |
| Calls | `check:calls`, call-token unit tests | Membership/scoped call credentials | Partially verified; live provider optional/Not verified |
| Database/RLS | migration deploy; runtime-role `check:community-flow`; `check:visibility-policies` | Runtime database context and visibility | Partially verified; repository `check:rls-policies` remains blocked by the known Prisma P2010 path under runtime context (`SEC-H-006`) |
| Marketplace | `check:marketplace-safety` | Listing ownership/status/media controls | Partially verified; endpoint-wide BOLA/property tests absent |
| Communications | `check:comms-security`, `src/lib/realtime-authorization.test.ts`, `src/lib/media-service.test.ts` | Conversation membership, block revocation and private-media access | Focused source evidence present |
| Billing | `src/lib/billing/stripe-webhook-settlement.test.ts`, readiness tests | Signature/settlement/binding/idempotency and checkout readiness | Focused source evidence present; provider tenant Not verified |
| Admin access | `admin-nav-data.test.ts`, `admin-moderator-read-only-contract.test.ts`, admin access tests | Moderator landing/navigation, administrator server guards, read-only support/bug/feedback presentation | Static evidence only; runtime direct-route/API/mutation negative E2E missing (`SEC-H-001`) |
| Export | `src/lib/user-export-policy.test.ts` | Explicit-field deny assertion, collection and byte limits, private cache policy | Focused test and 108-test source suite pass; runtime/managed-large-export tests pending (`SEC-H-003`) |
| Account deletion | `src/lib/account-deletion.test.ts` | Sender-only message mutation and bounded exact-prefix storage deletion | Focused test and 108-test source suite pass; provider/session/managed-page/backup lifecycle missing (`SEC-H-002`) |
| Design Lab | `design-lab-access-policy.test.ts`, route safety/read-only/isolation and release-gate tests | Exact local allow, production flag/admin policy, isolated demo decision, six route guards, noindex and simulated destructive actions | Partially verified in source; complete deployed no-production-data/mutation isolation Not verified |
| Build/smoke | `typecheck`, `lint`, `build`, `test:smoke` | Compile/static quality and representative live route health | CI gate present; not equivalent to security E2E |

## Endpoint-negative test contract

Every deployed endpoint or server action must be linked to a machine endpoint ID, trace ID and the applicable cases below. A justified Not applicable result must name the owner and evidence. Current repository coverage is incomplete because no verified endpoint-to-test registry proves exhaustiveness.

| Test family | Required cases | Release status |
|---|---|---|
| Authentication | Signed out, expired/revoked session, suspended/deleted user, invalid token, wrong issuer/audience, reused callback, invalid state, unsafe return, missing/invalid CSRF | **Test coverage missing** product-wide |
| Function authorisation | Wrong role/permission/tier; moderator calling admin action; member calling moderator action | **Partially verified** for selected admin paths; runtime matrix missing |
| Object authorisation | Wrong owner/tenant/org/page/team/group/conversation; blocked/private/deleted/archived/suspended object; same type but inaccessible ID | **Test coverage missing** product-wide |
| Property authorisation | Security-field update, unknown field, mass assignment and role/tier/payment/verification/ownership injection | **Test coverage missing**; admin allowlists blocked by `SEC-H-008` |
| Validation | Missing/null/empty/long/out-of-range/invalid enum or ID/date/URL; nested depth; oversized arrays/body/file; content type/method; duplicate submission | **Test coverage missing** product-wide |
| Injection/output | SQL/ORM injection, stored/reflected/DOM XSS, unsafe HTML/Markdown/URL, path/header/log injection, open redirect, SSRF and CSV formula output | **Test coverage missing** as a complete endpoint matrix |
| Resource/abuse | Server pagination maximum, expensive filters, per-user/per-object limits, upload/message/export/AI quotas, provider/DB timeout, queue backpressure | **Test coverage missing**; export focused limits partially verified |
| Concurrency/idempotency | Simultaneous edits/transfers/last-owner removal/moderation; duplicate checkout/invite/publication/webhook/job; lost update and key reuse | **Test coverage missing** product-wide; billing dedupe focused tests exist |
| Database | Tenant/owner/RLS/role/constraint/affected-row/rollback/timeout/bounds/sensitive columns/deleted filter/index/migration compatibility | **Test coverage missing** as a query registry; runtime RLS check incomplete (`SEC-H-006`) |
| Dependency failure | Database, cache, queue, storage, identity, billing, racing and AI outage; malformed provider data; audit/log failure | **Test coverage missing** product-wide |

## High-finding regression requirements

| Finding | Required automated evidence before closure | Current status |
|---|---|---|
| `SEC-H-001` moderator least privilege | Runtime tests for every admin page and direct data/API entry as member, moderator and admin; assert no protected projection is serialized and read-only queues cannot mutate | Static navigation/page-guard and moderator read-only presentation tests pass; runtime E2E missing |
| `SEC-H-002` deletion lifecycle | Counterparty message integrity; exact private/public prefix; batch/lease/retry/duplicate/job poison tests; provider cancellation/session revocation; partial failure; backup restoration does not resurrect identity | Sender-only and storage-contract focused tests present; remaining lifecycle missing |
| `SEC-H-003` user export | Cross-user request, all collection sentinels, 8 MiB boundary, forbidden fields at every depth, private headers, rate-limit failure, interrupted response and GET-side-effect policy | Focused DTO/limit/cache and 108-test source suite pass; runtime/managed-large-export matrix pending |
| `SEC-H-004` cloud least privilege | IAM policy tests prove separate build/deploy/web/scanner roles and exact secret access; unauthorised invocation and network denial | Missing |
| `SEC-H-005` release binding | Verify signed provenance/SBOM/scan/migrations/backup/evidence all reference the same image digest; scanner candidate and rollback exercise | Missing |
| `SEC-H-006` database/RLS | Every runtime/system/worker role; cross-tenant and owner rows; pool context reset; bypass denial; representative generated SQL and query-plan bounds | Blocked/incomplete |
| `SEC-H-007` entitlements | Tier/feature/monthly snapshot/run/token/cost limits; `-1` policy; concurrent runs; downgrade/cancel; unavailable Pro+ checkout | `entitlement-service.test.ts` covers strict `-1` parsing; usage/concurrency/checkout state matrix missing |
| `SEC-H-008` privileged mutations | Enum/canonical path rejects, unknown fields, moderator denial, required reason, last-admin/owner and concurrent self-lockout | Focused typed-input/status and pure last-admin tests pass; export/retention/deletion targets, last-owner and runtime DB concurrency remain missing |
| `SEC-H-009` internal jobs | Per-endpoint workload identity, wrong audience/issuer/service account, replay, GET denial, idempotency, write-probe production denial | Static shared-secret check only |
| `SEC-H-010` correlation/audit | Bounded generated request IDs, invalid caller input, trace propagation, append-only audit, failure-to-audit fail-safe, redaction | Missing |
| `SEC-H-011` presence privacy | Unrelated member denial, friend/conversation grant, block/revoke, expiry/reconnect and enumeration resistance | Shared global member presence still vulnerable |
| `SEC-H-012` governance evidence | Documentation claim linter, control-to-file/test links, owner/review date and APP 11/NDB text checks | This evidence set corrects claims; automated governance check missing |

## Mandatory security journeys

The security master prompt requires 55 complete security traces, from public browsing and contact through auth, racing ingestion, community, private messaging/calls, marketplace, account/team/billing, moderation/admin, AI, jobs, Design Lab, private downloads and blocked relationships. Their tests are not considered complete until each journey records:

- trace ID and endpoint/server-action IDs;
- actor, role, tier, tenant/relationship and object state;
- browser request and safe response;
- server authentication, function/object/property policy and validation;
- database role/query IDs or external-provider operation;
- audit/log evidence without sensitive values;
- happy path plus all applicable negative, failure, resource and concurrency cases;
- desktop/mobile accessibility behaviour where the journey has UI.

No evidence-backed run proves all 55 journeys. Their release status is **Test coverage missing**.

## Execution evidence protocol

For every release candidate, retain command, commit SHA, image digest where applicable, environment, start/end time, result, test count, failure output reference and operator. Sanitise logs. Never store session tokens, request bodies containing private content, provider secrets or production credentials. A skipped critical test fails the release unless a security owner records a time-limited risk acceptance; no such acceptance exists for this review.

## Local execution record — 2026-07-14

These commands ran against the shared local worktree, not an immutable release candidate or live production system:

| Command | Result |
|---|---|
| `npm run docs:check` | Passed |
| `npx tsx security/registry.test.ts` | Passed: 104 route methods, 73 server actions, 9 seed traces, 18 database operations |
| Guarded `npm run check:demo-fixture-idempotency` on disposable loopback port 55734 | Passed: exact runtime identity; conversation participant/non-participant/missing and media owner/other-owner/missing cases; zero read-row deltas; exact-ID cleanup |
| `npx tsx --conditions=react-server scripts/check-demo-route-fixture-evidence.test.ts` | Passed: strict schema-v3 source binding and mutation rejection |
| `npx tsx src/components/security-master-requirements.test.ts` | Passed |
| `npx tsx src/app/admin/admin-nav-data.test.ts` | Passed |
| `npx tsx src/app/admin/admin-moderator-read-only-contract.test.ts` | Passed |
| `npx tsx src/lib/design-lab-access-policy.test.ts` | Passed |
| Untracked documentation whitespace check using `git diff --no-index --check` per `docs/security` file | Passed |

The database proof is isolated local evidence for two registered reads, not staging or production evidence. The account-deletion/export hardening workstream also reported its focused tests, all 108 source unit tests, typecheck, lint and build passing. The admin input/last-admin and entitlement-parser workstreams reported focused tests plus targeted lint/typecheck passing. These results prove source-level regressions only; they do not replace authorised staging/provider/database/IAM tests.

## Closure rule

A finding moves to Verified only after the implementation, its negative/regression tests, the relevant full suite and an authorised staging test all pass against the same release candidate. Unit evidence alone is Partially verified. Production promotion remains blocked while any high finding lacks that chain.
