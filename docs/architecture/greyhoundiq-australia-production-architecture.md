# GreyhoundIQ Australia production architecture

Status: **selected target; not deployed or production-verified**

Decision date: 2026-07-15; corrected architecture review: 2026-07-16
Scope: Australian users, Australian application compute, and Australian persistent application data. GreyhoundIQ has no production users or production customer dataset to migrate at this decision point.

Full mandate report and operational evidence ledger: [`greyhoundiq-production-architecture-report.html`](./greyhoundiq-production-architecture-report.html). It is the 30-section review authority; this Markdown file is the shorter selected-design summary.

## Decision

GreyhoundIQ will use Google Cloud's edge to absorb and filter internet traffic, while keeping application cells and persistent application data in Sydney and Melbourne. The production database starts empty: deploy the reviewed schema with forward-only Prisma migrations, prove it with synthetic staging fixtures, and rehydrate only approved racing-provider data through the governed ingestion paths.

```text
Australian users
  -> nearest active Google edge
  -> Cloud Armor edge policy
  -> Cloud CDN allowlisted cache
  -> global external Application Load Balancer
  -> Cloud Armor backend policy on cache miss
  -> closest available Sydney or Melbourne serverless NEG
  -> modular-monolith Cloud Run app through web/API routing; ESPv2 owns coarse `/api/*` policy
  -> dedicated Cloud Run WebSocket/realtime gateway in each region
  -> independently capped asynchronous worker Cloud Run services
  -> AlloyDB transactional outbox / AU-restricted Pub/Sub / per-region application Memorystore
  -> AU dual-region Cloud Storage

Voice/video signalling and media use a separate Australian LiveKit plane:
  -> independent Sydney and Melbourne LiveKit cells with a room-home assignment
  -> each cell has tested N+1 SFU capacity and private regional HA LiveKit Redis
  -> TLS signalling load balancer, direct UDP media, and ICE/TCP/TURN/TLS fallbacks
  -> regional loss ends active calls visibly; a new room can be created in the healthy cell
```

This is a staged hyperscale design, not a speculative microservice rewrite. The current Next.js application remains a stateless modular monolith until a measured service boundary requires independent deployment.

## Design Lab architecture evidence boundary

The Design Lab Architecture area derives its source-static evidence from [`design-lab-architecture-inventory.ts`](../../src/components/design-lab-architecture-inventory.ts). Its fail-closed test proves 32 infrastructure-surface mappings, all 12 required fields across 25 component records, and 16 workflow-specific plus 13 structural trust-flow requirements. The rendered surface links every mapping back to this plan, the full report and the test.

That completion is deliberately narrow: it proves the selected design is mapped and structurally reviewable. It does **not** prove provider deployment, runtime policy, origin isolation, IAM, capacity, load shedding, alert delivery, failover, restore, regional recovery or production validation. Those gates remain unverified until environment-bound runnable evidence passes.

## 2026-07-16 architecture correction record

This document is the sole production-target authority for the new Google Cloud account. The historical [`gcp-cloud-run-migration-plan.md`](../gcp-cloud-run-migration-plan.md), the current single-region Supabase deployment workflow, and the green-staging Terraform baseline are not deployment instructions for this target. They must not be applied or treated as live evidence.

The review retained the Australian dual-region direction and corrected these unsafe ambiguities:

- Public web, API/ESPv2, and realtime Cloud Run services use `internal-and-cloud-load-balancing` ingress with the default `run.app` URL disabled. Internal workers use `internal` ingress and authenticated Google service-to-service invocation; they retain a non-public platform endpoint only when Cloud Scheduler, Pub/Sub, Tasks, or synthetics require it. No public caller may use that endpoint.
- A serverless NEG cannot use a conventional backend health check. Regional removal relies on Cloud Run service health, startup/readiness probes, at least one warm instance in each region, and outlier detection; the residual error window is measured in a controlled fault test.
- A single cross-region LiveKit cluster would make its shared Redis a regional dependency. The target is therefore two independent regional cells with separate HA Redis, explicit room-home persistence, and an honest rejoin contract. It does not promise active-call migration or transparent media failover.
- AlloyDB, object storage, Pub/Sub, realtime, monitoring, WorkOS, Stripe, and LiveKit are launch gates, not secret substitutions. The selected account currently has no deployment evidence for any of them.
- Cloud Storage replication mode, capacity limits, RTO/RPO, alert destinations, and provider production registration remain unverified decisions. They cannot be inferred from a source document or enabled by a deployment workflow.

No Google Cloud resources were created during this review.

The currently linked account is to remain a non-billable Free Trial. The $300 credit can fund a time-bounded staging rehearsal, but it is not a sustainable monthly budget for the full dual-region AlloyDB, LiveKit, edge, storage and observability target. No billing-account upgrade, additional billing attachment, or automatic payment setup is authorised. Production continuity after the trial requires a separate cost decision and explicit approval; otherwise Google will stop the trial resources when the credit or trial period ends.

## 2026-07-16 pre-production source audit

The local source audit passed the production Terraform foundation contract, GCP architecture policy, private-datastore policy, provider-readiness unit contract and LiveKit topology-config unit contract. Those results prove only that the repository records the selected target and fails closed around prohibited source patterns. They do not prove a project, provider, service, network, identity, datastore, media cell or recovery path exists.

Verified source gaps remain:

- Production Terraform currently declares only required APIs, Workload Identity Federation, build/deploy/runtime service accounts and narrow foundation IAM. It contains no production AlloyDB, Cloud Run, VPC, Redis, LiveKit compute, storage, queue, observability, DNS or budget resources. Each paid or traffic-bearing layer still requires a separate source module, review and immutable plan.
- The repository still contains a runnable legacy single-region Cloud Run/Supabase workflow. It is superseded by this document, is not compatible with the selected target and must not be dispatched for production or treated as promotion evidence.
- AlloyDB has no deployable implementation module or environment evidence for private networking, sizing, backup/PITR, restore, connection capacity, Prisma/RLS/extension/pooler compatibility, asynchronous replication, fenced promotion, switchover, reconciliation or failback.
- The checked-in LiveKit deployment file is a minimal single-endpoint configuration. It does not implement independent Sydney and Melbourne cells, per-cell HA Redis, N+1 SFU capacity, room-home routing, regional load balancing, drain controls, monitoring or failure recovery.
- Regional LiveKit configuration exists in application source, but the durable call-room model does not persist a room-home region and token, webhook and teardown paths do not yet select a regional cell consistently. The dual-cell journey therefore remains blocked even before infrastructure provisioning.
- Regional ejection and Melbourne database promotion remain unimplemented and unexercised. RTO/RPO, N-1 capacity, replication lag, reconnect, reconciliation and compound-failure behaviour remain targets rather than claims.
- No approved cost ceiling, current SKU estimate, hourly/monthly always-on forecast, budget-alert plan, anomaly policy or free-credit teardown envelope exists for the selected topology. Foundation IAM also does not yet define the separately scoped runtime, migration, queue, Redis, LiveKit, backup/restore and emergency-recovery identities required by later modules.
- Pub/Sub regional topology, Cloud Storage default-versus-Turbo replication, Secret Manager regional semantics and the Australian residency of any future LiveKit hosting remain explicit decisions requiring evidence and approval.

### Approval boundary

This audit authorises documentation and local source checks only. It does **not** authorise project creation or selection, provider probes, billing attachment or upgrade, automatic payment setup, API enablement, quota requests, Terraform plan/apply/import/state changes, resource creation, DNS or traffic changes, credential or secret access, production data access, live provider registration, load testing, staging deployment or production promotion.

Every future infrastructure step requires a separately reviewed action packet naming the exact project and environment, resources and regions, immutable source revision and plan, identities and permissions, expected hourly/monthly and maximum rehearsal cost, free-credit impact, test duration, teardown/rollback procedure, evidence owner and approval expiry. Approval to write or review source is never approval to provision it. Approval to spend free-trial credit is never approval to activate paid billing. Billing activation, DNS cutover and production promotion remain three separate manual decisions.

## Why this is the selected design

- Australian edge locations reduce static-content latency around the country without placing origins overseas.
- Cloud CDN removes cacheable work before it reaches Cloud Run.
- Cloud Armor filters requests before cache and protects cache misses with WAF and rate controls.
- Sydney and Melbourne are both supported Cloud Run and AlloyDB regions.
- Multi-region serverless NEGs route to the closest available equivalent backend. Health-based regional failover also requires Cloud Run service health/readiness, at least one minimum instance in each region, regional synthetics, and a controlled failover test; outlier detection alone is an imperfect safety net.
- Cloud Endpoints with ESPv2 supplies a distributed API gateway without depending on the managed API Gateway custom-domain/load-balancer integration currently labelled Preview.
- AlloyDB preserves PostgreSQL and Prisma semantics while providing managed high availability, read pools, and cross-region replication.
- Queues turn a sudden signup surge into bounded asynchronous work rather than synchronous third-party pressure.
- Application realtime remains recoverable from AlloyDB truth through a transactional outbox, AU-restricted Pub/Sub, regional WebSocket gateways, per-region disposable application Redis and cursor replay.
- Existing one-to-one voice/video is isolated into independent Sydney and Melbourne LiveKit cells on dedicated Australian compute. Each cell has its own private regional HA Redis, tested N+1 SFU capacity and explicit signalling/TURN/media paths; LiveKit is never placed on Cloud Run or used as the durable business-message store.

## National edge and CDN

Google currently lists network edge locations in Brisbane, Canberra, Melbourne, Perth, and Sydney. Cloud CDN sends a user to the nearest active Google Front End; the exact active point can change.

### Edge sequence

1. Premium-tier anycast IP terminates TLS at Google's edge.
2. Cloud Armor edge policy runs before Cloud CDN.
3. The CDN serves an allowlisted cache hit without contacting an origin.
4. A cache miss passes through the backend Cloud Armor policy.
5. The load balancer selects the closest available Australian serverless NEG. A region is treated as safe for traffic only after Cloud Run service health/readiness, at least one minimum instance in that region, regional synthetics, and controlled failover evidence pass.
6. Public Cloud Run services accept internet traffic only from the load balancer through `internal-and-cloud-load-balancing` ingress and a disabled default URL. Internal services use `internal` ingress plus IAM-authenticated Google callers; they are never exposed through a public `run.app` URL.

### Cache allowlist

| Traffic | Cache rule | Origin |
|---|---|---|
| content-hashed JS/CSS/fonts | public, one-year immutable TTL | Sydney + Melbourne AU dual-region Cloud Storage |
| versioned public images/media | long explicit TTL | AU dual-region Cloud Storage |
| anonymous marketing/help HTML | short explicit TTL with revalidation | web Cloud Run |
| anonymous public race read models | short TTL only after correctness and cache-key tests | API gateway/app |
| authenticated/account/admin/billing/messages | `private, no-store` | API gateway/app |
| mutations and webhooks | never cached | API gateway/app |
| private media | signed, short-lived access; explicit policy | private AU dual-region Cloud Storage |

Use `USE_ORIGIN_HEADERS` or `CACHE_ALL_STATIC`; never use `FORCE_CACHE_ALL` on a mixed dynamic backend. Responses with `Set-Cookie`, `Authorization`, private data, or user-specific content must bypass the CDN.

The consumer edge policy allows Australia. Exact webhook routes receive narrow exceptions because WorkOS, payment, media, or other authorised providers may legitimately call from outside Australia. Every exception still requires signature, timestamp, and replay validation.

## URL map and API gateway

| Path | Backend | Notes |
|---|---|---|
| `/_next/static/*`, `/fonts/*`, versioned public assets | Cloud Storage backend bucket + Cloud CDN | immutable cache key |
| public pages and image optimisation | web Cloud Run serverless NEGs | origin-controlled caching |
| `/api/*` | ESPv2 API Cloud Run serverless NEGs | contract allowlist, quotas, coarse identity |
| exact provider webhook paths | ESPv2 API Cloud Run | CDN bypass and provider exception |
| internal operations | private Cloud Run ingress | service identity only |

The API gateway is Cloud Endpoints with ESPv2 in Sydney and Melbourne. ESPv2 is deployed with the API cell so the public container port is the gateway; the application container is not a separately internet-reachable origin. Its configuration is generated from the canonical OpenAPI 3 contract and the two-region deployments use the same immutable image and gateway configuration digest.

Gateway responsibilities:

- reject operations absent from the deployed OpenAPI contract;
- authenticate supported token or API-key clients;
- enforce operation/caller quotas and payload/header/timeout budgets;
- preserve request and trace correlation;
- emit per-operation latency, error, and quota telemetry.

Gateway non-responsibilities:

- object-level authorization;
- application RBAC/ABAC decisions;
- PostgreSQL RLS;
- complete request-schema enforcement;
- business idempotency and webhook replay protection.

Those remain in the Next.js service and database. A gateway can deny access; it must never be able to grant access the application would reject.

## Compute cells

Deploy the same immutable image digest to:

- `australia-southeast1` Sydney;
- `australia-southeast2` Melbourne.

Each region initially contains a stateless modular-monolith application, an ESPv2 gateway boundary for `/api/*`, a dedicated Cloud Run WebSocket/realtime gateway, and independently capped worker Cloud Run services. Public web/API/realtime services use the load-balancer ingress profile; workers use `internal` ingress, a dedicated service identity, and OIDC-authenticated Scheduler, Pub/Sub, Task, or service callers. A separate web/API application deployment is deferred until measured scaling, security-isolation or ownership evidence earns that additional failure boundary. Jobs carry idempotency keys and persist state outside the instance. Realtime clients reconnect with jitter and a cursor, then recover missed durable events from the application API.

Cloud Run startup and readiness probes establish container health but do not configure a serverless-NEG health check. The global external load balancer must use Cloud Run service health and outlier detection for functionally equivalent regional NEGs. The deployment test must prove public `run.app` denial, an internal caller's IAM denial without its service identity, and traffic movement after a deliberate 5xx/readiness fault.

The initial launch floor is **proposed** at three warm web/API instances per region, then adjusted by cold-start and cost evidence. Each region must always have at least one minimum instance for health-based failover. Neither value is a passing production configuration until staging proves readiness, failover, latency and cost.

## Autoscaling control system

There is no safe universal max-instance value. The maximum is the lower of demand capacity, approved regional quota, downstream quotas, and database capacity.

```text
required_instances = ceil(peak_rps * p95_seconds / tested_concurrency_per_instance)

allowed_instances = floor(
  (safe_db_connections - operator_and_migration_reserve)
  / connections_per_instance
)

regional_max <= min(required_headroom, approved_quota, allowed_instances / 2)
```

The current source declares concurrency 20, minimum 3, maximum 10, 2 CPU, and 4 GiB for the main service. That is declared source, not current live evidence, and it is not accepted as viral-load capacity.

### Standing autoscale controls

- Pre-approve Sydney and Melbourne CPU/instance quotas before launch.
- Measure safe per-instance concurrency; do not copy Cloud Run defaults.
- Set minimum instances in both regions to meet the cold-start SLO.
- Cap combined web/API instances below the safe database connection budget.
- Give workers separate maximums and queue dispatch rates so background work cannot starve requests.
- Add per-operation gateway quotas for expensive search, export, agent, media, and AI routes.
- Keep signup acceptance synchronous and enqueue email, enrichment, analytics, and provider side effects.
- Return explicit `429` or `503` with retry guidance instead of allowing unbounded waits.

### Pressure ladder

| State | Signal | Automatic response |
|---|---|---|
| normal | SLO healthy; DB connections below 70% | warm floor + ordinary autoscale |
| rising | concurrency/p95 rising; cache hit healthy | Cloud Run adds instances inside cap |
| origin surge | cache misses or signups spike | coalesce/cache safe reads; enqueue side effects |
| constrained | DB connections at 70-80% or queue age rising | stop optional synchronous work; reduce worker dispatch |
| protect core | DB at 80-90%, provider failure, or error-budget burn | shed previews/recommendations/exports; preserve auth, safety, billing, core race reads |
| fail closed | DB above 90% or integrity uncertain | reject low-priority writes, pause jobs, incident control |
| attack | WAF/429/cache-bust anomalies without healthy conversion | edge rate/block/challenge policy; preserve origin capacity |

Thresholds are starting guardrails. Staging spike and soak evidence must calibrate them before production approval.

### Sudden viral signup path

```text
POST signup
  -> edge + gateway quota
  -> validate identity and idempotency
  -> minimal durable user/profile transaction
  -> publish SignupAccepted event
  -> 202/redirect success

SignupAccepted
  -> notification worker
  -> onboarding/enrichment worker
  -> analytics worker
  -> retry with backoff
  -> dead-letter after bounded attempts
```

Each consumer is idempotent. Queue age and dead-letter count are release-blocking telemetry.

## Database and state

### Core OLTP

- AlloyDB for PostgreSQL highly available primary cluster in Sydney.
- Melbourne cross-region secondary and read capacity.
- Prisma retained.
- Melbourne can serve explicitly replica-safe reads; writes remain on the current writer.
- Emergency Melbourne promotion is a controlled runbook action with writer fencing, recovery-point capture, secret/revision update, RLS smoke checks, traffic restoration and post-event reconciliation.

There is no production user/customer dataset to copy or catch up. Bootstrap an empty AlloyDB database with reviewed forward-only Prisma migrations. Protected staging uses synthetic identities and fixtures. Approved racing-provider history is rehydrated through the normal validated, deduplicated and lineage-tracked feed adapters.

The database bootstrap cannot proceed until a rehearsal proves every extension, function, trigger, materialized view, RLS policy, transaction-local `set_config`, Prisma interactive transaction, forward-only migration, prepared statement, and pool behaviour.

AlloyDB managed transaction pooling has session-feature limitations. GreyhoundIQ's transaction-local request context may work, but it must be verified against the exact configuration.

AlloyDB cross-region replication is asynchronous. Emergency promotion after an abrupt regional loss has non-zero RPO and must fence the former writer before traffic restoration, disclose the observed recovery point, and reconcile missing or duplicate work. A planned switchover can be zero-loss only while both regions are healthy and replication is current; it still requires a rehearsed switchover and failback procedure.

### Object storage

Use a configurable `AU` dual-region Cloud Storage bucket placed in Sydney and Melbourne, with uniform bucket-level access, signed private access, versioning/soft delete where appropriate, lifecycle policy, and tested restore. Replication is asynchronous: the default replication target is 99.9% of newly written objects within one hour and 100% within 12 hours; Turbo Replication targets 100% within 15 minutes. The storage RPO/cost decision requires explicit approval before the bucket is created; default replication cannot be silently treated as a 15-minute recovery point.

Replacing every required legacy storage journey with this controlled Cloud Storage path is an MVP launch blocker. Upload, scan, publish, signed download, deletion, retention, restore and tenant-isolation tests must pass before the affected journey is enabled.

### Messaging

- A Pub/Sub message-storage policy allowlists Sydney and Melbourne persistence locations; it does **not** replicate each message to both regions.
- Use regional Pub/Sub endpoints for regional processing. A topology ADR must choose shared or per-region topics/subscriptions and define publish failover, duplicate handling, backlog recovery and regional-loss behaviour before critical events rely on it.
- Critical outbox events use AU-restricted Pub/Sub. Cloud Tasks is currently available in Sydney and is limited to reconstructable bounded jobs; it is not the sole durable regional-recovery path.
- Every queue has bounded retries, a dead-letter path, idempotent handlers, dispatch caps, and age/depth alerts.

### Cache and secret state

Memorystore Standard Tier is regional and cross-zone only. Deploy a separate regional application Redis service in Sydney and Melbourne for ephemeral realtime fan-out and coordination; Redis is never the source of truth and clients recover through cursor replay from the application API. Any additional application caching must have explicit keys, TTLs, failure budgets and measured benefit. Each independent LiveKit cell uses its own private regional HA Redis deployment and identity boundary. A total cache or application-Redis loss must activate admission controls before it can overload AlloyDB.

Secret Manager user-managed Sydney and Melbourne replicas synchronously replicate secret versions, but Secret Manager remains a global service and write availability has different failure semantics from regional application compute. An ADR must approve read, write, rotation, break-glass and regional-outage behaviour; labels such as “dual replica” do not prove regional independence.

### MVP storage and realtime replacement boundary

Legacy storage and application-realtime journeys are not accepted transitional production dependencies. The Cloud Storage replacement and an application-owned realtime replacement must be implemented and tested before MVP launch. Their outage must not corrupt core race data, authentication, billing or audit correctness.

LiveKit remains self-hosted on dedicated Australian compute and is never a Cloud Run workload. The launch topology is two independent regional cells, one in Sydney and one in Melbourne. Each cell has a private regional HA LiveKit Redis isolated from application Redis, tested N+1 SFU capacity, TLS load balancing for API/WebSocket signalling, correct L4 ICE/TCP and TURN/TLS handling, and direct public UDP media through only the required firewall ports. The application persists a room-home region and issues that cell's endpoint to every participant; it creates a new room in the surviving cell after a regional loss. It never relies on a single cross-region Redis or promises migration of an active media session. Native draining precedes removal or upgrade. Voice, 720p video, screen sharing, forced TURN, node loss, Redis loss, reconnect storms and regional recovery require synthetic capacity and failure evidence before the call journey is enabled.

### WorkOS and Stripe production boundary

WorkOS authentication and Stripe payment infrastructure remain external providers. The production deployment must use final HTTPS callback/logout and webhook URLs, host-only cookie policy, narrowly allowlisted provider ingress, numeric Secret Manager versions, signature/timestamp/replay validation, and independent provider-flow tests. WorkOS client/API/cookie material, Stripe API/webhook material, and approved price IDs are never copied to source, build arguments, scheduler headers, logs, or another environment. Test-mode checkout and webhook replay are required before release; any live charge, credential rotation, or DNS cutover needs explicit approval.

Native iOS/iPadOS and Android store applications remain separate codebases over the versioned backend contract, but are explicitly post-MVP and do not block the web production launch. Their signing, store, device and rollout gates become blocking only when each native release is scheduled.

Spanner is not selected for launch. Reconsider it only for a measured domain that needs Australian multi-region writes strongly enough to justify a data-model and Prisma redesign.

## DDoS and abuse defence

- Google's edge and load balancer absorb network-layer attacks.
- Cloud Armor edge policy filters before cache and can geo-restrict consumer traffic.
- Backend policy applies managed WAF rules and per-path rate limits to cache misses.
- API gateway quotas isolate callers and expensive operations.
- Application rate limits combine identity, IP/network, operation, and global budgets.
- Cache-busting detection watches high-cardinality URLs, low hit ratio, and origin-fill growth.
- Origin ingress prevents bypass of Cloud Armor and CDN.
- Abuse controls deploy in preview, are tuned against logs, and then enforce with rollback.

Do not call a load test a DDoS test. Strix and dynamic security tests remain authorised localhost/staging-only and must not perform denial-of-service activity.

## Observability and debugging desk

One request must be traceable through edge, gateway, Cloud Run, Prisma, database, event, and worker using:

- `requestId` and Cloud Trace ID;
- region, revision, service, operation ID, and safe actor class;
- cache status and edge policy outcome;
- gateway quota/auth outcome;
- normalized database operation and duration without values;
- event ID, idempotency key, queue age, attempt, and dead-letter state.

Required views:

1. RED dashboard per route/region/revision: rate, errors, duration.
2. USE dashboard per resource: utilisation, saturation, errors.
3. Edge/CDN: hit ratio, fill bytes, WAF actions, rate limits, cache-bust cardinality.
4. Database: connections, waits, transaction duration, locks, replication lag, slow operations.
5. Queues: publish rate, dispatch rate, age, retries, dead letters.
6. Release comparison: current vs previous revision, error-budget burn, rollback state.
7. Viral vs attack: signups/conversion/auth mix versus WAF/429/IP/ASN/cache-bust anomalies.

Runbook actions are gated and audited: rollback revision, pause worker dispatch, activate load shedding, eject a region, purge a cache key/prefix, and promote the database writer.

## Failure design

| Failure | Expected behaviour | Evidence required |
|---|---|---|
| Sydney Cloud Run errors | ALB prefers the closest available region; Cloud Run service health/readiness plus the warm floor must withdraw unsafe capacity, while imperfect outlier detection limits some failures | controlled regional fault test proving traffic movement and residual errors |
| Melbourne Cloud Run errors | Sydney carries the service | controlled regional fault test |
| Sydney AlloyDB writer fails | writes pause/fail safely; operator captures lag, fences the former writer, promotes Melbourne and reconciles to the observed non-zero RPO | timed promotion, reconnect and reconciliation drill |
| AU dual-region Storage regional loss | available copy serves only within observed asynchronous replication point | default-vs-Turbo ADR plus object recovery drill |
| regional Pub/Sub path fails | bounded backlog/failover follows the selected topology; persistence allowlist is not treated as duplicated per-message storage | regional endpoint/topology drill |
| Memorystore regional loss | cache is discarded; admission tightens before AlloyDB reserve is consumed | full-cache-loss test |
| application realtime gateway or Redis loss | clients reconnect with jitter and cursor; missed durable events recover from the API; presence may degrade but business records remain correct | gateway termination, regional Redis loss and cursor-replay drill |
| LiveKit node, Redis or TURN loss | affected calls reconnect or end visibly; core records and messaging remain correct; drained/spare capacity absorbs one node where proven | voice/video/screen-share/forced-TURN load plus node-drain, node-loss and Redis-failover drill |
| CDN/cache poisoning concern | purge affected version/key; bypass cache; retain origin protection | cache incident drill |
| cache-busting attack | edge/backend policy limits misses; optional work sheds | authorised staging simulation |
| signup spike | minimal transaction succeeds; side effects queue | spike + soak test |
| provider outage | circuit opens; retries queue; core app remains usable | failure injection |
| queue backlog | dispatch caps protect DB; age alert; controlled drain | backlog recovery test |
| bad revision | canary stops; immutable prior digest restores | rollback drill |
| complete realtime/media outage | presence, messaging updates and calls degrade or disable explicitly; critical state remains correct and cursor recovery reconciles durable events | dependency isolation, reconnect-storm and recovery reconciliation test |

RTO and RPO remain `unverified` until the timed drills establish them.

## Delivery plan and gates

### Phase 0 — contract and capacity

- Bind the zero-error OpenAPI static candidate (14 July: SHA-256 `26a56856a97ebfb7387cdf3f56ca5fd502eb639760a8f948ca59878359f936d2`, 163 warnings, source-derived 62-operation rate-limit parity, the bounded encrypted replay-capability exception and the exact same-origin replay-503 exception) to an immutable revision, then complete authorised negative authorisation, input, replay, response-header and edge-limit tests; the deployed API gate remains blocked.
- Inventory route cacheability and priority.
- Establish SLOs, traffic model, database connection budget, and provider quotas.
- Capture a staging baseline.

Exit: exact contract passes, capacity assumptions are measured, and all production changes remain locked.

### Phase 1 — edge and origin lock

- Create the external Application Load Balancer, AU consumer edge policy, backend WAF, CDN, and URL map in staging.
- Move immutable assets/public media to AU dual-region Storage.
- Complete and prove the Cloud Storage replacement for every MVP storage journey; approve default versus Turbo replication by ADR.
- Set public Cloud Run ingress to `internal-and-cloud-load-balancing`, disable its default URL, configure service health/outlier detection, and prove direct-origin bypass fails. Keep internal worker endpoints IAM-only rather than reusing the public profile.

Exit: edge/cache/security tests pass and rollback to the previous staging entry point is rehearsed.

### Phase 2 — API gateway

- Generate the ESPv2 service configuration from the remediated canonical OpenAPI contract.
- Deploy API gateway/API cells in Sydney and Melbourne.
- Test route denial, auth, quotas, correlation, payload limits, and all application negative authorization paths.

Exit: gateway cannot bypass application authorization and every API route has an explicit policy.

### Phase 3 — database and asynchronous work

- Bootstrap empty AlloyDB with forward-only Prisma migrations; load synthetic staging fixtures and rehydrate approved provider data through governed feeds.
- Prove pooling, RLS contexts, backups, restore, asynchronous replication, fenced emergency promotion, healthy planned switchover, reconciliation and Prisma migrations.
- Complete and prove the application-realtime replacement required by MVP: AlloyDB outbox, AU-restricted Pub/Sub, regional Cloud Run WebSocket gateways, separate per-region application Memorystore and cursor replay.
- Provision and prove the dedicated Australian LiveKit plane: independent Sydney/Melbourne cells, room-home assignment, regional HA Redis per cell, tested N+1 capacity, TLS signalling, direct UDP, ICE/TCP, TURN/TLS, draining, metrics and failure recovery.
- Queue slow signup and optional side effects; test retry/dead-letter/idempotency.

Exit: restore and failover drills pass with measured RTO/RPO, and app capacity fits the database budget.

### Phase 4 — dual-region and viral readiness

- Deploy equivalent immutable revisions to both Australian regions.
- Configure Cloud Run service health/readiness, at least one minimum instance per region, outlier detection, regional quotas, caps, and worker dispatch limits.
- Approve and test Pub/Sub regional endpoints/topology, application-realtime gateways, separate regional application Memorystore failure semantics, dedicated LiveKit/Redis/TURN capacity and recovery, Secret Manager replication/write semantics and Cloud Storage replication mode.
- Run baseline, ramp, spike, soak, cache-bust, provider-failure, queue-backlog, and regional-failure tests.

Exit: SLOs, error budget, cost, database saturation, autoscale lag, queue age, and recovery targets pass.

### Phase 5 — controlled production promotion

- Bind evidence to the exact commit and immutable image digest.
- Independent review verifies every release gate.
- Protected environment approval promotes the tested digest.
- Observe canary and revision comparison before full traffic.

Exit: production gate passes from runnable evidence. A diagram, plan, or browser selection never unlocks it.

## Deliberately not selected

- Microservices and per-domain internal load balancers: add only when a domain needs independent ownership, isolation, or scaling.
- GKE and service mesh: add only when Cloud Run constraints are measured blockers.
- Managed API Gateway behind the application load balancer: re-evaluate after the custom-domain integration is generally available and its limits fit the product.
- Apigee: add when external partner products, developer portals, or API monetisation justify the cost and operating model.
- Spanner: add only for a measured multi-writer domain.
- Native iOS/iPadOS and Android store delivery: post-MVP; maintain backend compatibility now, but do not make native signing/store evidence a web-launch blocker.

## Primary sources

- [Cloud CDN overview](https://docs.cloud.google.com/cdn/docs/overview)
- [Cloud CDN caching](https://docs.cloud.google.com/cdn/docs/caching)
- [Google network edge locations](https://docs.cloud.google.com/vpc/docs/edge-locations)
- [Cloud Armor security policy order](https://docs.cloud.google.com/armor/docs/security-policy-overview)
- [Serverless NEG routing and outlier detection](https://docs.cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts)
- [Cloud Run regions](https://docs.cloud.google.com/run/docs/locations)
- [Cloud Endpoints OpenAPI support](https://docs.cloud.google.com/endpoints/docs/openapi)
- [API Gateway deployment model and Preview custom-domain integration](https://docs.cloud.google.com/api-gateway/docs/deployment-model)
- [AlloyDB regions](https://docs.cloud.google.com/alloydb/docs/locations)
- [Cloud Storage AU configurable dual-region](https://docs.cloud.google.com/storage/docs/locations)
- [Cloud Storage availability, durability and replication](https://docs.cloud.google.com/storage/docs/availability-durability)
- [Pub/Sub message storage policy](https://docs.cloud.google.com/pubsub/docs/resource-location-restriction)
- [Pub/Sub regional endpoints](https://docs.cloud.google.com/pubsub/docs/reference/service_apis_overview#regional_endpoints)
- [Cloud Tasks regions](https://docs.cloud.google.com/tasks/docs/locations)
- [Memorystore for Redis service tiers](https://docs.cloud.google.com/memorystore/docs/redis/redis-tiers)
- [Secret Manager replication](https://docs.cloud.google.com/secret-manager/docs/choosing-replication)
- [LiveKit distributed multi-region setup](https://docs.livekit.io/home/self-hosting/distributed/)
