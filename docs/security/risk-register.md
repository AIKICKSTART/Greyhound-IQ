# Security risk register

Status: **11 unresolved High findings; 1 remediated in source — production release blocked**
Evidence date: 2026-07-13
Register owner: GreyhoundIQ security lead
Affected environments: repository, local/development, staging and production configuration unless a finding narrows the scope

No risk in this register is accepted. No Critical finding was identified in the inspected evidence, but that is not proof that none exists: 2,246 of 2,288 master security requirements remain Not assessed. Each provisional affected trace ID below must be added to the authoritative machine trace registry; naming an ID here does not imply a complete `SecurityTraceContract` exists.

Owners are accountable roles, not evidence of individual assignment. A named person and calendar target date have not been provided. Every target is therefore **before production promotion**, and the missing named assignee/date is itself a release-gate failure. Accepted-risk expiry is Not applicable because acceptance is prohibited for these unresolved High findings.

## Summary

| ID | Title | Severity | Status | Release decision |
|---|---|---|---|---|
| `SEC-H-001` | Moderator least-privilege boundary incomplete | High | Partially verified after static remediation | Blocked pending runtime negative E2E and explicit per-surface policies |
| `SEC-H-002` | Account deletion remains incomplete across provider, session and backup boundaries | High | Partially verified after local/storage remediation | Blocked pending external/session/backup lifecycle and full retest |
| `SEC-H-003` | User export protection lacks complete runtime and method-semantics verification | High | Partially verified after projection/resource remediation | Blocked pending full/runtime tests and GET-side-effect decision |
| `SEC-H-004` | Google Cloud identities and scanner secret scope exceed least privilege | High | Control missing | Blocked |
| `SEC-H-005` | Approved evidence is not cryptographically bound to the complete promoted release | High | Control missing | Blocked |
| `SEC-H-006` | Runtime database role and RLS enforcement are not proven safe | High | Not verified / control missing | Blocked |
| `SEC-H-007` | AI and paid entitlement consumption/state enforcement is incomplete | High | Partially verified after entitlement-parser remediation | Blocked |
| `SEC-H-008` | Privileged mutation allowlists and last-owner controls are incomplete | High | Partially verified after typed-input and last-admin remediation | Blocked |
| `SEC-H-009` | Internal jobs share static bearer authority and one mutation accepted GET | High | POST-only containment implemented; shared identity remains vulnerable | Blocked |
| `SEC-H-010` | Request correlation and privileged audit evidence are incomplete | High | Control missing | Blocked |
| `SEC-H-011` | Global members-presence topic exposes unrelated member presence identifiers | High | Remediated in source by removing global presence | Runtime Realtime proof remains under the pre-production gate |
| `SEC-H-012` | Security governance documentation asserts unverified controls and conflicts with law guidance | High | Partially verified by this evidence layer | Blocked pending stale-claim resolution and automated evidence checks |

## `SEC-H-001` — Moderator least-privilege boundary incomplete

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-001` |
| Title | Moderator least-privilege boundary incomplete |
| Severity | High |
| Affected trace IDs | `ADMIN.ROUTES.VIEW`; full trace contract missing |
| Affected environments | All environments rendering `/admin/**` |
| Affected actors | Moderator, administrator, support/billing operators not represented by distinct guards |
| Affected records | User/profile identity, organisations, billing, compliance, export, audit, job, webhook and source-health records |
| Data classification | Confidential, personal information and high-impact administrative data |
| Source file | `src/app/admin/admin-nav-data.ts`; administrator-only page files under `src/app/admin/**/page.tsx`; `src/lib/auth.ts` |
| Source symbol | `ADMIN_NAV`, `adminNavForRole`, `requireModeratorProfile`, `requireAdminProfile` |
| Endpoint | `/admin`, `/admin/users`, organisations, invitations, account-deletion, billing, compliance, retention, exports, audit/actions, jobs/webhooks/usage/source-health, page-rules and site-content; remaining moderator-visible queues require explicit policies |
| Database operation | Multiple Prisma reads; exact query IDs and projections are not registered, which is part of the gap |
| Description | A moderator must receive only queue data/actions required for trust and safety. Navigation hiding is not authorization; direct page and data entry points must deny administrator-only projections. |
| Actual behaviour | Identified high-risk screens declare `minimumRole: "admin"`, call `requireAdminProfile()` and are covered by `src/app/admin/admin-nav-data.test.ts`. Moderator `/admin` and brand links resolve to reports; support/bug/feedback render explicit read-only moderator explanations and Administrator-required mutation badges, covered by `admin-moderator-read-only-contract.test.ts`. Remaining moderator-visible routes still use the shared guard, and no runtime direct-route/API/mutation matrix proves denial or minimal serialization. |
| Expected behaviour | Central deny-by-default permission for every admin route, projection and mutation; narrow operator roles; runtime direct-request denial; no protected serialization before denial. |
| Attack preconditions | Valid moderator session or compromised moderator account; knowledge of an administrator route or alternate entry point. |
| Business impact | Privacy breach, billing/operational intelligence exposure and potential preparation for privilege escalation. |
| Privacy impact | Unnecessary disclosure of personal and administrative information contrary to minimisation and APP 11 security expectations. |
| Evidence | `src/app/admin/admin-nav-data.ts`; `admin-nav-data.test.ts`; `admin-moderator-read-only-contract.test.ts`; `adminHomeForRole`; page-level `requireAdminProfile()` calls. No runtime moderator-negative E2E evidence. |
| Root cause | Coarse role guard used as a permission model and prior default-moderator navigation semantics. |
| Immediate containment | Keep every identified high-risk page administrator-only; disable any moderator route without an approved data projection; monitor denied admin-route attempts. |
| Permanent remediation | Create route/projection/action permissions, distinct support/billing roles, direct-entry server enforcement and automated actor matrix. |
| Regression tests | Static nav/server-guard test plus runtime member/moderator/admin navigation, direct route, server action and API tests asserting no sensitive response body. |
| Owner | GreyhoundIQ identity and administration lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially verified; Blocked from release |
| Residual risk | Alternate entry points, minimal projections and moderator-visible route scope remain unproved. |
| Retest evidence | Role-aware navigation/server-guard and moderator read-only source-contract tests pass; authorised runtime E2E against the release candidate is missing. |

## `SEC-H-002` — Account deletion incomplete across provider, session and backup boundaries

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-002` |
| Title | Account deletion remains incomplete across provider, session and backup boundaries |
| Severity | High |
| Affected trace IDs | `ACCOUNT.DELETION.FINALIZE`; full trace contract missing |
| Affected environments | All environments processing deletion maintenance; production provider/storage configuration |
| Affected actors | Deleting user, message counterparties, privacy/support operators, background worker |
| Affected records | User/profile/social actor, authored community/message data, media metadata/objects, provider customer/identity references, backups |
| Data classification | Personal information, private communications, private media and billing/identity metadata |
| Source file | `src/lib/account-service.ts`; `scripts/account-deletion-maintenance.ts`; account/admin deletion UI |
| Source symbol | `runAccountDeletionMaintenance`, `scrubProfileOwnedContent`, `accountDeletionAuthoredMessageUpdate`, `runAccountStorageDeletionJobs`, `deleteAccountStoragePrefixBatch` |
| Endpoint | Account deletion request and scheduled maintenance path; no direct public deletion GET identified |
| Database operation | Transactional local scrub/tombstone and `DeletionJob` processing; exact query IDs/normalised SQL not yet registered |
| Description | Finalisation must delete or de-identify only the subject's data, preserve counterparties' authored content, revoke access, complete external/storage deletion where appropriate and truthfully track delayed/retained copies. |
| Actual behaviour | The remediation tombstones only sender-authored messages, sanitises the social actor, tombstones DB media, and queues durable private/public per-user prefix deletion jobs. Jobs validate exact bucket/prefix, process at most 500 objects per batch, recover leases and audit success/failure. WorkOS/Stripe remote records are not deleted or cancelled; identifiers remain for reconciliation and the status explicitly reports `reference_retained_remote_record_not_deleted`. Session/provider revocation and backup expiry are not proven. |
| Expected behaviour | Approved legal/retention policy; re-auth; session revocation; idempotent local/storage/provider lifecycle; durable partial-failure ledger; verified provider and backup outcomes without corrupting third-party records. |
| Attack preconditions | Legitimate or compromised account requests deletion; worker/provider/storage partial failure or malicious deletion-job data. |
| Business impact | Counterparty data corruption, retained account access, incomplete privacy promise, orphaned private media and support/compliance burden. |
| Privacy impact | Continued availability or processing of personal information after the stated lifecycle; prior risk to another person's message content. |
| Evidence | `src/lib/account-deletion.test.ts` proves sender-only mutation and exact-prefix/batch controls. UI/admin status discloses queued storage and provider/backup delay. Live storage/provider/backups were not tested. |
| Root cause | Deletion was originally treated mainly as local row scrubbing without a complete external/session/backup state machine. |
| Immediate containment | Keep final deletion disabled in production unless the privacy owner approves the current partial contract; manually reconcile remote references and failed jobs; do not promise immediate permanent deletion. |
| Permanent remediation | Add provider cancellation/deletion or documented retained-record policy, WorkOS/session revocation, backup-beyond-use/expiry proof, retry/dead-letter operations and reconciliation reports. |
| Regression tests | Existing sender/storage tests; add duplicate/lease expiry/partial storage failure, provider timeout/retry, session use after finalisation, backup restore non-reactivation and complete full-suite/runtime tests. |
| Owner | GreyhoundIQ privacy engineering and identity lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially verified; Blocked from release |
| Residual risk | Remote identity/billing records, active sessions, managed-page ownership, provider copies, derived media and backups can remain beyond the local finalisation point. |
| Retest evidence | Focused deletion test, all 108 source unit tests, typecheck, lint and build passed on 2026-07-13. No live database/provider/storage mutation was run; authorised staging lifecycle remains pending. |

## `SEC-H-003` — User export lacks complete runtime and method-semantics verification

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-003` |
| Title | User export protection lacks complete runtime and method-semantics verification |
| Severity | High |
| Affected trace IDs | `ACCOUNT.DATA_EXPORT.CREATE`; full trace contract missing |
| Affected environments | All environments serving the authenticated export route |
| Affected actors | Account owner, attacker with a stolen session, support operator handling oversized exports |
| Affected records | Profile, account, community, messages, media descriptors, listings, billing-safe and AI-safe user-visible subsets |
| Data classification | Personal information, private communications and account metadata |
| Source file | `src/app/api/users/me/export/route.ts`; `src/lib/user-export-policy.ts` |
| Source symbol | `POST`, `assertUserExportCollections`, `assertUserExportDto`, `assertUserExportSize` |
| Endpoint | `POST /api/users/me/export` |
| Database operation | Explicit Prisma `select` projections with per-collection maximum/sentinel; exact query IDs/SQL not yet registered |
| Description | Data export must be owner-only, explicitly projected, bounded, non-cacheable, resilient to large accounts and free of provider/storage/internal AI identifiers. |
| Actual behaviour | Remediation uses an explicit same-origin POST form behind the global cross-origin mutation guard, authenticated fail-closed rate limiting, explicit selects, 500-record caps with overflow sentinels, nested media cap 20, 8 MiB response cap, private `no-store`, safe `413` and recursive forbidden-key assertion. Provider/storage/raw-agent internals are excluded. A focused route contract proves GET is absent, POST owns the mutation, and both account surfaces use the shared form. Runtime cross-user/large-account plus managed-background-export evidence is pending. |
| Expected behaviour | Owner-only explicit schema, safe bounded sync or durable async job, non-cacheable result, no mutation through GET, audited lifecycle/expiry and negative/resource tests. |
| Attack preconditions | Valid user session; large/malicious account data; shared/proxy cache misconfiguration or direct endpoint request. |
| Business impact | Data exfiltration, process/database exhaustion, unstable account service or disclosure of integration internals. |
| Privacy impact | Over-disclosure of private content and identifiers or leakage through caches/download handling. |
| Evidence | `src/lib/user-export-policy.test.ts` covers cache value, forbidden fields, collection and byte limits; route source contains explicit projections and safe response helpers. |
| Root cause | Original synchronous export selected broad multi-table data without a formal output/resource contract. |
| Immediate containment | Retain limits/no-store; disable direct export if the full suite or runtime BOLA/header test fails; route oversized accounts to a managed, authorised process. |
| Permanent remediation | Retain POST semantics for artifact creation, register exact output/query contracts, implement expiry cleanup and complete runtime BOLA/resource/error tests. |
| Regression tests | Focused policy and POST-only route-method tests; add signed-out/cross-user, origin, rate-limit unavailable, 499/500/501 and 8 MiB boundaries, cache/content-disposition, interrupted DB and artifact rollback/cleanup tests. |
| Owner | GreyhoundIQ account and privacy backend lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially verified; Blocked from release |
| Residual risk | Operational cleanup, real database cardinality and runtime response/header behavior are unproved. |
| Retest evidence | Focused export policy and POST-only route-method tests pass in source on 2026-07-14. No live database/provider/storage action was run; authorised staging cross-user/large-account tests remain pending. |

## `SEC-H-004` — Google Cloud identities and scanner secret scope exceed least privilege

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-004` |
| Title | Google Cloud identities and scanner secret scope exceed least privilege |
| Severity | High |
| Affected trace IDs | `DEPLOY.CLOUD_RUN.CONFIGURE`; full trace contract missing |
| Affected environments | Staging and production Google Cloud projects/configuration |
| Affected actors | Build/deploy identity, web runtime, media scanner runtime, compromised workload |
| Affected records | All secrets assigned to the shared runtime; database, identity, billing, storage, calls and realtime data reachable through them |
| Data classification | Restricted credentials and all classifications transitively accessible |
| Source file | `scripts/gcp-cloud-run-bootstrap.sh`; `.github/workflows/cloud-run-deploy.yml` |
| Source symbol | Deployment service-account role grants; `Deploy Cloud Run candidates` secret/runtime configuration |
| Endpoint | Cloud Run management and private scanner service; Not applicable to a single HTTP endpoint |
| Database operation | Not applicable; infrastructure privilege finding |
| Description | Ordinary identities must have only operation-specific cloud permissions and secrets. Scanner compromise must not yield web/database/billing/identity credentials. |
| Actual behaviour | Bootstrap grants project-wide `roles/run.admin` to staging/prod deploy service accounts. Web and scanner use the same runtime service account and the scanner receives the full web secret bundle, including WorkOS, Stripe/Lago and LiveKit material. |
| Expected behaviour | Separate build/deploy/web/scanner identities; custom/narrow roles; per-service Secret Manager access; private ingress/invocation and reviewed network egress. |
| Attack preconditions | Compromise of CI deploy identity, web service or media scanner; malicious upload reaching vulnerable scanner dependency. |
| Business impact | Cross-service takeover, secret theft, billing/identity abuse, data breach and deployment tampering. |
| Privacy impact | Broad unauthorised access to personal information and private content. |
| Evidence | Static workflow/bootstrap configuration; live IAM and service configuration were not inspected. |
| Root cause | Convenience-oriented shared identities and one common secret/environment bundle. |
| Immediate containment | Do not deploy the scanner with web secrets; restrict deploy credentials and audit current IAM/secret access in authorised cloud tooling. |
| Permanent remediation | Separate service accounts, custom roles, secret-level IAM, private scanner invocation, egress boundaries and policy-as-code negative tests. |
| Regression tests | IaC policy tests; live `gcloud` read-only evidence; attempt denied secret access/invocation from each wrong identity in staging. |
| Owner | GreyhoundIQ cloud security/platform lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Control missing; Blocked from release |
| Residual risk | Repository configuration may understate additional live grants; no authoritative IAM inventory exists. |
| Retest evidence | None against live/staging IAM. |

## `SEC-H-005` — Release evidence not bound to complete promoted artifact

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-005` |
| Title | Approved evidence is not cryptographically bound to the complete promoted release |
| Severity | High |
| Affected trace IDs | `DEPLOY.PRODUCTION.PROMOTE`; full trace contract missing |
| Affected environments | CI, Artifact Registry and staging/production Cloud Run deployment |
| Affected actors | Developer, approver, CI/build/deploy identities, release operator |
| Affected records | Source, image, configuration, migrations, release evidence, production data availability |
| Data classification | Integrity-critical deployment metadata; all production data transitively affected |
| Source file | `.github/workflows/cloud-run-deploy.yml`; `cloudbuild.yaml`; `Dockerfile` |
| Source symbol | `Verify approved production evidence`, `Build image`, `Deploy Cloud Run candidates`, `Post-deploy smoke test`, `Promote tested revisions` |
| Endpoint | CI/CD and Cloud Run control plane; Not applicable to one application endpoint |
| Database operation | Migrations are not bound to the release manifest; exact migration operation not represented here |
| Description | Approval, build, scans, SBOM/provenance, migrations, backup/restore, candidates and promotion must identify one immutable artifact/configuration set. |
| Actual behaviour | Exact commit/evidence hash, successful CI, immutable digest and web candidate smoke are positive controls. Approval occurs before build; no signing/SBOM/provenance or final-image/IaC scan is found; scanner is not smoke-tested; promotion is sequential without rollback; migrations/backups are not digest-bound; secrets use `latest`; `_ENABLE_DEVICE_PREVIEWS` is referenced but not supplied by the workflow. |
| Expected behaviour | Signed provenance and SBOM for the digest, policy scans, explicit substitutions/config digest, migration/restore binding, both candidates tested and an exercised rollback/atomic compatibility plan. |
| Attack preconditions | Build/dependency/config compromise, approver unable to identify final artifact, failed scanner promotion or migration incompatibility. |
| Business impact | Deployment of unreviewed/vulnerable code, outage, inconsistent services or irrecoverable data change. |
| Privacy impact | A compromised artifact or config can expose or corrupt all personal data. |
| Evidence | Repository workflow, Cloud Build and Dockerfile review; no live provenance/Artifact Registry/Binary Authorization evidence. |
| Root cause | Commit-centric approval without a single cryptographically bound release manifest. |
| Immediate containment | Keep production gate blocked; record digest manually; avoid migrations/promotion without verified backup and both-candidate smoke results. |
| Permanent remediation | Implement the release manifest specified in `supply-chain-review.md`, signing/attestation verification, final artifact/IaC scans and rollback drills. |
| Regression tests | Tampered digest/evidence/SBOM/config rejection, missing substitution, scanner failure and web/scanner rollback exercises. |
| Owner | GreyhoundIQ release engineering and supply-chain security lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Control missing; Blocked from release |
| Residual risk | Live GitHub/GCP policy and build provenance may differ from source and remain unverified. |
| Retest evidence | None for a complete bound release candidate. |

## `SEC-H-006` — Runtime database role and RLS enforcement not proven safe

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-006` |
| Title | Runtime database role and RLS enforcement are not proven safe |
| Severity | High |
| Affected trace IDs | `DATABASE.REQUEST_CONTEXT.APPLY`, `DATABASE.SYSTEM_CONTEXT.APPLY`; full trace contracts missing |
| Affected environments | CI runtime-role database, staging and production PostgreSQL/Supabase connectivity |
| Affected actors | Application request, anonymous request, system job, pooled connection, compromised service |
| Affected records | Every tenant/user-scoped PostgreSQL table protected by request context/RLS |
| Data classification | All database classifications, including personal/private/administrative data |
| Source file | `src/lib/database-url.ts`; `src/lib/db-context.ts`; Prisma migrations/RLS policies |
| Source symbol | `runtimeDatabaseUrl`, `databaseUrlConfigurationError`, `withDbRequestContext`, `withDbSystemContext`, `setDbRequestContext`, `setDbSystemContext` |
| Endpoint | All database-backed routes, actions and jobs |
| Database operation | `set_config` transaction-local request/system context followed by Prisma operations; exact query inventory is incomplete |
| Description | Production must use a non-owner, non-bypass runtime role over verified TLS; request/tenant context must be transaction-local and pooling-safe; system access must be separately privileged and narrowly callable. |
| Actual behaviour | URL validation rejects known managed Supabase direct hosts in relevant modes but cannot prove the expected runtime role, non-bypass grants or TLS for arbitrary hosts. `withDbSystemContext` sets `app.system=true` over the same application connection. `check:rls-policies` is blocked by an existing Prisma P2010 `SocialActor`/`FeedPost` RETURNING path under runtime context. |
| Expected behaviour | Separate roles/connections, forced TLS, RLS/FORCE RLS and least grants; pool context reset; cross-tenant/role tests and generated-query evidence all passing. |
| Attack preconditions | Misconfigured production URL/role, caller reaching system context, stale pooled GUC or policy/query incompatibility. |
| Business impact | Cross-user/cross-tenant disclosure or mutation across the product. |
| Privacy impact | Large-scale unauthorised access/modification of personal and private data. |
| Evidence | Static URL/context code, migrations and failing/incomplete RLS check; no live database role/grant/network inspection. |
| Root cause | Application session context is being used without deployment-time proof of the surrounding database role/pooling boundary. |
| Immediate containment | Do not point production at an unverified role; deny system-context entry except allowlisted internal functions; block release while RLS check fails. |
| Permanent remediation | Dedicated runtime/system/worker roles and pools, deploy-time role/TLS/grant assertion, RLS matrix, fixed Prisma RETURNING incompatibility and query registry. |
| Regression tests | Every role and policy, cross-tenant identical IDs, owner/admin/worker, pooled context reset, system caller denial, TLS/role misconfiguration and representative SQL/plan bounds. |
| Owner | GreyhoundIQ database security lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Not verified / Control missing; Blocked from release |
| Residual risk | A privileged or bypass-capable runtime connection can nullify application and RLS assumptions. |
| Retest evidence | `check:rls-policies` not passing; no authorised staging role evidence. |

## `SEC-H-007` — AI and paid entitlement enforcement incomplete

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-007` |
| Title | AI and paid entitlement consumption/state enforcement is incomplete |
| Severity | High |
| Affected trace IDs | `AI.AGENT.START_RUN`, `BILLING.ENTITLEMENT.RESOLVE`; full trace contracts missing |
| Affected environments | All environments exposing paid AI/agent tools and billing entitlements |
| Affected actors | Member, paid-tier user, cancelled/downgraded user, concurrent requester, attacker changing client state |
| Affected records | Entitlement snapshots, agent runs, token/cost usage, billing tier and provider configuration |
| Data classification | Account/billing metadata, AI prompts/outputs and cost data |
| Source file | `src/lib/agent-service.ts`; `src/lib/billing/entitlement-service.ts`; `src/lib/billing/entitlements.ts`; Stripe readiness tests/config |
| Source symbol | `assertAgentTier`, `runAgentForCurrentUser`, `getEntitlementLimitsForCurrentUser`, `parseEntitlementLimits`, `DEFAULT_TIER_ENTITLEMENT_LIMITS` |
| Endpoint | `/agents` and associated server actions/services; checkout paths for required tier |
| Database operation | Agent run/usage/snapshot reads and writes; exact query IDs/atomic quota SQL missing |
| Description | Server must resolve current effective entitlement and atomically enforce run/token/cost/concurrency limits; client tier is never authoritative. |
| Actual behaviour | Agent launch compares the current static tier with `AGENT_TIER`; it does not enforce monthly snapshot/token/run consumption atomically. `parseEntitlementLimits` now accepts exactly `-1` as the documented unlimited sentinel and rejects values below `-1`, type confusion and incomplete snapshots, with focused tests. Pro+ entitlements exist while Stripe readiness indicates Pro+ checkout is unavailable. |
| Expected behaviour | Server-confirmed billing/entitlement state, consistent limit schema, atomic reservation/settlement/refund, concurrency and downgrade/cancellation behavior, truthful unavailable/upgrade UI. |
| Attack preconditions | Authenticated member repeatedly/concurrently starts runs or has stale/inconsistent billing state. |
| Business impact | Provider cost exhaustion, unauthorised paid use, billing disputes and misleading plan promises. |
| Privacy impact | Excessive AI processing/transmission of user data beyond the expected plan or consent context. |
| Evidence | `src/lib/billing/entitlement-service.test.ts` covers the corrected parser; source review and Stripe readiness test show remaining plan/usage gaps; no provider-cost/runtime concurrency evidence. |
| Root cause | Tier feature gate implemented separately from usage accounting and purchasable plan state. |
| Immediate containment | Disable unpurchasable/unenforced agent types or apply conservative server quotas; alert on unusual run/cost volume. |
| Permanent remediation | One entitlement state machine and schema, atomic quota reservation, idempotent usage settlement, concurrent tests and checkout/entitlement parity. |
| Regression tests | Free/pro/pro+ and disabled states; `-1`; snapshot expiry; concurrent boundary; cancel/downgrade/grace; failed provider call; cost budget and direct-service invocation. |
| Owner | GreyhoundIQ billing and AI platform lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially verified; Blocked from release |
| Residual risk | Static role/tier checks can grant work beyond paid or operational limits. |
| Retest evidence | Focused parser test plus targeted lint/typecheck reported passing; no complete entitlement/consumption test matrix. |

## `SEC-H-008` — Privileged mutation allowlists and last-owner controls incomplete

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-008` |
| Title | Privileged mutation allowlists and last-owner controls are incomplete |
| Severity | High |
| Affected trace IDs | `ADMIN.RESOURCE.MUTATE`, `ACCOUNT.TEAM.CHANGE_ROLE`; full trace contracts missing |
| Affected environments | All admin/team/page mutation environments |
| Affected actors | Administrator, moderator, team/page owner, compromised privileged session |
| Affected records | Users/roles, plans/prices, invitations, support/bugs, retention/deletion targets, storage paths, team/page ownership |
| Data classification | High-impact administrative, billing, personal and retention data |
| Source file | `src/app/admin/mutations.ts`; `src/lib/admin-input-contract.ts`; `src/lib/admin-status-contract.ts`; `src/lib/admin-service.ts`; `src/lib/admin-access-contract.ts` |
| Source symbol | Imported admin input/status schemas; `updateAdminUserAccess`; `assertAdminSelfAccessChange`; `assertLastAdminAccessChange` |
| Endpoint | Admin server actions and team/page ownership mutations |
| Database operation | `updateAdminUserAccess` uses one DB transaction and a PostgreSQL transaction advisory lock; exact query IDs missing |
| Description | Every privileged property/state transition must use an explicit enum/canonical allowlist, required reason and server policy. Last administrator and last owner protections must be concurrency-safe. |
| Actual behaviour | Typed contracts now allowlist plan/price status, monthly/yearly interval, AUD, organisation invitation member/admin role, source-health status, support status/priority, bug status/severity, entitlement keys and `-1..100000000` limits. Export type, retention/deletion target types and storage targets remain free-form because no authoritative product allowlist exists. Last-administrator demotion/ban now locks, loads current target state, counts active admins and rejects the final active admin; pure tests cover single/two-admin, inactive and no-op cases. Last-owner protection and runtime DB concurrency E2E remain open. |
| Expected behaviour | Canonical enums/state machines/paths, unknown-field rejection, least role, reason/confirmation/audit, atomic last-admin and last-owner guarantees at the database boundary. |
| Attack preconditions | Valid/compromised privileged session, crafted form/action request or concurrent ownership change. |
| Business impact | Privilege escalation, invalid billing/retention state, arbitrary storage/deletion target, organisation lockout or unowned resources. |
| Privacy impact | Unauthorised access/deletion/retention of personal information. |
| Evidence | `src/lib/admin-input-contract.test.ts`, `src/lib/admin-status-contract.test.ts` and `src/lib/admin-access-contract.test.ts`; invitation UI uses a select; targeted test/lint/typecheck reported passing. Remaining target/storage schemas and last-owner matrix are absent. |
| Root cause | Generic resource mutation contracts and application-level role logic without complete domain state models/constraints. |
| Immediate containment | Disable mutation variants without an allowlist; retain last-admin lock/check; require manual dual review for ownership/retention/storage changes. |
| Permanent remediation | Define approved export/retention/deletion target enums and canonical storage targets, add database constraints/state transitions, last-owner lock/constraint, step-up/dual approval as risk warrants and full property/concurrency tests. |
| Regression tests | Existing typed-input/status and pure last-admin tests; add real DB concurrent demotion/ban, last-owner transfer/removal, unknown/mass-assignment fields, wrong role, invalid remaining target/path, duplicate request and audit failure. |
| Owner | GreyhoundIQ administration and tenancy lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially verified; Blocked from release |
| Residual risk | Crafted export/retention/deletion/storage target values and last-owner concurrency can still violate security/business invariants. |
| Retest evidence | Typed-input/status and last-admin targeted tests plus lint/typecheck reported passing; full suite and runtime database concurrency evidence missing. |

## `SEC-H-009` — Internal jobs share static authority; POST-only containment applied

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-009` |
| Title | Internal jobs share static bearer authority; live-sync GET mutation contained |
| Severity | High |
| Affected trace IDs | `INTERNAL.LIVE_SYNC.RUN`, `INTERNAL.COMMUNITY.READINESS`; full trace contracts missing |
| Affected environments | Any deployed internal API surface, scheduler and CI/readiness environment |
| Affected actors | Scheduler, operator, holder of shared secret, external caller reaching route |
| Affected records | Racing data, live sync state, readiness probe data and optional probe-created community rows |
| Data classification | Internal operational data and any records created by probes |
| Source file | `src/lib/internal-auth.ts`; `src/app/api/internal/live-sync/route.ts`; `src/app/api/internal/community-readiness/route.ts` |
| Source symbol | `requireInternalRequest`, `isInternalRequest`, live-sync `POST`/`runLiveSync`, readiness `POST` |
| Endpoint | `/api/internal/live-sync`; `/api/internal/community-readiness`; other callers using the shared helper require inventory |
| Database operation | Sync/probe service operations; exact query IDs and idempotency contracts missing |
| Description | Internal endpoints need per-workload identity, audience and route authorization; state changes must not use GET and probes must not create production data. |
| Actual behaviour | Live sync is POST-only and has a method regression test. A single static bearer secret is still accepted by internal routes, and Community readiness can create real data when its write-probe environment flag is enabled. |
| Expected behaviour | Private ingress or workload OIDC, unique audience/service account per operation, POST-only mutation, schema/idempotency/rate limits and strictly isolated synthetic readiness data. |
| Attack preconditions | Shared secret leak/reuse, route exposure, CSRF-like link/prefetch/cache behavior for GET, or production flag misconfiguration. |
| Business impact | Unauthorised expensive jobs, corrupted/duplicated feed data, provider cost and operational denial. |
| Privacy impact | Probe data or job access can expose/create user-related records outside an authorised purpose. |
| Evidence | Source review; `route.test.ts` proves the live-sync GET export is absent. `check:internal-auth` validates aspects of the current static-secret scheme but not the required identity architecture. |
| Root cause | One convenience secret and route helper reused as broad service identity. |
| Immediate containment | Mutating GET removed. Disable write probes outside isolated staging, rotate/scoped secrets and restrict ingress. |
| Permanent remediation | Workload identity/OIDC audience validation, per-route policies, private service ingress, POST/idempotency and synthetic readiness tenant. |
| Regression tests | Wrong/missing issuer/audience/service account, replay, GET `405`, duplicate POST, feature flag in production, provider/database timeout and audit. |
| Owner | GreyhoundIQ platform and ingestion lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially remediated; Blocked from release |
| Residual risk | One leaked credential can invoke multiple internal operations; readiness writes and workload replay/overlap remain insufficiently constrained. |
| Retest evidence | POST-only route source test passes. No per-workload identity, replay, overlap or readiness-write isolation evidence. |

## `SEC-H-010` — Request correlation and privileged audit evidence incomplete

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-010` |
| Title | Request correlation and privileged audit evidence are incomplete |
| Severity | High |
| Affected trace IDs | `OBSERVABILITY.REQUEST.CORRELATE`, `ADMIN.ACTION.AUDIT`; full trace contracts missing |
| Affected environments | All request/log/audit environments |
| Affected actors | Every user/request; administrators; incident responders; attacker injecting log context |
| Affected records | Application logs, `AuditLog`, `AdminAction`, provider/job events |
| Data classification | Internal/security evidence with selected actor/target personal identifiers |
| Source file | `src/lib/request-id.ts`; `src/lib/logger.ts`; `prisma/schema.prisma` |
| Source symbol | `deriveRequestId`, `getRequestId`, `emit`; Prisma models `AuditLog`, `AdminAction` |
| Endpoint | All routes/actions/jobs; privileged mutation paths are highest impact |
| Database operation | Inserts to `AuditLog`/`AdminAction`; exact query IDs missing |
| Description | Correlation input must be bounded/canonical and propagated to protected append-only audit evidence so an action can be reconstructed without trusting client-controlled log text. |
| Actual behaviour | `deriveRequestId` accepts any non-empty caller `x-request-id` without length/character validation; Cloud trace parsing is also not canonicalised. Structured logs can read a request ID, but `AuditLog` and `AdminAction` have no request/trace/correlation fields. Audit immutability, delivery and required-audit failure handling are unproved. |
| Expected behaviour | Generate or accept only validated IDs, preserve trusted cloud trace separately, propagate trace/action IDs to audit, protect integrity/retention, redact sensitive fields and fail sensitive mutations safely if durable audit is unavailable. |
| Attack preconditions | Caller controls request header or attacker/bug performs a privileged action; incident requires reconstruction. |
| Business impact | Log injection/noise, broken attribution, undetected admin abuse and weak incident/legal evidence. |
| Privacy impact | Investigation cannot reliably identify affected people/records; malicious headers may contaminate logs/analytics. |
| Evidence | Source/model review; no production log sample or alert/audit pipeline test. |
| Root cause | Request logging and durable domain audit were designed separately without a permanent shared trace contract. |
| Immediate containment | Bound/replace caller IDs at the edge, sanitise log fields, restrict audit writes and monitor malformed ID attempts. |
| Permanent remediation | Add trace/correlation schema fields/migration, propagate permanent trace IDs, integrity/retention controls, durable fallback and alerting. |
| Regression tests | Oversize/control/newline/Unicode header; cloud trace forms; propagation across request/job/webhook; audit DB failure; immutability and log redaction. |
| Owner | GreyhoundIQ observability and security operations lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Control missing; Blocked from release |
| Residual risk | Security-relevant actions cannot be reliably joined across request, application, database and provider evidence. |
| Retest evidence | None for end-to-end correlation or protected audit integrity. |

## `SEC-H-011` — Global members-presence topic leaks unrelated presence identifiers

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-011` |
| Title | Global members-presence topic exposes unrelated member presence identifiers |
| Severity | High |
| Affected trace IDs | `PULSE.PRESENCE.SUBSCRIBE`; full trace contract missing |
| Affected environments | All environments with member Realtime enabled |
| Affected actors | Any signed-in member, blocked/unrelated member, target member |
| Affected records | Content-free profile presence identifiers and connection activity |
| Data classification | Personal/relationship metadata |
| Source file | `src/lib/realtime-service.ts` |
| Source symbol | `membersPresenceChannel`, `issueRealtimeAuthorization`, topic grant generation |
| Endpoint | Realtime authorization/token/grant path and Supabase topic subscription |
| Database operation | Profile/session/relationship lookups; exact query IDs missing |
| Description | Presence is privacy-sensitive relationship metadata and must be scoped to a permitted friendship/conversation/team context with block/privacy enforcement. |
| Actual behaviour | The shared members-presence topic and browser subscription have been removed. Tokens contain only the caller's profile broadcast topic and authorized conversation topics; the friend rail makes no online/offline claim. |
| Expected behaviour | Relationship-scoped opaque topics, minimal presence state, explicit privacy/blocks, short expiry/revocation and no global enumerable membership. |
| Attack preconditions | Any valid member account and Realtime connection. |
| Business impact | Stalking/harassment signals, privacy loss, member trust damage and account enumeration support. |
| Privacy impact | Disclosure of when an unrelated or blocked person is active and a stable profile identifier. |
| Evidence | `buildRealtimeTopicGrants()` and `src/lib/realtime-authorization.test.ts` prove that no global presence topic is granted; `friends-polish-contract.test.ts` proves the UI does not subscribe or claim presence. |
| Root cause | Presence convenience channel modelled as a product-wide member feature rather than an object/relationship permission. |
| Immediate containment | Complete: global friend presence is disabled while messaging and calls remain available. |
| Permanent remediation | Friend/conversation/team scoped channels with privacy/block checks at grant and event time, expiry/revocation and opaque identifiers. |
| Regression tests | Unrelated/blocked denial, friend/conversation allow, revoke on block/unfriend, expiry/reconnect, channel guessing/enumeration and tenant boundary. |
| Owner | GreyhoundIQ messaging and privacy lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Source remediation verified; isolated Supabase runtime proof remains tracked by `PREPROD.SUPABASE.REALTIME`. |
| Residual risk | Conversation-topic RLS deployment, expiry, reconnect and revocation still require isolated runtime evidence; global friend presence is no longer available. |
| Retest evidence | `src/lib/realtime-authorization.test.ts`; `src/components/hub/friends-polish-contract.test.ts`. |

## `SEC-H-012` — Security governance claims conflict with implementation and legal guidance

| Finding field | Record |
|---|---|
| Finding ID | `SEC-H-012` |
| Title | Security governance documentation asserts unverified controls and conflicts with legal guidance |
| Severity | High |
| Affected trace IDs | `GOVERNANCE.THREAT_MODEL.VERIFY`; full trace contract missing |
| Affected environments | Documentation, Design Lab/release review and operational decision-making |
| Affected actors | Developers, reviewers, operators, privacy/security owner, affected users |
| Affected records | Security requirements, incident/privacy decisions and release evidence |
| Data classification | Internal governance; privacy/legal impact |
| Source file | `docs/planning/security-threat-model.md`; this `docs/security/**` evidence set |
| Source symbol | Claims concerning CAPTCHA/cooldowns, moderator agent, AI isolation, incident runbook and APP 11/NDB timing |
| Endpoint | Not applicable; governance/control-evidence finding |
| Database operation | Not applicable |
| Description | Security claims must point to implemented files/tests/evidence and accurately state APP 11/NDB obligations. Aspirational planning cannot be treated as a verified control. |
| Actual behaviour | The planning artifact claims controls not found in inspected code, refers to a missing incident runbook, and used inaccurate APP 11/NDB wording. This evidence layer now marks uncertainty, supplies an incident process and correctly treats 30 calendar days as the maximum reasonable suspected-breach assessment period, with eligible-breach notification as soon as practicable. The stale planning claims and lack of automated claim validation remain. |
| Expected behaviour | One authoritative evidence hierarchy; every claim linked to code/test/config; owner/review date; accurate legal guidance reviewed by counsel/privacy owner; stale docs fail CI. |
| Attack preconditions | Reviewer/operator relies on planning claims or delays/misdirects incident response. |
| Business impact | Unsafe release approval, missing controls, delayed containment/notification and regulatory/reputation harm. |
| Privacy impact | Inadequate protection/response for personal information and incorrect breach handling. |
| Evidence | `docs/planning/security-threat-model.md`; repository searches for claimed controls; OAIC APP 11 and NDB guidance linked in `privacy-data-lifecycle.md` and `incident-response.md`. |
| Root cause | Planning, implementation and verification status were not separated or generated from an authoritative registry. |
| Immediate containment | Treat `docs/security/**` as the current evidence layer, keep release blocked and label unverified planning claims as non-evidence in review. |
| Permanent remediation | Reconcile/supersede stale planning content, generate coverage/status docs from registries, add link/claim checks and obtain privacy/legal owner approval. |
| Regression tests | CI checks for missing file/symbol/test links, unsupported `Verified` claims, owner/review date, expired acceptance and approved APP 11/NDB wording. |
| Owner | GreyhoundIQ security governance and privacy lead; named individual required |
| Target date | Before production promotion; calendar date unassigned |
| Status | Partially verified by this evidence layer; Blocked from release |
| Residual risk | Reviewers can still encounter contradictory planning material and infer controls that do not exist. |
| Retest evidence | Evidence documents created; stale-source reconciliation, owner approval and automated governance checks missing. |

## Acceptance and closure controls

- No finding above is accepted temporarily.
- A proposed acceptance must state a named owner, written reason, severity, compensating controls, calendar expiry, remediation plan and retest requirement. It cannot silently accept an unresolved Critical/High release risk.
- Closure requires code/config remediation, negative and regression tests, full relevant suite, authorised staging evidence, registry/query/API updates and security-owner retest against the same candidate.
- Downgrading severity or changing expected test output requires documented security review; difficulty discovering a route is not a compensating control.
