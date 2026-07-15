# PG Durable SQL MVP non-adoption decision

Status: **verified non-adoption for MVP**

Decision owner: Database architecture owner

Review date: 2026-07-15

## Decision

PG Durable SQL is not adopted for the GreyhoundIQ MVP. Prisma and PostgreSQL
remain the production source of truth. The MVP adds no PG Durable dependency,
extension, background worker, schema object, queue or provider call.

This decision closes the MVP evaluation item through tested non-adoption. It
does not verify PG Durable itself or approve it for production. A future
evaluation remains a separate post-MVP architecture decision.

The local plugin is a reference skill generated from the Microsoft
`pg_durable` project snapshot at commit
`188b2d34ad10907d5d8ccff7d4ce84009adb9e3b`. It does not connect to or manage
the GreyhoundIQ database. The upstream feature remains preview software and its
current published setup targets PostgreSQL 17, while this repository currently
uses PostgreSQL 15 locally and PostgreSQL 16 in CI. The production PostgreSQL
major and extension policy have not been verified.

Official references:

- <https://microsoft.github.io/pg_durable/>
- <https://learn.microsoft.com/en-us/azure/horizondb/development/durable-functions>

## Suitable experiment candidates

- A bounded racing-ingestion stage that writes only provider-public data.
- A resumable aggregate refresh with an idempotent result key.
- A synthetic-data retention or cleanup workflow in the isolated Design Lab.
- A local backfill/replay job whose inputs and outputs are fully allowlisted.

Do not use the experiment for authentication callbacks, Stripe payment state,
webhook authority, private messaging, LiveKit call credentials, production
deployment approval, or any action that can bypass the existing server policy
and audit path.

## Architectural concerns to prove

1. `pg_durable` requires `shared_preload_libraries` and a background worker, so
   its operational and patching lifecycle differs from an ordinary extension.
2. Submitted SQL executes under a database role. GreyhoundIQ resolves identity,
   tenancy and permissions in WorkOS-backed application context and request
   GUCs, not one PostgreSQL login per end user. A server-defined workflow must
   re-establish the least-privilege actor and tenant context for every step.
3. Worker administration can require elevated database privileges. The normal
   application role must never receive extension, schema, role, RLS-bypass or
   superuser powers.
4. Durable retries do not make business operations idempotent. Every workflow
   requires an actor/object-bound idempotency key, affected-row checks and safe
   duplicate/out-of-order behaviour.
5. Raw or client-authored SQL workflow definitions are prohibited. Only fixed,
   versioned, reviewed server definitions with allowlisted parameters may run.
6. RLS, audit logging, timeouts, cancellation, resource limits, backup/restore,
   upgrade and rollback behaviour must be tested after worker restart and
   database failover.

## Isolated spike contract

The spike must run on a separate PostgreSQL 17-compatible container or staging
instance. It must not change `docker-compose.local-db.yml`, production
migrations, production data or the canonical Prisma connection.

Required evidence:

- Pinned PostgreSQL and `pg_durable` versions plus image digests.
- Installation and removal runbook with no production credential.
- Dedicated non-superuser submitter and worker-role privilege matrix.
- Synthetic tenant A/B data with cross-tenant and wrong-owner denial tests.
- Fixed workflow definitions, schema validation and parameter allowlists.
- Restart, retry, duplicate, out-of-order, cancellation and timeout tests.
- RLS/session-context tests under pooling.
- Normalized SQL, query plans, bounds, locks and transaction evidence.
- Audit-event continuity and secret/private-value redaction.
- Backup/restore and extension-upgrade rehearsal.
- A measured comparison against the existing queue/worker approach.

## Future adoption gate

The Design Lab item `PREPROD.PG_DURABLE.EVALUATION` is verified only for the MVP
non-adoption decision. Adoption remains prohibited until all spike evidence is
reviewed, the production PostgreSQL topology is verified, and a new written
architecture decision identifies a clear reliability benefit that outweighs
the additional database privilege and operational surface. Failure of any
future experiment leaves the canonical Prisma/PostgreSQL implementation
unchanged.
