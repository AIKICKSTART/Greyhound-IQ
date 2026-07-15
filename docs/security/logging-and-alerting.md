# Logging and alerting register

Status: **Partially verified — delivery/runbooks not proven**  
Evidence date: 2026-07-13  
Owner: security operations and platform SRE

## Repository controls

- `src/lib/logger.ts` emits one-line JSON with severity, event and scalar context to Cloud Run stdout/stderr; error stacks are eligible for Error Reporting. Callers are instructed not to pass bodies, tokens or secrets.
- `src/proxy.ts` forwards `x-request-id` and returns it in responses. The current derivation accepts an arbitrary non-empty caller value; length/character/trust validation is missing (`SEC-H-010`).
- Prisma logs `db.slow_query` above 500 ms without query text/values. Production database failures fail closed and are summarised to avoid connection-string leakage.
- `AuditLog` and `AdminAction` exist. The machine audit registry contains eight partial contracts: authentication callback failure, Stripe webhook receipt, conversation block, media delete, deletion request/finalization/storage cleanup and data-export download.
- `scripts/gcp-monitoring-setup.sh` defines readiness uptime plus alert policies for Cloud Run 5xx ratio over 5%/5m, p95 latency over 3s/10m, instance count at least 8/5m, database failures over 5/5m, any failed/stalled/capped rate-limit cleanup, no complete aggregate-maintenance run for 90 minutes, an unsuccessful aggregate-refresh Scheduler attempt, and readiness failure. It reconciles the corresponding log metrics and policies by stable name and fails on duplicate policy names. These are source definitions only until an authorised environment applies and delivery-tests them.
- Monitoring setup requires the approved project, hostname, Cloud Run service and exact reviewed notification-channel resource name. It fails before mutation if any value is absent or if the channel belongs to another project; it never chooses an arbitrary channel or creates an unpaged alert intentionally.

## Verification and release gaps

Live Cloud Logging sinks/retention/access, Error Reporting, uptime checks, metric/alert policies, notification channel, delivery tests and escalation were not inspected. The script requires one exact non-empty channel resource in the approved project and never selects an arbitrary channel; the validation-only probe does not call Google Cloud. Named responder rosters, false-positive review and test dates remain absent. Required security alerts—authentication attacks, access denials/cross-tenant attempts, privilege/last-owner changes, exports/message/listing/AI anomalies, webhook failures, dead letters, malware, database auth, storage exposure, secret detection, admin access, backups/restores and audit-pipeline failure—are not fully defined.

The aggregate-completion metric-absence policy cannot open an incident until `aggregate_refresh.run_completed` has produced at least one data point after the metric and policy exist. Two deployment blockers therefore remain: seed the metric with a verified successful aggregate run, then conduct an authorised post-seed absence exercise and prove the expected page reaches the reviewed channel. Source validation does neither.

`emit` can include raw error messages/stacks and has no central redaction allowlist; request IDs are not bounded; AuditLog/AdminAction lack durable correlation/trace IDs and integrity/retention evidence; required-audit failure behavior is unverified. Owner: security operations/platform; reason: no authorised live telemetry/configuration or alert exercise evidence was supplied. Before release, every alert needs named owner, severity, threshold, runbook, containment/escalation, false-positive review and a tested delivery record bound to the immutable candidate.
