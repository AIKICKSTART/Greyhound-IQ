# Trust boundaries

Status: **Partially verified**
Evidence date: 2026-07-13
Owner: GreyhoundIQ security lead

## Boundary register

| ID | Boundary | From / to | Trust change and sensitive data | Enforced controls | Status / gap |
|---|---|---|---|---|---|
| TB-01 | Internet edge | Browser to Cloud Run web | Anonymous input, cookies, uploads, query/path values | HTTPS at platform; `src/proxy.ts` origin/path checks, CSP, request ID | Edge/WAF/DNS/TLS tenant configuration Not verified |
| TB-02 | Identity | Browser/app to WorkOS | Authentication codes, PKCE/state, session | AuthKit proxy and callback; safe internal return path | WorkOS tenant/session/MFA settings Not verified |
| TB-03 | Application authorisation | Session to local `User`/`Profile` | Subject, role, tier, ban/deletion state | `src/lib/auth.ts`, `src/lib/auth-sync.ts` | Complete role/object/property matrix missing |
| TB-04 | Database | Next.js to PostgreSQL | All persisted application and personal data | Prisma parameters; transaction-local request context | Runtime role/TLS/RLS deployment not proven; `SEC-H-006` |
| TB-05 | System database context | App code to `app.system=true` | Cross-user and privileged records | Explicit `withDbSystemContext` call | Same application pool can request system context; broad call surface |
| TB-06 | Storage | Next.js to Supabase/GCS object storage | Private/public media and exports | Server-generated paths, signed access, scan state | Physical deletion and bucket IAM not live-verified |
| TB-07 | Realtime | Browser to Supabase Realtime | Conversation events, presence IDs | HMAC topic, short-lived JWT, exact grants, RLS SQL | SQL deployment not proven; global member presence `SEC-H-011` |
| TB-08 | Billing | App/webhook to Stripe and Lago | Customer IDs, price IDs, payment/subscription state | Secret API calls, signed raw-body webhooks, deduplication | Provider tenant, webhook freshness and out-of-order matrix incomplete |
| TB-09 | Calls | Browser/app to LiveKit | Room/participant IDs, short-lived call token | Membership check, 10-minute token, signed webhook | Provider room configuration and all event replay cases Not verified |
| TB-10 | Racing providers | Internal job to external sources | Raw racing feed, replay/provider URLs | Server-only provider clients and parsers | Provider allowlists, response budgets and provenance incomplete |
| TB-11 | AI provider/harness | App to agent runtime | User prompt, memory, output, cost | Structured application service and usage event | Runtime isolation/provider identity not evidenced; cost gates incomplete |
| TB-12 | Internal jobs | Scheduler/operator to `/api/internal/**` | Privileged sync/probe/job commands | Timing-safe comparison against static secret | Interchangeable secrets and mutating GET; `SEC-H-009` |
| TB-13 | Administration | Moderator/admin browser to privileged services | PII, billing, compliance, audit and mutations | Administrator-only navigation metadata and page guards now cover the identified high-risk read surfaces; required reasons protect many mutations | Static remediation present, but runtime moderator-negative E2E and explicit policies for each remaining moderator surface are missing; `SEC-H-001`, `SEC-H-008` |
| TB-14 | Design Lab | Reviewer browser to preview server | Synthetic fixtures, simulated role/tier | Exact local/production/isolated-demo policy; production app requires admin; six route guards; noindex/read-only tests | Complete runtime no-production-data/mutation proof not available |
| TB-15 | Build | GitHub/Cloud Build to Artifact Registry | Source, public build args, image | OIDC, CI, digest resolution | No SBOM/signing/provenance; `SEC-H-005` |
| TB-16 | Promotion | GitHub to Cloud Run/Secret Manager | Deployment identity, runtime secrets, traffic | Protected environment, SHA/evidence binding, candidate smoke | Broad IAM/shared secrets/non-atomic promotion; `SEC-H-004`, `SEC-H-005` |
| TB-17 | Operations | Runtime to logs/audit/alerts | Actor, target, outcomes, errors | Structured logger and DB audit rows | Correlation and alert evidence incomplete; `SEC-H-010` |
| TB-18 | Backup/recovery | Database/storage to backup stores | Complete historical data, deleted data | Documented GCS backup bucket target | Current PITR/full restore/retention not verified |

## Data-classification crossings

| Classification | Examples | Permitted crossings | Required rule |
|---|---|---|---|
| Public | Published racing records, approved listings, public profile fields | Browser, CDN/cache, search indexing | Explicit public projection; source/time disclosure |
| Internal | Operational health, job state, aggregate metrics | Authenticated operator and private monitoring | No public health detail or provider payload |
| Personal | Email, identity link, profile, support, enquiry, presence | User, authorised service, least-privilege support | Object/relationship check; no public cache |
| Private content | Messages, attachments, calls, private profiles | Participants/owners only | Membership plus block/privacy check at every request and subscription |
| Financial metadata | Stripe/Lago customer, invoice, subscription and payment identifiers | Owner and authorised billing operator | Provider-backed state, explicit field projection, audit |
| Security-sensitive | Session, API keys, webhook secrets, DB URLs, signed tokens | Server runtime/secret manager only | Never client, docs, analytics or ordinary logs |
| High-impact administrative | Role, tier, ban, deletion, exports, entitlement state | Explicit administrator or narrower operator role | Step-up where appropriate, reason, confirmation, immutable audit |

## Architectural rule

Every boundary is deny-by-default. Browser-supplied identity, role, tier, owner, tenant, payment, verification, visibility or object state is a usability hint only; authoritative values must be resolved server-side. An unavailable identity, policy, relationship, entitlement or tenant context denies the operation.
