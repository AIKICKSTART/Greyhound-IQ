# SLO and alert policy

Status: **provisional and unverified**  
Owner roles: platform SRE, service owner and incident commander are **not yet assigned to named responders**

`config/slo-alert-policy.json` is the machine-readable source. Validate it with:

```powershell
npm run check:slo-alert-policy
```

Passing this check proves only that the proposed SLOs, burn windows, owner roles and runbook links are internally complete. It does not prove metric bindings, deployed alert policies, paging delivery, named roster coverage or an exercised response.

## Proposed objectives

| Workload | Class | Proposed 30-day target | Supporting latency/delay target |
|---|---|---:|---|
| Critical reads | Critical | 99.95% availability | p50 120 ms, p95 350 ms, p99 1,000 ms |
| Critical writes | Critical | 99.9% known outcomes | p50 250 ms, p95 750 ms, p99 2,000 ms |
| Existing-session authentication | Critical | 99.95% availability | Route latency remains visible by region and revision |
| New login and end-to-end journey | Critical | 99.9% availability | Synthetic journey measured from Australia |
| Critical jobs | Critical | 99% within 300 seconds | p50 30 s, p95 60 s, p99 300 s |
| Optional features | Noncritical | 99.5% availability | Ticket before optional work threatens the critical path |
| Optional jobs | Noncritical | 99% within 3,600 seconds | p50 300 s, p95 900 s, p99 3,600 s |

These are planning targets, not approved business commitments. At 99.95%, the 30-day availability budget is 21 minutes 36 seconds; at 99.9%, it is 43 minutes 12 seconds. Latency and queue objectives consume bad-event budgets rather than downtime minutes.

## Alert contract

| Class | Trigger | Action | Response target | Noise control |
|---|---|---|---:|---|
| Critical fast burn | 14.4× over both 5 minutes and 1 hour | Sev-1 page | 5 minutes | Minimum traffic, both windows, SLO/region/service dedupe, 60-minute renotify |
| Critical sustained burn | 6× over both 30 minutes and 6 hours | Sev-2 page | 15 minutes | Both windows and 360-minute renotify |
| Noncritical sustained burn | 3× over both 2 hours and 24 hours | Sev-3 ticket | 4 hours | No page; optional feature may be disabled first |

Normal releases freeze when 25% of a budget is consumed in seven days, 50% in 30 days, or any Sev-1 remains unresolved. Resumption requires stable burn below 1 for 60 minutes plus platform SRE and service-owner approval. These thresholds are still unapproved.

## RB-SLO-CRITICAL-AVAILABILITY

- Confirm real user and synthetic failures by SLO, operation, region, service and revision; declare severity and freeze deployments.
- First safe action: roll back a correlated bad revision or shed optional traffic while preserving authentication, core reads and known write outcomes.
- Do not restart every region, bypass edge controls, or retry unknown writes.
- Escalate to the incident commander within five minutes if impact is confirmed or telemetry is contradictory.
- Recovery is valid only when the critical journey succeeds and both burn windows recover; preserve the timeline and candidate revision.

## RB-SLO-CRITICAL-LATENCY

- Confirm tail latency with traffic, error, concurrency, DB pool/wait, cache, queue and dependency signals; compare current and prior revisions.
- First safe action: stop optional work and cap admission before a slow dependency exhausts concurrency or database connections.
- Do not raise instance or worker maxima beyond the proven database and cost budgets.
- Roll back a correlated revision; circuit-break a slow optional dependency; enter read-only mode if writer state becomes uncertain.
- Escalate to the incident commander if p99 and fast burn remain active after containment.

## RB-SLO-CRITICAL-QUEUE

- Confirm arrival rate, completion rate, oldest age, retries, dead letters and downstream saturation for the affected job class.
- First safe action: reduce or pause producers and cap worker dispatch to the safe downstream budget.
- Do not blindly replay dead letters, multiply retry attempts, or scale workers past database/provider limits.
- Quarantine poison messages; preserve idempotency and ordering evidence before scoped replay.
- Escalate if critical intent is not durable, queue age keeps rising, or the recovery-point objective is at risk.

## RB-SLO-NONCRITICAL

- Open a Sev-3 ticket with the affected SLO, region, service, revision and current budget consumption.
- First safe action: disable, defer or queue the optional feature so it cannot consume critical-path capacity.
- Do not page solely for the proposed noncritical burn policy or restore the feature while critical SLOs are unhealthy.
- Escalate to platform SRE if the failure leaks into a critical journey, cost accelerates, or backlog threatens shared dependencies.
- Close only after recovery is measured and the service owner records the follow-up action.

## Evidence required before production

- Product and engineering approve targets, exclusions and error-budget policy.
- Metric queries reproduce known good/bad fixtures and preserve region, revision, service and operation dimensions.
- Alert policies are deployed from reviewed configuration and linked to immutable candidate evidence.
- Named primary and fallback responders acknowledge test pages within the response targets.
- A tabletop and a controlled staging burn exercise validate every first safe action and escalation path.
