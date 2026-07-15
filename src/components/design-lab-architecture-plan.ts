export type ArchitectureTaskStatus =
  "verified" | "in-progress" | "planned" | "blocked";

export type ArchitectureTask = {
  id: string;
  title: string;
  status: ArchitectureTaskStatus;
  acceptance: string;
};

export type ArchitecturePhase = {
  id: string;
  title: string;
  outcome: string;
  tasks: readonly ArchitectureTask[];
};

export const GREYHOUNDIQ_ARCHITECTURE_PHASES: readonly ArchitecturePhase[] = [
  {
    id: "ARCH.P0",
    title: "Decision, SLO and capacity contract",
    outcome:
      "One approved Australia-only target with measurable reliability, capacity, residency and cost boundaries.",
    tasks: [
      {
        id: "ARCH-001",
        title: "Select the Australia-only production topology",
        status: "verified",
        acceptance:
          "Sydney and Melbourne origins, Australian persistent data, global defensive edge and deliberate exclusions are documented.",
      },
      {
        id: "ARCH-002",
        title: "Validate the GreyhoundIQ architecture skill",
        status: "verified",
        acceptance:
          "greyhoundiq-production-architecture passes the Skill Creator validator.",
      },
      {
        id: "ARCH-003",
        title: "Publish Design Lab diagrams and task authority",
        status: "verified",
        acceptance:
          "Architecture area renders every selected layer, open task and fail-closed production gate at desktop and mobile widths.",
      },
      {
        id: "ARCH-004",
        title: "Approve availability, latency, RTO and RPO objectives",
        status: "blocked",
        acceptance:
          "Named owners approve route-class SLOs and timed recovery targets; no target is inferred from a vendor SLA.",
      },
      {
        id: "ARCH-005",
        title: "Measure normal, launch and viral traffic models",
        status: "blocked",
        acceptance:
          "RPS, burst duration, concurrency, payload, read/write ratio and expensive routes are measured or explicitly bounded test hypotheses.",
      },
      {
        id: "ARCH-006",
        title: "Classify data and Australian residency boundaries",
        status: "planned",
        acceptance:
          "Customer, payment, identity, media, telemetry and queue data have approved storage and processing locations.",
      },
      {
        id: "ARCH-007",
        title: "Inventory provider origins, quotas and failure modes",
        status: "planned",
        acceptance:
          "WorkOS, Stripe, Cloud Storage, application realtime, LiveKit and racing providers have source, residency, quota, timeout and retry contracts; deferred product email and SMS paths fail visibly and safely.",
      },
      {
        id: "ARCH-008",
        title: "Approve cost envelope and budget alerts",
        status: "planned",
        acceptance:
          "Normal, surge and attack cost ceilings have owners, forecasts, alerts and emergency controls.",
      },
    ],
  },
  {
    id: "ARCH.P1",
    title: "Australian edge, CDN and origin shield",
    outcome:
      "Australian users reach the nearest active edge while direct origin bypass, unsafe caching and hostile traffic fail closed.",
    tasks: [
      {
        id: "ARCH-101",
        title: "Create the staging global external Application Load Balancer",
        status: "in-progress",
        acceptance:
          "Premium-tier anycast IP, managed TLS, URL map and Sydney/Melbourne serverless NEGs are reproducible from reviewed configuration after existing load-balancer, service, DNS and state ownership is imported or deliberately migrated without parallel orphan resources.",
      },
      {
        id: "ARCH-102",
        title: "Configure Australian DNS and certificate cutover",
        status: "in-progress",
        acceptance:
          "Low-TTL cutover, certificate health, rollback and DNS ownership are rehearsed in staging.",
      },
      {
        id: "ARCH-103",
        title: "Deploy Cloud Armor edge policy in preview",
        status: "in-progress",
        acceptance:
          "AU consumer rules run before cache and exact overseas provider webhook exceptions are logged and tested.",
      },
      {
        id: "ARCH-104",
        title: "Tune backend WAF and rate controls",
        status: "in-progress",
        acceptance:
          "Managed OWASP rules, per-path limits and false-positive review pass before enforcement.",
      },
      {
        id: "ARCH-105",
        title: "Replace Supabase Storage with Australian Cloud Storage",
        status: "in-progress",
        acceptance:
          "Provider-neutral application storage, AU dual-region private buckets, workload identity, signed access, quarantine/scanning, cross-user denial, deletion and restore pass; the replication ADR selects default or Turbo using an explicit non-zero RPO, and Supabase Storage is absent from the final candidate.",
      },
      {
        id: "ARCH-106",
        title: "Publish the CDN route and cache-key allowlist",
        status: "planned",
        acceptance:
          "Only immutable assets, approved public media and reviewed anonymous reads can cache; auth and Set-Cookie responses bypass.",
      },
      {
        id: "ARCH-107",
        title: "Block direct Cloud Run origin access",
        status: "in-progress",
        acceptance:
          "Ingress permits only internal and load-balancer traffic, an external run.app bypass test fails, and canary, scheduler and uptime paths use reviewed protected routes instead of relying on the disabled default URL.",
      },
      {
        id: "ARCH-108",
        title: "Prove cache purge, stale and cache-bust controls",
        status: "planned",
        acceptance:
          "Version/purge rollback, negative caching, stale policy, hit ratio and high-cardinality attack alerts pass.",
      },
    ],
  },
  {
    id: "ARCH.P2",
    title: "API gateway and application trust boundary",
    outcome:
      "Every public API operation crosses a contract-derived gateway while application authorization and RLS remain authoritative.",
    tasks: [
      {
        id: "ARCH-201",
        title: "Remediate the canonical OpenAPI static audit",
        status: "blocked",
        acceptance:
          "The exact OpenAPI candidate has zero unresolved release-blocking errors and is bound to its source digest.",
      },
      {
        id: "ARCH-202",
        title: "Generate the ESPv2 deployment overlay",
        status: "planned",
        acceptance:
          "Google extensions are generated from, not forked from, the canonical OpenAPI 3 contract.",
      },
      {
        id: "ARCH-203",
        title: "Deploy ESPv2 gateway cells in Sydney and Melbourne",
        status: "planned",
        acceptance:
          "Equivalent immutable gateway revisions proxy only declared routes to authenticated API backends.",
      },
      {
        id: "ARCH-204",
        title: "Enforce service IAM and secret topology",
        status: "planned",
        acceptance:
          "Only gateway service accounts invoke API backends; least-privilege and token-audience tests pass, while the Secret Manager ADR records Australian payload replicas, global-service implications, replica-region write failure and tested rotation/fallback.",
      },
      {
        id: "ARCH-205",
        title: "Set operation quotas and payload budgets",
        status: "planned",
        acceptance:
          "Search, export, agent, media and write routes have tested caller/global quotas and explicit 429 behaviour.",
      },
      {
        id: "ARCH-206",
        title: "Propagate request and trace correlation",
        status: "in-progress",
        acceptance:
          "One safe correlation chain spans edge, gateway, application, database operation, event and worker.",
      },
      {
        id: "ARCH-207",
        title: "Prove negative authorization behind the gateway",
        status: "blocked",
        acceptance:
          "BOLA/IDOR, role, tenant, CSRF, CORS, replay and RLS tests prove gateway acceptance cannot grant data access.",
      },
      {
        id: "ARCH-208",
        title: "Rehearse gateway canary and rollback",
        status: "planned",
        acceptance:
          "A bad gateway config is detected, traffic-stopped and restored to the prior immutable config without data loss.",
      },
    ],
  },
  {
    id: "ARCH.P3",
    title: "Dual-region compute and bounded autoscaling",
    outcome:
      "Stateless Sydney/Melbourne cells scale quickly without scaling the database or providers into an outage and without implying active-active data resilience.",
    tasks: [
      {
        id: "ARCH-301",
        title: "Separate app, worker, realtime and LiveKit runtimes",
        status: "planned",
        acceptance:
          "One stateless modular-monolith serves web/API, workers and WebSocket gateways scale independently on Cloud Run, and LiveKit runs only on dedicated Australian VM or compatible Kubernetes compute with isolated Redis; no premature domain microservices or service mesh.",
      },
      {
        id: "ARCH-302",
        title: "Deploy one immutable digest to both regions",
        status: "planned",
        acceptance:
          "Sydney and Melbourne run functionally equivalent signed images and configuration contracts; neither origin receives production traffic until its database route, latency, transfer and connection budget are proven.",
      },
      {
        id: "ARCH-303",
        title: "Add startup, readiness and dependency probes",
        status: "planned",
        acceptance:
          "New instances receive traffic only after the app and required sidecars are ready.",
      },
      {
        id: "ARCH-304",
        title: "Measure application and LiveKit safe concurrency",
        status: "blocked",
        acceptance:
          "Ramp tests identify the latency/error knee for web, API, WebSocket and worker services, while separate voice, 720p video, screen-share and forced-TURN tests establish safe calls per LiveKit node; configured limits stay below measured knees.",
      },
      {
        id: "ARCH-305",
        title: "Set tested regional warm floors and media spare",
        status: "blocked",
        acceptance:
          "At least one ready application instance per region supports service health, tested warm floors meet regional-loss SLOs, and LiveKit retains one measured spare node of capacity within the approved cost envelope.",
      },
      {
        id: "ARCH-306",
        title: "Bind maximum instances to the database budget",
        status: "blocked",
        acceptance:
          "Combined regional caps satisfy max instances × per-instance pool below safe DB connections with operator reserve.",
      },
      {
        id: "ARCH-307",
        title: "Pre-approve regional quotas and alert thresholds",
        status: "planned",
        acceptance:
          "Cloud Run CPU/instance quotas exceed selected caps before launch and quota consumption alerts fire early.",
      },
      {
        id: "ARCH-308",
        title: "Enable service health and outlier detection",
        status: "planned",
        acceptance:
          "Cloud Run readiness probes and service health are configured with at least one minimum instance in each region; controlled unknown, rapid-crash, 5xx and unavailable-region cases prove health-based failover. Outlier detection remains defense in depth and is not accepted as perfect ejection.",
      },
      {
        id: "ARCH-309",
        title: "Tune timeouts, shutdown and retry budgets",
        status: "planned",
        acceptance:
          "End-to-end deadlines decrease downstream, retries are bounded/jittered and revisions drain cleanly.",
      },
      {
        id: "ARCH-310",
        title: "Implement priority load shedding",
        status: "planned",
        acceptance:
          "Recommendations, previews, enrichment and exports shed before auth, safety, billing, signups and core race reads.",
      },
    ],
  },
  {
    id: "ARCH.P4",
    title: "PostgreSQL, object data and regional recovery",
    outcome:
      "The data plane preserves GreyhoundIQ's RLS/Prisma contracts and can be restored or promoted within measured objectives.",
    tasks: [
      {
        id: "ARCH-401",
        title: "Freeze the PostgreSQL compatibility inventory",
        status: "verified",
        acceptance:
          "Repository models, migrations, extensions, functions, triggers, policies, views, indexes and roles are source-counted and digest-bound; loopback catalog parity remains explicitly blocked under ARCH-403 when migration or runtime-role evidence differs.",
      },
      {
        id: "ARCH-402",
        title: "Create an isolated Sydney AlloyDB rehearsal cluster",
        status: "planned",
        acceptance:
          "Infrastructure is private, HA, secret-managed, synthetic-data-only and reproducible without production access.",
      },
      {
        id: "ARCH-403",
        title: "Prove Prisma, RLS context and pooling compatibility",
        status: "blocked",
        acceptance:
          "Interactive transactions, transaction-local set_config, prepared statements and managed pooling pass concurrency tests.",
      },
      {
        id: "ARCH-404",
        title: "Rehearse empty bootstrap, provider rehydration and rollback",
        status: "planned",
        acceptance:
          "Forward migrations, synthetic private fixtures, bounded racing-provider replay, reconciliation and rollback checkpoints are timed and reviewed without customer-data copy, delta or dual-write machinery.",
      },
      {
        id: "ARCH-405",
        title: "Create Melbourne secondary and read capacity",
        status: "planned",
        acceptance:
          "Asynchronous cross-region replication, read-only routing, lag/RPO metrics and replica-safe query rules are proven without describing the Melbourne secondary as an automatic zero-loss writer failover.",
      },
      {
        id: "ARCH-406",
        title: "Prove backup, point-in-time restore and corruption recovery",
        status: "blocked",
        acceptance:
          "A restore to an isolated target passes integrity, RLS and application smoke checks with measured RPO/RTO.",
      },
      {
        id: "ARCH-407",
        title: "Drill Melbourne writer promotion and reconnect",
        status: "blocked",
        acceptance:
          "Emergency promotion proves fencing, measured non-zero RPO exposure, endpoint/revision reconnect, RLS checks, reconciliation and failback; a separate healthy planned switchover proves zero-loss only under its documented preconditions.",
      },
      {
        id: "ARCH-408",
        title: "Replace Supabase Realtime for MVP",
        status: "blocked",
        acceptance:
          "A general AlloyDB transactional outbox, idempotent Pub/Sub bridge/DLQ, Sydney and Melbourne Cloud Run WebSocket gateways, separate per-region Standard-tier Memorystore, short-lived grants and cursor replay pass authorization, reconnect, duplicate, Redis-loss and regional-failure tests; Supabase Realtime is absent from the final candidate.",
      },
    ],
  },
  {
    id: "ARCH.P5",
    title: "Australian queues and viral signup flow",
    outcome:
      "Bursty side effects become bounded, idempotent work that cannot overwhelm databases or external providers.",
    tasks: [
      {
        id: "ARCH-501",
        title: "Select and enforce the Australian Pub/Sub topology",
        status: "planned",
        acceptance:
          "An ADR selects one-topic or per-region topics, publishers use compatible regional endpoints, message persistence allows Sydney/Melbourne only and enforced in-transit behavior is tested; residency allowlisting is never claimed to replicate every message to both regions.",
      },
      {
        id: "ARCH-502",
        title: "Create bounded Sydney Cloud Tasks queues",
        status: "planned",
        acceptance:
          "Each queue has dispatch rate, concurrency, timeout and service-identity limits plus a regional fallback decision.",
      },
      {
        id: "ARCH-503",
        title: "Add durable signup and general event outboxes",
        status: "in-progress",
        acceptance:
          "Signup performs the minimum atomic identity/profile write and records one deduplicated event before success; a versioned general outbox covers durable realtime and other critical intent without treating existing signup/usage outboxes as complete coverage.",
      },
      {
        id: "ARCH-504",
        title: "Move side effects and realtime publication to workers",
        status: "in-progress",
        acceptance:
          "Email, onboarding, enrichment, analytics and realtime publication cannot extend or fail the accepted user transaction; deferred email/SMS controls fail visibly rather than presenting dead workflows.",
      },
      {
        id: "ARCH-505",
        title: "Make every consumer idempotent",
        status: "in-progress",
        acceptance:
          "Duplicate delivery, retry and worker restart tests produce one durable business outcome.",
      },
      {
        id: "ARCH-506",
        title: "Configure bounded retry and dead-letter recovery",
        status: "in-progress",
        acceptance:
          "Exponential backoff, jitter, maximum attempts, dead letters, replay approval and poison-message handling pass.",
      },
      {
        id: "ARCH-507",
        title: "Add provider circuit breakers and bulkheads",
        status: "planned",
        acceptance:
          "Slow/failing providers open circuits and consume isolated concurrency without cascading into core requests.",
      },
      {
        id: "ARCH-508",
        title: "Prove backlog drain without database saturation",
        status: "blocked",
        acceptance:
          "A seeded backlog drains inside target while dispatch caps preserve request SLO and safe DB connections.",
      },
    ],
  },
  {
    id: "ARCH.P6",
    title: "Observability and production debugging desk",
    outcome:
      "Operators can distinguish viral demand from attack, trace one request end to end, and take safe recovery actions.",
    tasks: [
      {
        id: "ARCH-601",
        title: "Instrument end-to-end OpenTelemetry traces",
        status: "planned",
        acceptance:
          "Edge/gateway trace context reaches Next.js, Prisma operations, published events and workers with sampled spans.",
      },
      {
        id: "ARCH-602",
        title: "Standardise structured safe logging",
        status: "in-progress",
        acceptance:
          "Every request-reachable log has a normalized non-null request/correlation ID; requestless jobs are explicit null; valid Google trace context is preserved without fabrication; region, revision, operation, outcome and duration are consistent; prohibited values are redacted; and deployed Cloud Logging queries prove the shape.",
      },
      {
        id: "ARCH-603",
        title: "Build route and resource RED/USE dashboards",
        status: "planned",
        acceptance:
          "Rate/errors/duration and utilisation/saturation/errors break down by region, revision, service and operation.",
      },
      {
        id: "ARCH-604",
        title: "Build edge, CDN and WAF dashboard",
        status: "planned",
        acceptance:
          "Hit ratio, fill, egress, policy action, 429, URL cardinality and origin load reveal cache-busting or attack.",
      },
      {
        id: "ARCH-605",
        title: "Build database and queue saturation dashboard",
        status: "planned",
        acceptance:
          "Connections, waits, locks, transaction time, lag, queue age, retries and dead letters share incident context.",
      },
      {
        id: "ARCH-606",
        title: "Create SLOs and multi-window burn alerts",
        status: "blocked",
        acceptance:
          "Actionable paging and ticket thresholds consume approved error budgets without alert storms.",
      },
      {
        id: "ARCH-607",
        title: "Add revision comparison and rollback view",
        status: "planned",
        acceptance:
          "Operators compare canary/current/previous latency and errors and invoke an audited immutable rollback.",
      },
      {
        id: "ARCH-608",
        title: "Build viral-versus-attack diagnosis",
        status: "planned",
        acceptance:
          "Conversion/auth mix and organic route spread are contrasted with WAF, ASN/IP, 429 and cache-bust anomalies.",
      },
      {
        id: "ARCH-609",
        title: "Create incident timeline and recovery controls",
        status: "planned",
        acceptance:
          "Runbooks cover rollback, queue pause, load shed, cache purge, region ejection and database promotion with audit logs.",
      },
      {
        id: "ARCH-610",
        title: "Prove alert ownership and escalation",
        status: "blocked",
        acceptance:
          "Every production alert has an owner, severity, response time, runbook, test notification and fallback contact.",
      },
    ],
  },
  {
    id: "ARCH.P7",
    title: "Gold-standard verification and promotion",
    outcome:
      "The exact immutable candidate survives realistic load, attack controls and failure drills before protected approval.",
    tasks: [
      {
        id: "ARCH-701",
        title: "Pass baseline, ramp, spike and soak profiles",
        status: "blocked",
        acceptance:
          "Isolated staging meets SLO, saturation, autoscale lag, queue age and cost limits at the approved traffic model.",
      },
      {
        id: "ARCH-702",
        title: "Pass cache-bust and edge-policy scenarios",
        status: "blocked",
        acceptance:
          "Authorised non-DoS scenarios prove malicious misses and abusive callers do not consume core origin capacity.",
      },
      {
        id: "ARCH-703",
        title: "Pass Sydney and Melbourne application failure drills",
        status: "blocked",
        acceptance:
          "Instance, revision and region failures validate readiness/service-health routing, surviving capacity and database budgets, or enter the documented degraded mode without relying on outlier detection as perfect ejection.",
      },
      {
        id: "ARCH-704",
        title: "Pass database restore and promotion drills",
        status: "blocked",
        acceptance:
          "PITR, corruption restore, Sydney HA failover, planned switchover and emergency Melbourne promotion meet their separately measured RTO/RPO with fencing, integrity, reconciliation and failback checks.",
      },
      {
        id: "ARCH-705",
        title: "Pass provider, realtime, LiveKit and queue recovery drills",
        status: "blocked",
        acceptance:
          "WorkOS, Stripe, racing data, Pub/Sub, regional application Redis, WebSocket gateways, LiveKit node/Redis/TURN paths and optional providers fail safely without retry amplification or loss of authoritative business state.",
      },
      {
        id: "ARCH-706",
        title: "Pass API and application security gates",
        status: "blocked",
        acceptance:
          "Static contract, negative auth, input, replay, rate-limit and authorised staging security tests have no open release blocker.",
      },
      {
        id: "ARCH-707",
        title: "Pass accessibility and responsive diagram QA",
        status: "verified",
        acceptance:
          "Chrome 150 CDP evidence covers 36 Design Lab viewport cases, 15 contained diagram canvases and 2,223 labelled mobile table cells with zero page overflow; artifacts live under output/design-lab-responsive.",
      },
      {
        id: "ARCH-708",
        title: "Bind evidence to commit and immutable image digest",
        status: "blocked",
        acceptance:
          "All reports name environment, timestamp, source SHA, image digest, commands and observed results.",
      },
      {
        id: "ARCH-709",
        title: "Complete independent architecture verification",
        status: "planned",
        acceptance:
          "A reviewer not responsible for the implementation checks topology, tests, evidence, rollback and open risk.",
      },
      {
        id: "ARCH-710",
        title: "Approve protected production promotion",
        status: "blocked",
        acceptance:
          "Only the successful-CI web-MVP commit and immutable digest with every release blocker closed can receive human approval; native iOS/iPadOS/Android store delivery is explicitly post-MVP and excluded from this denominator.",
      },
    ],
  },
] as const;

export const GREYHOUNDIQ_ARCHITECTURE_TASKS =
  GREYHOUNDIQ_ARCHITECTURE_PHASES.flatMap((phase) => phase.tasks);

export const GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY = Object.freeze({
  total: GREYHOUNDIQ_ARCHITECTURE_TASKS.length,
  verified: GREYHOUNDIQ_ARCHITECTURE_TASKS.filter(
    (task) => task.status === "verified",
  ).length,
  inProgress: GREYHOUNDIQ_ARCHITECTURE_TASKS.filter(
    (task) => task.status === "in-progress",
  ).length,
  planned: GREYHOUNDIQ_ARCHITECTURE_TASKS.filter(
    (task) => task.status === "planned",
  ).length,
  blocked: GREYHOUNDIQ_ARCHITECTURE_TASKS.filter(
    (task) => task.status === "blocked",
  ).length,
  releaseReady: GREYHOUNDIQ_ARCHITECTURE_TASKS.every(
    (task) => task.status === "verified",
  ),
});
