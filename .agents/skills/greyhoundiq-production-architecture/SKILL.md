---
name: greyhoundiq-production-architecture
description: Select, review, document, or verify GreyhoundIQ's Australia-only production backend architecture. Use for Cloud CDN and Cloud Armor, global external load balancing, Sydney/Melbourne Cloud Run cells, API gateway policy, Prisma/PostgreSQL/AlloyDB decisions, Supabase migration boundaries, viral traffic, DDoS resilience, queues, observability, disaster recovery, or Design Lab production-gate evidence.
---

# GreyhoundIQ Production Architecture

Build the smallest production design that can absorb an unannounced Australian traffic spike without moving GreyhoundIQ customer data or application compute outside Australia.

## Safety and evidence

- Do not inspect or mutate live cloud or production resources without Daniel's explicit authorization for that exact action.
- Default all commands to repository inspection, localhost, or isolated staging with synthetic data.
- Never expose credentials, service-role keys, tokens, database URLs, or credential paths.
- Treat repository configuration as declared intent, not proof of a live deployment.
- Mark every untested or unobserved claim `unverified`; Design Lab stays fail-closed until runnable evidence exists.

## Start here

1. Read the root `AGENTS.md` and the nearest child `AGENTS.md` for every file in scope.
2. Confirm the `E-greyhoundiq` codebase-memory project is indexed; use graph tools before text search for code discovery.
3. Read `references/current-repo-evidence.md` and verify any drift-prone claim against the current worktree.
4. Read `references/australia-target.md` before changing architecture, deployment, API, database, CDN, or observability plans.
5. Read `references/architecture-mandate.md` for a production review, capacity model, failure analysis, incident plan, or Design Lab architecture artifact.
6. Apply the production gate in `references/viral-readiness-gates.md` before calling the system launch-ready.

## Selected architecture

Use this target unless new measured evidence invalidates it:

- Australian consumer traffic enters a Premium-tier global external Application Load Balancer. The edge is global defensive infrastructure; application compute and persistent customer data remain in Australia.
- Attach a Cloud Armor edge policy before Cloud CDN and a backend policy for cache misses. Allow Australian consumer traffic, but preserve narrowly authenticated exceptions for provider webhooks and operational callbacks that legitimately originate overseas.
- Enable Cloud CDN only for an explicit route allowlist. Use origin-controlled cache headers; never use `FORCE_CACHE_ALL` on mixed dynamic backends.
- Serve immutable web assets and public media from a Sydney + Melbourne configurable dual-region Cloud Storage bucket. Keep private media behind signed access and explicit cache policy.
- Route functionally equivalent Cloud Run deployments through one serverless NEG in Sydney and one in Melbourne. Use outlier detection and Cloud Run service health; block direct origin bypass with ingress controls. Separate asynchronous workers first; split web and API deployments only when gateway identity, capacity isolation, or measured scaling justifies the extra boundary.
- Put `/api/*` behind Cloud Endpoints with ESPv2 on Cloud Run. Derive the gateway configuration from the canonical OpenAPI 3 contract. Gateway authentication, quotas, size limits, and route allowlisting are coarse controls; server authorization and PostgreSQL RLS remain authoritative.
- Keep the application a stateless modular monolith until measured ownership or scaling pressure proves a service boundary. Do not create per-domain microservices or internal load balancers speculatively.
- Retain Prisma. Target AlloyDB for PostgreSQL: highly available primary cluster in Sydney, Melbourne cross-region secondary/read capacity, managed connection pooling only after compatibility tests.
- Keep Supabase Storage and Realtime as explicit transitional dependencies until replacement journeys are proven. Do not describe them as multi-region or failure-isolated without evidence.
- Commit critical asynchronous intent with a transactional outbox, then publish to Pub/Sub with persistence restricted to Sydney and Melbourne. Use Sydney Cloud Tasks only for bounded, reconstructable dispatch where a Sydney regional outage is acceptable; it is not the durable regional fallback for critical signup intent.
- Use user-managed Sydney and Melbourne Secret Manager replicas and Australian regional log buckets/sinks for customer-sensitive material. Default global metadata and control-plane behaviour must be reviewed rather than described as Australian-resident.
- Correlate edge, gateway, application, database, and worker telemetry with request, trace, user-safe operation, revision, region, and queue identifiers.

## Capacity rule

Never choose an instance maximum in isolation.

`required_instances = ceil(peak_rps * p95_seconds / tested_concurrency_per_instance)`

`allowed_instances <= floor((safe_db_connections - operator_reserve) / connections_per_instance)`

If required instances exceed allowed instances, improve cache hit ratio, shorten transactions, queue optional work, add read capacity, or increase a proven database budget before raising the Cloud Run cap.

## CDN contract

Cache by allowlist, not by hope:

- Long TTL: content-hashed JavaScript, CSS, fonts, logos, and public versioned media.
- Short explicit TTL: anonymous public HTML or JSON read models whose staleness window is accepted by the product owner.
- Never cache: authenticated responses, account/admin pages, billing, messages, private media, mutable writes, webhooks, or anything carrying `Set-Cookie`.
- Set `Cache-Control: private, no-store` for sensitive responses and include CDN cache behaviour in route tests.
- Monitor cache hit ratio, origin fill rate, cache-busting patterns, egress, and stale serving.

## Viral traffic response

Design for the spike to arrive without warning:

1. Edge policy drops known abuse and rate-limits hostile or faulty clients before cache lookup.
2. CDN serves allowlisted cache hits without touching Cloud Run.
3. The load balancer routes misses to the closest healthy Australian Cloud Run cell.
4. Warm floors cover the measured cold-start SLO; autoscaling expands only within pre-approved regional quota and database budget.
5. The API gateway enforces the operation allowlist, coarse identity, quotas, payload limits, and request correlation.
6. The application preserves login, signup acceptance, safety, billing/webhooks, and core race reads; it sheds recommendations, previews, analytics, and optional enrichment first.
7. Queues absorb slow side effects with idempotency, bounded retries, dead-letter handling, and queue-age alerts.
8. Outlier detection removes a failing region; the database runbook controls writer promotion and application reconnection.

## Verification output

For every architecture review or implementation, report:

- `current`: evidence observed in repository or staging;
- `selected`: approved target design;
- `later trigger`: complexity deliberately deferred until a measurable threshold;
- `blocked`: missing evidence that prevents production promotion;
- exact commands, artifacts, environment identity, timestamps, and observed results for completed gates.

Do not mark architecture deployed because the visual or plan exists.
