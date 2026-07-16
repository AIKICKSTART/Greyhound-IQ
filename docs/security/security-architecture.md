# GreyhoundIQ security architecture

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-13
Owner: GreyhoundIQ security lead
Authoritative checklist: `src/components/security-master-requirements.ts`

## Assurance basis

This document describes the repository and deployment configuration that was inspected. It does not claim that the running Google Cloud, Supabase, WorkOS, Stripe, Lago or LiveKit tenants match the repository. No production secrets, private records, production sessions, intrusive tests or destructive queries were used.

The verification baseline is [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/), [OWASP Top 10:2025](https://owasp.org/www-project-top-ten/), [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/), and [NIST SSDF 1.1](https://csrc.nist.gov/Projects/ssdf/publications). Australian privacy handling is mapped to [OAIC APP 11 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information) and the [Notifiable Data Breaches scheme](https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches). PCI DSS applicability has not been legally scoped; the observed checkout design sends card entry to Stripe and must continue to keep card data outside GreyhoundIQ servers.

## System boundary

| Component | Repository evidence | Exposure and identity | Data handled | Verification |
|---|---|---|---|---|
| Browser application | `src/app/**`, `src/components/**` | Public HTTPS client; untrusted input | Public racing data, account UI, community content, messages, upload metadata | Partially verified |
| Request security and session middleware | `src/proxy.ts` `proxy` | Public Cloud Run request path; WorkOS AuthKit proxy | Cookies, origin, CSP nonce, request ID | Partially verified |
| Next.js server | `package.json`, `Dockerfile` | Public Cloud Run web service, Node 24 / Next.js 16.2.10 | All application reads and mutations | Partially verified |
| Identity provider | `src/app/sign-in/route.ts`, `src/app/callback/route.ts`, `src/lib/auth.ts` | WorkOS AuthKit | Identity, hosted authentication, session lifecycle | Provider configuration not verified |
| Application database | `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/db-context.ts` | PostgreSQL through Prisma | Identity links, profiles, racing, community, billing snapshots, audit | RLS/runtime role not verified; `SEC-H-006` |
| Supabase services | `src/lib/supabase-storage.ts`, `src/lib/realtime-service.ts` | Server service credential plus short-lived client Realtime JWT | Private media, public media, Realtime grants/presence | Partially verified; SQL deployment not verified |
| Media scanner | `Dockerfile`, `.github/workflows/cloud-run-deploy.yml` | Private Cloud Run service | Uploaded bytes and metadata | Identity/secrets over-privileged; `SEC-H-004` |
| Billing providers | `src/lib/billing/stripe-*.ts`, `src/lib/billing/lago-*.ts` | Server API credentials and signed webhooks | Customer/provider IDs, invoices, entitlements | Stripe settlement tests passed; provider tenants not verified |
| Voice/video provider | `src/lib/call-token.ts`, `src/lib/livekit-admin.ts` | Short-lived scoped participant token; signed webhook | Room and participant IDs; no media recording observed | Partially verified |
| Racing-data ingestion | `src/lib/live/**`, `src/app/api/internal/live-sync/route.ts`, `scripts/sync-live.ts` | Internal static-secret endpoint and scheduled/CLI jobs | Provider records, raw source data, results, replay URLs | Partially verified; internal identity high risk `SEC-H-009` |
| AI/agent service | `src/lib/agent-service.ts` | Authenticated member; server-created run | User prompt, memories, generated output, usage | Entitlement/cost enforcement incomplete; `SEC-H-007` |
| CI/CD | `.github/workflows/ci.yml`, `.github/workflows/cloud-run-deploy.yml`, `cloudbuild.yaml` | GitHub OIDC to Google Cloud | Source, build args, image digest, deployment config | Partially verified; `SEC-H-004` and `SEC-H-005` |
| Design Lab | `src/app/design-lab/**`, `src/lib/design-lab-access-policy.ts`, `src/lib/demo-access.ts`, `src/components/design-lab-release-gate.ts` | Local allowed; production app requires exact flag plus administrator; explicitly isolated synthetic full-access demo allowed | Synthetic fixtures and simulated roles | Six routes call `requireDesignLabReviewer`; focused policy/route/isolation tests pass; complete runtime data/mutation isolation not verified |

## Control architecture

### Identity and session

- `src/proxy.ts` delegates session management to `authkitProxy`.
- `src/lib/auth.ts` resolves the WorkOS subject to the local `User` and `Profile`; banned users are denied by `requireCurrentUserProfile`.
- `src/lib/workos-redirect.ts` accepts only an internal return path and rejects protocol-relative, backslash and control-character forms. `src/lib/workos-redirect.test.ts` is evidence for this control.
- `src/app/callback/route.ts` uses AuthKit `handleAuth`, syncs the local user and sends failures to a safe recovery page with a generated reference.
- WorkOS tenant MFA, session lifetime, idle timeout, concurrent-session, recovery and privileged step-up settings are **Not verified**.

### Authorisation

- Server guards are `requireCurrentUserProfile`, `requireModeratorProfile` and `requireAdminProfile` in `src/lib/auth.ts`.
- Object access is implemented in domain services, including conversation, listing, media and call services. There is no completed action-to-policy registry proving every object and property path.
- `src/app/admin/admin-nav-data.ts` now marks the dashboard, people/access, billing, compliance, retention, exports, audit/actions, jobs, webhooks, usage and source-health surfaces administrator-only; their page loaders call `requireAdminProfile()`. Moderator `/admin` resolves to `/admin/reports`, desktop/mobile brand links use `adminHomeForRole`, and support/bug/feedback surfaces render explicit read-only moderator explanations and Administrator-required mutation badges. Static role-aware navigation/server-guard and read-only presentation tests pass. `SEC-H-001` remains release-blocking until runtime moderator-negative end-to-end tests prove direct requests cannot render admin-only screens/data or mutate read-only queues and each remaining moderator-visible route has an explicit least-privilege policy.
- Request-context RLS uses transaction-local PostgreSQL settings in `src/lib/db-context.ts`; system context sets `app.system=true` on the same application connection. Deployment does not yet prove a non-bypass runtime role (`SEC-H-006`).

### Input and output

- Zod is used by many route handlers and server actions. New `admin-input-contract` and `admin-status-contract` allowlists cover plan/price state, interval/currency, organisation invitation role, source-health, support, bug and entitlement inputs. Export type, retention/deletion target type and storage targets still lack authoritative product allowlists (`SEC-H-008`).
- Prisma parameterises ordinary values. A complete generated-SQL and bounded-query registry does not exist, so repository-wide injection, field-selection and cardinality claims remain **Not verified**.
- `src/proxy.ts` applies per-request CSP, blocks encoded path separators and cross-origin browser mutations, and sets response security headers with `next.config.ts`.

### Data, media and realtime

- `withDbRequestContext` establishes user/profile/tier/role settings inside a database transaction.
- Private media lookup no longer grants a moderator bypass; `src/lib/media-service.test.ts` is focused evidence.
- Conversation Realtime grants are revalidated after issuance and revoked when a block changes. The required Supabase RLS SQL exists at `scripts/sql/supabase-private-realtime-policies.sql` but is not proven deployed.
- Global member presence is disabled: authorization grants only the caller profile broadcast topic and authorized conversation topics, and the friend rail makes no online/offline claim. Isolated Supabase RLS, expiry and reconnect proof remains a pre-production requirement.

### Billing

- Checkout uses server allowlisted Stripe price identifiers.
- Signed Stripe webhooks use the raw body, provider verification and database uniqueness for deduplication.
- Entitlements are granted only after a paid, bound, allowlisted invoice; focused settlement tests passed.
- Entitlement snapshot parsing now accepts exactly the documented `-1` unlimited sentinel and rejects lower/type-confused/incomplete values, with a focused test. Pro+ checkout and consumption-based agent enforcement remain incomplete (`SEC-H-007`). Browser return parameters are informational only.

### Logging and audit

- `src/lib/logger.ts` writes structured JSON events and instructs callers not to pass secrets.
- `src/proxy.ts` creates a request ID, but the caller header is not bounded and `AuditLog`/`AdminAction` have no trace or correlation fields (`SEC-H-010`).
- Audit immutability, alert delivery, retention and production log redaction have not been verified.

### Delivery

- CI performs a pinned Gitleaks scan, pinned Semgrep rules, `npm audit --audit-level=high`, migrations, security checks, unit tests, lint and production build.
- Production deployment requires an exact SHA, successful CI, immutable image digest and candidate web smoke test. Design Lab evidence is internal review material only.
- Project-wide deployment privilege, shared runtime identity/secrets, scanner validation, migration/backup binding, signing/SBOM/provenance and rollback remain release blockers (`SEC-H-004`, `SEC-H-005`).

## Release decision

Production promotion is **Blocked from release**. The 12 high findings are recorded in `risk-register.md`; none is accepted. The complete machine checklist currently contains 2,288 release-blocking requirements, of which 6 are Verified, 36 are Partially verified and 2,246 are Not assessed. See `release-security-report.md` for the release decision and exclusions.
