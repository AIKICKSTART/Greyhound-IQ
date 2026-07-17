# Australia-only target

## Request path

```text
Australian user
  -> nearest active Google edge
  -> Cloud Armor edge policy
  -> Cloud CDN allowlisted cache
  -> global external Application Load Balancer URL map
  -> Cloud Armor backend policy on cache miss
  -> Sydney or Melbourne serverless NEG
  -> ESPv2 API gateway for /api/*
  -> Cloud Run modular monolith
  -> AlloyDB / queues / object storage / transitional providers
```

Google documents network edge locations in Brisbane, Canberra, Melbourne, Perth, and Sydney. Exact active points can change, so describe the behaviour as nearest active edge, not a guaranteed city pin.

## Route policy

| Route class | Target | CDN | Security |
|---|---|---:|---|
| `/_next/static/*`, fonts, versioned public assets | AU dual-region Cloud Storage | long TTL | edge policy, immutable names |
| public images and public marketing pages | Cloud Storage or web Cloud Run | explicit TTL | origin headers, purge/version plan |
| anonymous public race/read models | API gateway and app | short TTL only after correctness review | cache-key and stale-window tests |
| authenticated/API mutations | API gateway and app | bypass | identity, authorization, RLS, rate limit |
| private media | signed access | explicit private policy | object authorization, short expiry |
| provider webhooks | exact gateway routes | bypass | signature, replay guard, provider exception |
| admin/internal operations | private/internal route | bypass | workforce identity, least privilege |

## Region roles

### Sydney (`australia-southeast1`)

- active Cloud Run web/API/worker cell;
- AlloyDB highly available primary;
- Cloud Tasks queues;
- Pub/Sub allowed persistence region;
- one half of AU configurable dual-region object storage.

### Melbourne (`australia-southeast2`)

- equivalent active/warm Cloud Run web/API/worker cell;
- AlloyDB cross-region secondary and read capacity;
- Pub/Sub allowed persistence region;
- one half of AU configurable dual-region object storage.

## API gateway decision

Use Cloud Endpoints with ESPv2 on Cloud Run for the production path. It is distributed with the application cells and can sit behind the established load-balancer domain without depending on managed API Gateway custom-domain integration, which must be rechecked because Google currently labels that integration Preview.

Keep gateway policy intentionally coarse:

- deny routes absent from the deployed OpenAPI contract;
- authenticate supported token/API-key clients;
- apply caller and operation quotas;
- cap payload/header/timeout budgets;
- emit gateway metrics and preserve correlation headers.

Do not rely on gateway schema validation, OAuth scopes, or object authorization without testing the exact supported feature. The application validates input and authorizes every object/action.

## Database decision

Retain Prisma and PostgreSQL semantics. Move the core OLTP path only after an AlloyDB rehearsal proves:

- all extensions, functions, triggers, materialized views, and RLS policies;
- `set_config(..., true)` request contexts;
- Prisma interactive transactions and migration workflow;
- managed pooling compatibility and prepared statement behaviour;
- restore, point-in-time recovery, Sydney failure, Melbourne promotion, and reconnect;
- read-routing consistency and replica-lag behaviour.

Do not choose Spanner for launch. Add it only if a measured domain requires multi-region write availability that justifies redesigning its relational and Prisma contracts.

## Deliberately deferred

- per-domain microservices and internal load balancers;
- GKE/service mesh;
- Apigee monetization layer;
- Spanner or multi-writer data models;
- a third Australian compute region that Google does not currently offer for Cloud Run.

Revisit a deferred item only when load, ownership, isolation, compliance, or product evidence supplies a concrete trigger.

## Primary current sources

- https://docs.cloud.google.com/cdn/docs/overview
- https://docs.cloud.google.com/cdn/docs/caching
- https://docs.cloud.google.com/vpc/docs/edge-locations
- https://docs.cloud.google.com/armor/docs/security-policy-overview
- https://docs.cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts
- https://docs.cloud.google.com/run/docs/locations
- https://docs.cloud.google.com/endpoints/docs/openapi
- https://docs.cloud.google.com/alloydb/docs/locations
- https://docs.cloud.google.com/storage/docs/locations
- https://docs.cloud.google.com/pubsub/docs/resource-location-restriction
- https://docs.cloud.google.com/tasks/docs/locations
