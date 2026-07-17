# Viral readiness gates

The spike may arrive tomorrow or months from now. Readiness therefore means standing controls and regularly refreshed evidence, not a one-time forecast.

## Capacity gates

- [ ] Baseline, ramp, spike, and soak profiles pass in isolated staging.
- [ ] Per-route p50/p95/p99, error rate, CPU, memory, instance count, cold starts, and cost are recorded.
- [ ] Tested concurrency per instance is lower than the point where latency or errors bend sharply.
- [ ] Sydney and Melbourne minimum instances satisfy the cold-start SLO.
- [ ] Regional Cloud Run quotas are approved above the selected maximum before launch.
- [ ] Maximum app instances fit the safe database connection budget with an operator/migration reserve.
- [ ] Expensive routes have independent quotas, caching, queues, or load shedding.

## Edge and CDN gates

- [ ] Direct Cloud Run origin access is denied; only load-balancer/internal traffic reaches it.
- [ ] Cloud Armor edge rules run before cache, and backend WAF/rate rules protect cache misses.
- [ ] AU consumer geo policy has tested webhook/provider exceptions.
- [ ] Cache allowlist, cache keys, TTLs, purges, negative caching, `Set-Cookie`, and authenticated bypass are tested.
- [ ] Cache-busting and origin-fill attacks have alerts and a runbook.

## API gates

- [ ] Exact OpenAPI candidate has zero unresolved release-blocking static findings.
- [ ] ESPv2 rejects undeclared routes and preserves request/trace correlation.
- [ ] Authn, object authz/BOLA, CORS, CSRF, input bounds, injection, idempotency, webhook replay, and `429` tests pass.
- [ ] Server authorization and RLS tests prove the gateway cannot grant application access by itself.

## Data and async gates

- [ ] AlloyDB compatibility rehearsal covers schema, extensions, RLS contexts, transactions, pooling, migrations, backups, restore, and promotion.
- [ ] Read/write routing and replica-lag semantics are explicit.
- [ ] Pub/Sub persists message contents only in Sydney/Melbourne with in-transit enforcement where required.
- [ ] Queues are bounded, idempotent, retry-limited, dead-lettered, and monitored for age and depth.
- [ ] Supabase Storage/Realtime failure is isolated or an accepted launch blocker.

## Observability and incident gates

- [ ] Edge, CDN, gateway, web, worker, queue, and database metrics share region/revision/operation dimensions.
- [ ] Logs redact secrets and sensitive payloads and carry request/trace IDs.
- [ ] SLOs and multi-window burn alerts cover availability and latency.
- [ ] Dashboards separate viral legitimate traffic from hostile traffic using cache hit, identity, WAF, quota, and origin-load signals.
- [ ] One-click revision comparison and documented rollback are tested.
- [ ] Sydney application failure, Sydney database failure, provider failure, cache poisoning, queue backlog, and credential compromise are table-topped.

## Load-shedding order

Preserve, in order:

1. safety and webhook integrity;
2. login/session validation and signup acceptance;
3. billing and entitlement correctness;
4. core race/result reads;
5. user writes and messaging;
6. optional recommendations, previews, enrichment, analytics, and bulk exports.

Optional work must fail fast or enqueue; it must not consume the capacity needed by higher-priority operations.
