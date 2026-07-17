# Current repository evidence

Re-verify these paths before relying on the claims. They describe source, not live infrastructure.

## Runtime and deployment

- `.github/workflows/cloud-run-deploy.yml` and `scripts/gcp-cloud-run-deploy.ps1` declare the current Cloud Run deployment shape.
- The 2026-07-14 checkout declares 2 CPU, 4 GiB, concurrency 20, minimum 3, maximum 10, and public invocation in the protected deploy workflow. This is source intent only; live revision parity and direct-origin blocking remain unverified.
- `docs/gcp-cloud-run-migration-plan.md` describes a global external Application Load Balancer and Cloud Armor/CDN as future work; it is not deployment evidence.
- `scripts/staging-load-probe.ts` is the existing isolated capacity probe.

## Data path

- `src/lib/db.ts` owns the process Prisma client and slow-query warnings.
- `src/lib/database-url.ts` recognizes Supabase transaction pooling and defaults to a one-connection process budget.
- `src/lib/db-context.ts` wraps request/system/anonymous work in interactive transactions and sets transaction-local RLS context with `set_config`.
- `prisma/schema.prisma` and `prisma/migrations/` contain a PostgreSQL-specific schema with RLS, SQL functions, triggers, materialized views, and indexes. AlloyDB compatibility must be rehearsed, not assumed.
- `src/lib/supabase-storage.ts` and `src/lib/realtime-service.ts` are direct Supabase Storage and Realtime dependencies.

## API and security

- `openapi.json` is the canonical candidate, currently OpenAPI 3.0.3.
- The 2026-07-14 local candidate passes `npm run check:openapi-static` with zero error-severity findings. `npm run check:openapi-contract` also proves 104 authenticated operations and 62 rate-limited operations are synchronized with the source registries. This is local contract evidence only; an authorised deployed ESPv2 rejection, quota, correlation and origin-bypass exercise is still required before the API-security pre-production gate can pass.
- `src/lib/rate-limit.ts`, application authorization, and PostgreSQL RLS remain required behind any gateway.

## Observability

- `src/lib/request-id.ts` derives a request ID from the load balancer trace header or creates a UUID.
- `src/lib/logger.ts` emits structured warning/error JSON suitable for Cloud Logging and Error Reporting.
- Existing request correlation and slow-query logging are foundations, not a complete tracing, metrics, alerting, SLO, or incident system.

## Database release blockers

- `docs/security/database-inventory.md`
- `docs/security/frontend-server-database-map.md`
- `docs/security/database-role-matrix.md`

These documents intentionally label live topology, roles, pooling, high availability, backups, extensions, and restore evidence unverified.
