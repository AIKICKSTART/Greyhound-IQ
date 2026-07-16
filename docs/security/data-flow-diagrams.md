# Data-flow and trust-boundary diagrams

Status: **Partially verified**
Evidence date: 2026-07-13
Owner: GreyhoundIQ security lead

Legend: `TB-nn` references `trust-boundaries.md`. Dashed nodes or text marked `Not verified` describe external configuration that was not inspected.

## 1. Public browsing

```mermaid
flowchart LR
  V[Public visitor] -->|HTTPS TB-01| P[src/proxy.ts]
  P --> N[Next.js public route]
  N -->|TB-04 anonymous/request context| D[(PostgreSQL public projection)]
  N -->|public media| S[(Supabase or GCS)]
  N --> V
```

Public cache, CDN/WAF and canonical-host configuration are Not verified.

## 2. Authentication

```mermaid
flowchart LR
  U[User] --> SI[/sign-in]
  SI -->|safe return path| W[WorkOS AuthKit TB-02]
  W -->|code plus state| CB[/callback handleAuth]
  CB --> AS[src/lib/auth-sync.ts]
  AS -->|system context TB-05| DB[(User Profile SocialActor)]
  CB -->|session cookie and internal redirect| U
```

WorkOS tenant MFA, recovery and session settings are Not verified.

## 3. Authenticated application use

```mermaid
flowchart LR
  U[Signed-in member] -->|cookie TB-01| P[authkitProxy]
  P --> A[requireCurrentUserProfile]
  A -->|WorkOS subject TB-03| L[(Local User and Profile)]
  A --> S[Domain service]
  S -->|withDbRequestContext TB-04| DB[(PostgreSQL)]
  S --> U
```

## 4. Administration

```mermaid
flowchart LR
  O[Moderator or administrator] --> G[requireModeratorProfile or requireAdminProfile]
  G --> UI[Admin page or server action]
  UI --> V[Zod schema and business guard]
  V -->|TB-05| DB[(Privileged records)]
  V --> AU[(AuditLog and AdminAction)]
  AU --> O
```

Administrator-only metadata and page guards now protect the identified high-risk read surfaces, with a static regression test. Runtime moderator-negative end-to-end evidence and explicit least-privilege policies for every remaining moderator surface are still missing (`SEC-H-001`); privileged mutation allowlists remain incomplete (`SEC-H-008`).

## 5. Billing

```mermaid
flowchart LR
  U[Member] --> C[POST checkout creation]
  C -->|server price allowlist| ST[Stripe checkout TB-08]
  ST --> U
  ST -->|signed raw webhook| WH[/api/webhooks/stripe]
  WH -->|dedupe and settlement checks| DB[(WebhookEvent User tier)]
  U -->|informational return only| B[Billing page]
  B --> DB
```

The Stripe settlement reducer is focused-test verified; provider tenant configuration is Not verified.

## 6. Racing-data ingestion

```mermaid
flowchart LR
  J[Scheduler or operator] -->|static internal identity TB-12| I[/api/internal/live-sync or CLI]
  I --> P[Racing provider client TB-10]
  P --> V[Parser and normaliser]
  V -->|system context| DB[(Meeting Race Runner Result Raw archive)]
  DB --> C[Public racing pages]
```

Mutating GET and interchangeable static secrets are blocked by `SEC-H-009`.

## 7. Community content

```mermaid
flowchart LR
  M[Member] --> F[Feed forum group action]
  F --> A[Auth ownership role and Zod checks]
  A -->|request context| DB[(Post Thread Comment Reaction Report)]
  DB --> R[Visibility-filtered response]
  R --> M
  A --> Q[Notification and moderation side effects]
```

Complete group membership and moderator action traces are Not verified.

## 8. Private messaging

```mermaid
flowchart LR
  A[Participant A] --> M[Conversation service]
  M --> C{Membership privacy block check}
  C -->|deny| X[Safe not-found or forbidden]
  C -->|allow| DB[(Conversation Message Receipt)]
  DB --> G[Realtime exact topic grant TB-07]
  G --> B[Participant B]
```

Blocked-conversation grant revocation has focused tests; production RLS deployment is Not verified.

## 9. Voice and video calls

```mermaid
flowchart LR
  U[Conversation participant] --> CS[Call service]
  CS --> M{Conversation membership and block}
  M -->|allow| T[10-minute LiveKit token]
  T --> LK[LiveKit room TB-09]
  LK -->|signed webhook| W[/api/livekit/webhook]
  W --> DB[(CallRoom Participant Event)]
```

## 10. Marketplace

```mermaid
flowchart LR
  B[Buyer] --> Q[Bounded public search]
  Q --> DB[(Approved active listings)]
  S[Seller] --> M[Create edit publish action]
  M --> O{Owner role status transition}
  O --> DB
  B --> E[Save or enquiry]
  E --> DB
```

Complete publication, verification and abuse traces are Not verified.

## 11. File uploads and downloads

```mermaid
flowchart LR
  U[Authenticated owner] --> R[Upload reservation]
  R --> V[Size type quota and server key]
  V --> Q[(Private quarantine storage TB-06)]
  Q --> SC[Private scanner Cloud Run]
  SC --> DB[(MediaAsset scan state)]
  D[Authorised reader] --> A{Owner participant visibility check}
  A -->|allow| Q
```

Scanner identity/secrets are over-broad (`SEC-H-004`); live bucket and malware controls were not inspected.

## 12. Data export

```mermaid
flowchart LR
  U[Account owner] --> E[/api/users/me/export]
  E --> A[Same-origin check, auth and fail-closed rate limit]
  A -->|request context and explicit projections| DB[(Bounded user-owned records)]
  DB --> J[Forbidden-key assertion and 8 MiB JSON cap]
  J --> U
  E --> AU[(ExportArtifact and AuditLog)]
```

Every collection is capped at 500, nested media at 20, sensitive provider/storage/raw-agent fields are excluded, and the response is private `no-store` with a safe `413` overflow path. The focused policy test, all 108 source unit tests, typecheck, lint and build pass. `SEC-H-003` remains release-blocking pending runtime cross-user/large-account tests, a managed background-export path for larger accounts and review of creating `ExportArtifact` through GET.

## 13. Account deletion

```mermaid
flowchart LR
  U[Account owner] --> R[requestAccountDeletion]
  R -->|30-day grace| DB[(Banned pending user)]
  J[Maintenance job] --> F[runAccountDeletionMaintenance]
  F --> DB[(Local identity, social actor, authored content and media tombstones)]
  F --> Q[(Durable exact-prefix storage deletion jobs)]
  Q -->|bounded 500 objects, lease and audit| OS[(Private and public object storage)]
  F -. retained references; no remote deletion .-> W[WorkOS Stripe Lago other providers]
```

Focused tests plus the 108-test source suite prove sender-only message tombstoning and the bounded storage-job contract. Live storage deletion, provider cancellation/deletion, provider session revocation, managed-page last-owner transfer and backup lifecycle are not verified; `SEC-H-002` remains release-blocking.

## 14. AI tools

```mermaid
flowchart LR
  U[Entitled member] --> A[runAgentForCurrentUser]
  A --> T[Static tier check]
  T --> M[(Memory and context)]
  T --> H[Agent harness or generated output TB-11]
  H --> DB[(AgentRun UsageEvent AuditLog)]
  DB --> U
```

Snapshot/consumption/cost enforcement and runtime isolation are blocked by `SEC-H-007` and `SEC-H-012`.

## 15. Design Lab

```mermaid
flowchart LR
  R[Reviewer] --> G[Server Design Lab gate TB-14]
  G --> F[Synthetic fixture registry]
  F --> UI[Screen and state preview]
  UI --> X[Simulated action only]
  X -. no production mutation .-> DB[(Production systems)]
```

`requireDesignLabReviewer` is called by all six Design Lab routes: local access is allowed, production app access requires the exact flag plus administrator, and explicitly isolated full-access demo mode is synthetic/public by design. Focused noindex/read-only/policy/route/isolation tests pass. Complete runtime route/action data-isolation proof remains Partially verified.

## 16. CI/CD and deployment

```mermaid
flowchart LR
  D[Developer pull request] --> CI[GitHub CI TB-15]
  CI --> SAST[Gitleaks Semgrep npm audit tests build]
  SAST --> A[Protected production approval]
  A --> B[Cloud Build image]
  B --> AR[(Artifact Registry digest)]
  AR --> C[No-traffic web and scanner revisions]
  C --> SM[Web candidate smoke]
  SM --> P[Cloud Run traffic promotion TB-16]
  K[(Secret Manager latest)] --> C
```

Scanner smoke, least-privilege identities, secret-version pinning, SBOM/signing/provenance, migration/backup binding and automatic rollback remain blocked by `SEC-H-004` and `SEC-H-005`.
