# Security and privacy incident response

Status: **Operational baseline — drill not verified**
Effective date: 2026-07-13
Owner: GreyhoundIQ incident commander
Review cadence: after every incident or drill, and at least annually

## Activation and authority

Anyone with evidence or reasonable suspicion of compromise, unauthorised access/disclosure/modification, data loss, destructive error or provider breach must open an incident immediately. Do not wait to prove impact before containment and assessment.

| Role | Accountability |
|---|---|
| Incident commander | Severity, containment authority, timeline, handoffs and closure |
| Security lead | Technical investigation, credential containment, evidence and eradication |
| Privacy lead | Personal-information map, APP/NDB assessment and notification decision |
| Service owner | Safe service isolation, recovery and validation |
| Legal/adviser | Applicable law, privilege and notification review |
| Communications owner | Approved messages to affected people, OAIC, providers and public |
| Evidence custodian | Integrity, access log and retention for incident artifacts |

Named individuals, on-call contacts and out-of-band channels must be stored in the restricted operations system, not this repository. Missing named assignments blocks production readiness.

## Four-phase runbook

### 1. Detect and contain

- Assign incident ID, commander, severity, discovery time and source.
- Preserve relevant logs, audit rows, provider event IDs, deployment digest and configuration metadata. Never copy live secrets or private message bodies into the ticket.
- Isolate affected service/account/key/bucket/route using the smallest effective change.
- Revoke exposed sessions, keys, webhook secrets and provider tokens; preserve prior versions only in restricted evidence where authorised.
- Stop destructive jobs, exports, webhook reprocessing or deployments if integrity is uncertain.
- Take remedial action early where it can prevent serious harm.

### 2. Assess and investigate

- Build a UTC timeline: first occurrence, discovery, containment and each decision.
- Identify actors, tenants, object IDs, tables/columns, storage objects, providers, backups and logs affected.
- Determine whether data was accessed, modified, disclosed, destroyed, encrypted or merely exposed.
- Identify personal-information categories, number of people, likely serious harm and whether remedial action removed that likelihood.
- Record evidence gaps explicitly; do not infer absence of access from missing logs.

For a suspected eligible breach, take all reasonable steps to complete the assessment within 30 calendar days after awareness of the grounds for suspicion, while aiming substantially sooner. See the [OAIC NDB quick-reference guide](https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches).

### 3. Notify and communicate

- The privacy lead records the eligible-breach decision, reasons, evidence and exceptions.
- If notification is required, prepare the OAIC statement and notify affected individuals and the OAIC as soon as practicable; do not wait until day 30.
- Give affected people useful risk-specific protective actions without disclosing another person's data or investigative detail that creates harm.
- Coordinate provider, insurer, law-enforcement/ACSC and contractual notices where applicable.
- Only the communications owner releases public statements.

### 4. Eradicate, recover and learn

- Fix root cause and add a regression/negative test before normal operation.
- Restore only from a verified clean point; validate authorization, record counts, audit continuity and provider reconciliation.
- Rotate affected credentials and prove old credentials fail.
- Monitor for recurrence and delayed provider events.
- Record lessons, owners, dates and residual risks; update threat model, traces, runbooks and alerts.

## Scenario playbooks

| Scenario | Immediate containment | Evidence and recovery |
|---|---|---|
| Account compromise | Revoke sessions, lock risky changes, verify identity safely | Auth/audit timeline, changed objects, restore permissions and notify user |
| Credential/API-key leak | Disable/rotate secret and dependent sessions; block source if safe | Secret access/use logs, repositories/builds/logs scanned, old key failure proven |
| Database exposure | Restrict network/role, stop unsafe app paths, preserve DB/cloud logs | Tables/columns/rows and query history; clean credentials, RLS/role retest, restore if modified |
| Object-storage exposure | Remove public/IAM grant, revoke signed access, freeze deletion | Bucket/object access logs, object list/hash; restore private policy and test cross-user denial |
| Private-message exposure | Disable affected route/topic/cache and revoke grants | Conversation/member/block timeline; participant impact and notification assessment |
| Payment-provider incident | Disable affected billing operation, retain webhook IDs, never trust browser return | Provider incident/state API, reconcile invoices/entitlements, remove incorrect access |
| Racing-data incident | Quarantine source, label stale/unavailable, stop publication if integrity fails | Raw source hash/provenance, compare provider, correct with audit and disclose correction |
| Malware upload | Quarantine object and derivatives; isolate scanner/service | Hash, scanner/provider logs, access list; clean/rebuild pipeline and notify exposed users if needed |
| Administrator compromise | Revoke admin sessions/role, freeze high-risk mutations and exports | AdminAction/AuditLog/cloud access; independent approval to restore privilege |
| AI-provider data incident | Disable provider/tool, revoke credential, stop prompt/data transmission | Prompt/data categories and provider logs/retention; rotate and re-enable only after scope control |
| Lost signing key | Revoke/rotate, invalidate derived tokens/URLs where possible | Key use, token issuance and access logs; new key and old-token rejection test |
| Webhook-secret compromise | Rotate secret, reject old signatures, pause/reconcile mutations | Provider event ledger, replay/deduplication and authoritative state |
| Ransomware | Isolate workloads/identities/storage, preserve evidence, invoke clean recovery | Backup integrity, restore to isolated environment, credential reset and compromise validation |
| Accidental deletion | Stop jobs/writes, preserve deletion identifiers, avoid unsafe ad-hoc repair | Point-in-time/object-version evidence; isolated restore and integrity reconciliation |

## Severity and escalation

| Severity | Example | Required response |
|---|---|---|
| Critical | Active cross-tenant/admin compromise, widespread private-data extraction, destructive production compromise | Immediate commander and full containment; executive/privacy/legal escalation |
| High | Confirmed protected-data exposure, privileged credential loss, material integrity failure | Immediate same-day response and privacy assessment |
| Medium | Contained limited weakness without confirmed sensitive access | Prompt owner assignment and bounded remediation |
| Low | Defence-in-depth gap with low credible impact | Track, date and verify in normal security work |

## Evidence handling

- Use an immutable/restricted incident location with access logging.
- Record hashes for exported logs/artifacts and source timestamps/timezones.
- Redact tokens, credentials and unrelated personal content.
- Do not run destructive production tests to reconstruct an incident.
- Record every containment mutation with actor, reason, time, target and result.

## Exercises required before release

Run tabletop exercises for account compromise, private-message exposure, payment webhook replay, lost signing key and database exposure. Run technical restore/credential-revocation drills in staging. The incident process is **Not verified** until owners, contacts, alert paths, evidence storage and drill results are recorded.
