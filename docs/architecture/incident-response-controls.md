# Incident response controls and first 30 minutes

Status: **provisional and unverified**  
Owner roles: inherited from `config/slo-alert-policy.json`; named roster and fallback contacts are not verified  
Paging, deployment, audit events and exercises: **not proven**

`config/incident-response-controls.json` is the machine-readable source. Validate it with:

```powershell
npm run check:incident-response
```

Passing the check proves source completeness and repository evidence only. It does not activate a control, contact an on-call responder, inspect cloud state or prove that a switch is deployed.

Security, privacy and breach assessment also follow [the security incident-response baseline](../security/incident-response.md); this document owns service containment and recovery controls.

## First 30 minutes

### Minutes 0–5

1. Confirm external user impact and affected critical journeys.
2. Declare provisional severity; freeze deployments, migrations and discretionary jobs.
3. Assign incident commander, operations lead, communications lead and scribe.
4. Open the incident channel and UTC timeline.
5. Classify edge, ingress, compute, database, cache, queue and dependency involvement.
6. Check hostile traffic, credential abuse, privilege changes and evidence loss.

### Minutes 5–15

1. Apply the least destructive available containment; never assume a planned switch exists.
2. Separate legitimate demand from abuse before tightening admission.
3. Roll back only when a revision correlation and immutable last-known-good target are established.
4. Protect the database from optional load, retry amplification and unsafe scale-out.
5. Fail fast or disable optional dependency work; engage the affected provider.
6. Publish the first factual status and next decision time.

### Minutes 15–30

1. Verify containment with external journeys and each affected region.
2. Choose normal, degraded, read-only or unavailable mode based on controls that actually exist.
3. Validate write outcomes, replication, queue age, retries and dead letters.
4. Confirm telemetry and page receipt; use the secondary response route if either is unverified.
5. Set the next decision authority, evidence requirement and communications checkpoint.

## Control inventory

| Control | Source status | What is safe today |
|---|---|---|
| Read-only mode | Unimplemented | Stop optional load; do not claim the app is write-fenced |
| Anonymous restriction | Unimplemented | Use only an approved existing edge control; no repository emergency policy exists |
| Search disable | Repository implemented | The pre-work guard and false-default deploy mapping exist; a no-traffic candidate must pass smoke before exact revision promotion. Deployment and exercise remain unverified |
| Report disable | Unimplemented | No server-enforced switch |
| Export disable | Repository implemented | The pre-work guard and false-default deploy mapping exist; candidate smoke precedes exact revision promotion. Deployment and exercise remain unverified |
| Upload disable | Repository implemented | The pre-work guard and false-default deploy mapping exist; candidate smoke precedes exact revision promotion. Deployment and exercise remain unverified |
| AI disable | Repository implemented | New agent runs and OpenAI dog-card generation have pre-work guards plus the false-default deploy mapping; deployment and exercise remain unverified |
| Queue pause | Unimplemented | Reduce available service-specific pressure; no per-class pause contract |
| Database write protection | Unimplemented | Freeze changes and optional load; do not improvise a write fence |
| Revision rollback | Manual, documented | Follow the reviewed rollback section in `docs/gcp-cloud-run-migration-plan.md` after identifying the immutable target |
| Regional ejection | Unimplemented | The repository deployment remains single-region Sydney; there is no Melbourne runtime to eject to |
| Melbourne database promotion | Unimplemented | No Melbourne database exists in deployed evidence; do not promote without a deployed secondary and exercised procedure |
| Realtime broadcast disable | Repository implemented | The source guard and false-default deploy mapping exist; candidate smoke precedes exact revision promotion. Deployment and exercise remain unverified |

“Repository implemented” means reviewed source code and its repository deployment mapping exist. “Manual, documented” means an operator procedure exists. Neither means deployed or tested.

## AI and agent workload inventory

- `POST /api/agents/[type]/run` creates optional agent, memory, usage and audit records using the repository's deterministic local output builders; it does not currently call an external model. `AI_DISABLED` rejects before authentication/rate-limit work and the shared service repeats the guard for the server-action caller.
- Agent context, run-list, run-detail and cancellation routes remain available while new optional runs are disabled.
- Dog-card generation is a server action backed by `src/lib/dog-card-service.ts`; it is the only current `src/` workload found calling an external model endpoint (`https://api.openai.com/v1/images/edits`). `AI_DISABLED` rejects before entitlement, database, file, storage or provider work.
- This is repository inventory, not deployed-runtime proof. The focused source contract prevents the guarded and deliberately unguarded route boundaries from drifting silently.

## Deployment exposure audit

- `.github/workflows/cloud-run-deploy.yml` exposes `SEARCH_DISABLED`, `EXPORT_DISABLED`, `UPLOAD_DISABLED`, `AI_DISABLED` and `REALTIME_BROADCAST_DISABLED` as explicit false-default choices. A shared normalizer accepts only exact `true` or `false` (an absent non-dispatch input becomes `false`) and rejects every other value before deployment.
- The GitHub workflow deploys a tagged no-traffic candidate, resolves the exact created revision, runs the smoke suite against the candidate URL and only then promotes that exact web and scanner revision. Promotion removes the temporary web tag so an old tagged revision cannot retain revision-level minimum-instance cost. Production still depends on external GitHub environment configuration; required reviewers and branch protection are not verifiable from repository source and remain unverified.
- `scripts/gcp-cloud-run-deploy.ps1` uses case-sensitive `ValidateSet("true", "false", IgnoreCase = $false)` with default `false` for the same five controls, refuses local production deployment, smokes the tagged staging candidate before traffic, removes the temporary tag and promotes exact revisions rather than `latest`.
- No cloud command was run while creating this evidence. The boolean mappings are not logged and the existing secret mappings remain separate. Direct out-of-band `gcloud` mutation would bypass the repository approval/evidence contract and must not be used.
- These controls still require a deployment rather than an instantaneous runtime toggle. Activation, restoration, audit delivery, expiry or automatic restoration, live reviewer protection and staging exercises remain unverified.

## RB-IR-SUDDEN-LOAD-OR-L7

Owner: platform SRE; fallback: incident commander.  
Trigger: critical SLO burn, origin saturation, cache bypass or hostile HTTP flood.

- First safe action: freeze changes, distinguish legitimate demand from abuse and use verified edge/admission controls first. If a source control is required, use only the reviewed candidate-deploy path with incident authority; it remains unproven until staging activation and restoration are exercised.
- Prohibited: do not scale beyond database/cost budgets; do not block shared-IP or provider cohorts without checking legitimate impact.
- Recovery: critical journeys and both burn windows recover; origin, database and cost saturation return below approved limits.
- Preserve: WAF/cache/route/identity/region/revision summaries and every policy mutation with UTC time and approver.
- Source unit contract: the fail-closed parser plus pre-rate-limit search and pre-database-export guards pass locally. Deployment, incident exercise and paging delivery remain unverified.

## Rate-limit cleanup backlog

- **Symptoms:** `aggregate_refresh.rate_limit_prune_attention`, status `failed` or `backlog`, `capped`/`stalled` true, or repeated growth in expired `RateLimit` rows.
- **Confirm:** compare hourly deleted rows with expired-row arrival, database CPU/IO/locks, pool utilisation, aggregate-refresh duration and Scheduler attempt history. The source policy pages on any unsuccessful Scheduler finish and when no full `aggregate_refresh.run_completed` event arrives for 90 minutes; treat either as an observability incident until delivery is proven.
- **First safe action:** preserve database capacity by tightening abusive-route admission at the edge/application and pausing optional high-cardinality work. Keep the capped cleanup batch and materialized-view deadlines unchanged during initial containment.
- **Do not:** remove the `resetAt` predicate, run an unbounded delete, raise worker concurrency blindly, disable RLS/system context, or retry overlapping aggregate refreshes.
- **Recovery:** after load is contained, run one authorised maintenance attempt, verify expired rows decrease, every materialized view completes inside the 780-second application budget, and the following scheduled run reports `aggregate_refresh.rate_limit_prune_completed`.
- **Escalate:** SRE owns coordination; DBRE reviews plan/lock/pool evidence; Security owns abusive-key containment. The source threshold pages on the first failed, stalled or capped backlog run.
- **Evidence:** retain correlated structured events, query/lock metrics, Scheduler execution, deploy/config markers and the exact remediation change. The destructive loopback-only integration command `npm run check:rate-limit-maintenance-postgres` requires its explicit URL and confirmation variables and proves database behavior only on the disposable port-55734 replay target. Metric absence cannot alert before the deployed completion metric receives its first `aggregate_refresh.run_completed` sample. Seeding that successful sample and then proving a post-seed absence page are separate deployment blockers; the alert and paging path remain unproven until both and this runbook are exercised.

## Scheduled-task failure or missed run

- **Symptoms:** `scheduled_task.failed`, `scheduled_task.overlap`, an unsuccessful GreyhoundIQ Cloud Scheduler `AttemptFinished`, or a task-specific completion-absence policy.
- **Confirm:** identify the exact task, schedule, last start/completion and deadline; inspect database saturation and dependency latency; then confirm whether another run still owns the advisory lock. Treat a first-sample absence policy as unproven until its completion metric has emitted once.
- **First safe action:** freeze scheduler/deployment changes and protect database capacity. Let the active lock owner finish or time out; never bypass the lock. If no owner exists, use one authenticated POST to the same internal route.
- **Recovery:** rely on the task's bounded, repeat-safe selector or upsert/update semantics. Live sync re-reads its configured results/upcoming window; maintenance jobs reselect due rows; probes are read-only unless their explicit write flag is enabled. Verify one `scheduled_task.completed` event, the next normal run, and any affected queue/backlog before closing.
- **Do not:** invoke a handler directly, change a task to GET, remove its bound, raise retries while a dependency is slow, or replay an optional write probe without its explicit environment approval.
- **Evidence:** preserve task ID, schedule, attempt deadline, Scheduler attempt metadata, structured events, database/pool saturation and the immutable revision. Source-defined policies do not prove deployed Scheduler jobs, metric ingestion, notification delivery or an exercised replay.

## Usage delivery backlog or dead letter

- **Symptoms:** `usage_delivery.attention`, non-zero retry/dead-letter/lease-loss counts, more than 100 due rows, an oldest pending age over 10 minutes, or a missing `usage-delivery` scheduled completion.
- **Confirm:** compare due and oldest-pending counts with arrival/completion rate; inspect Lago latency/status, database pool pressure, current lease owners and the active revision. Use only row identifiers, metric keys and normalized error codes; never inspect or copy provider credentials into incident notes.
- **First safe action:** protect critical database and authentication paths, keep delivery concurrency capped at five, and stop any manual replay until the current 45-second leases expire. If Lago is slow, let deterministic bounded retries queue work instead of increasing request concurrency.
- **Do not:** reset retry counts, clear lease tokens, purge pending/dead-letter rows, send a different Lago transaction ID, bypass current account/subscription checks, or expose `LAGO_API_KEY` while testing.
- **Recovery:** after the dependency is healthy, invoke one authenticated scheduled route only when no owner holds the task lock. Verify completion exceeds arrival, oldest age falls below 10 minutes, no new dead letters appear and Lago reflects each durable idempotency key once. Dead-letter replay requires billing-owner approval and a documented disposition for the normalized error code.
- **Evidence:** retain aggregate queue counts, oldest age, task/lease events, sanitized provider status, immutable revision and operator actions. Source configuration does not prove the Cloud Scheduler job, alert ingestion, paging delivery, Lago metric field configuration or a completed replay exercise.

## RB-IR-DATABASE-INTEGRITY

Owner: platform SRE; fallback: incident commander.  
Trigger: pool exhaustion, writer uncertainty, corruption, unsafe lag or failed primary.

- First safe action: stop optional load and retries, freeze changes and establish whether acknowledged writes have known outcomes.
- Prohibited: no blind unknown-commit retry, destructive schema rollback, unapproved promotion or premature write reopening.
- Recovery: data checks plus critical read/write journeys pass; pool, locks, lag and transactions stay stable through staged reopen.
- Preserve: safe error classes, timestamps, pool/replication state, revision, migration digest and recovery-point identifiers; never query values.
- Test and paging delivery: unverified.

## RB-IR-BAD-DEPLOYMENT

Owner: platform SRE; fallback: incident commander.  
Trigger: user failures, errors or latency correlate with the current revision or configuration.

- First safe action: freeze changes, identify the immutable last-known-good revision and obtain incident authority for the documented manual traffic rollback.
- Prohibited: no destructive database rollback and no untested revision target.
- Recovery: external smoke and critical journeys pass; burn recovers without data inconsistency before progressive restoration.
- Preserve: image/revision/configuration digests, traffic percentages, deployment logs and UTC decision record.
- Test and paging delivery: unverified by this registry; historical staging notes are not current production proof.

## RB-IR-QUEUE-BACKLOG

Owner: platform SRE; fallback: incident commander.  
Trigger: oldest critical job breaches SLO, retries/dead letters rise, or workers threaten downstream capacity.

- First safe action: reduce producers and dispatch through any verified service-specific control; quarantine poison messages.
- Prohibited: do not scale past downstream limits, purge messages or blind-replay dead letters.
- Recovery: completion exceeds arrival, oldest age falls inside SLO and critical outcomes reconcile.
- Preserve: age, depth, arrival, completion, retry, dead-letter and schema evidence without message payloads.
- Test and paging delivery: unverified; the general per-class pause control is unimplemented.

## RB-IR-UPLOAD-PIPELINE

Owner: service owner; fallback: incident commander.  
Trigger: scanner/storage outage, malicious content signal or uncontrolled upload cost.

- First safe action: preserve quarantine and use a verified upstream admission control first. If upload signing must be disabled, use only the reviewed candidate-deploy path with incident authority; it remains unproven until staging activation and restoration are exercised.
- Prohibited: do not bypass scanning, publish quarantine or delete suspected evidence before review.
- Recovery: scanner freshness, signing, quarantine and clean-download staging tests pass; backlog drains within budgets.
- Preserve: object-safe identifiers, verdicts and definition age without signed URLs; retain quarantined evidence under policy.
- Source unit contract: the fail-closed parser and pre-authentication upload guard pass locally. Deployment, scanner/storage recovery exercise and paging delivery remain unverified.

## RB-IR-REGIONAL-OUTAGE

Owner: platform SRE; fallback: incident commander.  
Trigger: independent probes confirm Sydney regional failure or primary database loss.

- First safe action: freeze changes, confirm the current single-region failure, and remain degraded or unavailable rather than improvising a Melbourne promotion; no Melbourne runtime or database is deployed in current evidence.
- Prohibited: no unverified secondary promotion, split brain or traffic shift without N-1 capacity and dependency checks.
- Recovery: regional journeys, recovery point and queues validate; reconciliation and failback authority are recorded before normal writes.
- Preserve: regional health, lag, recovery point, traffic state and every ejection/promotion/load-balancer decision.
- Test and paging delivery: unverified; regional ejection and database promotion are unimplemented.

## RB-IR-REALTIME-SIDE-EFFECT

Owner: service owner; fallback: platform SRE.  
Trigger: realtime provider latency, errors or fan-out threatens the critical path.

- First safe action: prove critical-path independence and use verified provider/upstream containment first. If broadcast suppression is required, use only the reviewed candidate-deploy path with incident authority; it remains unproven until staging activation and restoration are exercised.
- Prohibited: do not bypass authorisation, expose channel data or hot-edit production.
- Recovery: critical journeys remain healthy while suppressed; staging proves authorised broadcast before restoration.
- Preserve: provider health, safe error counts, revision and correlation identifiers without message content.
- Test and paging delivery: unverified; code presence is not deployment proof.

## Launch blockers exposed by this registry

- Implement the remaining server-enforced read-only and optional-feature switches; verify production environment reviewer rules, then activate and restore search/export/upload/AI/realtime controls in approved staging while capturing exact revisions and audit evidence.
- Add time-bounded activation, dual approval where required, immutable audit events and expiry or explicit restoration reminders; the current source mapping requires a deployment and is not an instantaneous control plane.
- Implement per-job-class queue pause/drain and an audited database write fence.
- Decide, provision and then exercise a Melbourne recovery runtime and database before claiming regional ejection, promotion, reconciliation or failback.
- Assign named primary/fallback responders and prove notification receipt inside response targets.
- Emit immutable audit events for activation, expiry and restoration of every emergency control.
