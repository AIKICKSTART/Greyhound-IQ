# Secrets register

Status: **Names/source paths inventoried; live custody Not verified**  
Evidence date: 2026-07-13  
Owner: cloud platform/security owner; named custodians required before release

No secret value was read or copied. Repository references identify these credential classes:

| Class | Environment names (names only) | Expected use/storage | Verification |
|---|---|---|---|
| Database | `DATABASE_URL`, `DIRECT_URL`, `DATABASE_IMPORT_URL`, `CHECK_RLS_DB` | Runtime, migrations/import and authorised RLS verification; Google Secret Manager/GitHub protected secret | Principal/scope/TLS/rotation unverified |
| Session/identity | `NEXTAUTH_SECRET`, `AUTH_SECRET`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` | Server session/AuthKit; Secret Manager | Rotation/session invalidation unverified |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `REALTIME_CHANNEL_SECRET` | Server storage/realtime administration/signing | Scope/rotation/provider custody unverified |
| Billing | `STRIPE_SECRET_KEY` or `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, `LAGO_API_KEY`, `LAGO_WEBHOOK_SECRET` | Server API/webhook verification | Restricted scope/rotation/revocation unverified |
| Calls | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Server token/webhook/room administration | Scope/rotation unverified |
| Internal jobs | `INTERNAL_API_SECRET`, legacy `INTERNAL_SECRET`, `CRON_SECRET` | Internal route bearer/header authentication | Shared static-secret design is High finding `SEC-H-009` |
| AI/racing/notification | `OPENAI_API_KEY`, `TOPAZ_API_KEY`, `NOTIFICATION_WEBHOOK_SECRET` | Server external integrations | Scope, cost limits, rotation and retention unverified |
| CI/load probes | `OPENAI_API_KEY`, deployment OIDC identity inputs, `LOAD_INTERNAL_SECRET`, `LOAD_TEST_COOKIE` | CI review/deploy or authorised staging probes only | Pull-request isolation and lifecycle require candidate evidence |

`WORKOS_CLIENT_ID`, publishable/anonymous browser keys and `NEXT_PUBLIC_*` URLs are identifiers/public configuration, not confidential secrets, but still require environment integrity. Deployment source binds many server values from Google Secret Manager using `:latest`; exact versions, last rotation, owner, revocation and rollback are not bound to the candidate. Local `.env` files were not inspected.

Secret scanning exists in CI/release tooling, but no current immutable-candidate scan or client-bundle attestation was supplied. Cloud security must produce per-secret owner, environment, scope, storage, version, last/next rotation, services, revocation/incident procedure and proof it is absent from source/logs/analytics/client bundles. Until then secret custody is **Not verified** and release remains blocked.

