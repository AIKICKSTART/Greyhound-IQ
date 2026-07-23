# Backup and recovery

Status: **Partially verified — blocked from release**
Evidence date: 2026-07-13
Owner: Database and reliability owner

## Current evidence

- `scripts/gcp-cloud-run-bootstrap.sh` creates environment-specific GCS `backups` buckets alongside media-processing and export buckets.
- `docs/gcp-cloud-run-migration-plan.md` records a historical staging schema-only PostgreSQL restore into a disposable local PostgreSQL 17 environment and a successful Cloud Run revision rollback drill.
- The same plan explicitly says a full Supabase data/PITR restore remains required before production cutover.
- No live backup policy, backup object, encryption key, retention lock, PITR window, freshness alert or current restore result was inspected in this review.
- Approved RPO and RTO values were not found. They remain **Control missing**, not zero.

## Recovery inventory

| Asset | Required backup/recovery mechanism | Current status |
|---|---|---|
| PostgreSQL application data | Encrypted automated backup plus PITR; isolated full restore | Full data/PITR Not verified |
| Prisma schema/migrations | Version-controlled forward migrations bound to deployed SHA | Present, but production migration/backup binding incomplete `SEC-H-005` |
| Supabase/GCS media | Object version/backup policy consistent with deletion and malware quarantine | Not verified |
| Exports | Normally ephemeral; regenerate or retain per approved policy | Retention/cleanup Not verified |
| Secret Manager | Rotation/recovery procedure; no secret values in backup docs | Secret versions used as `latest`; recovery Not verified |
| Cloud Run configuration | Revision/image digest, env/secret references and traffic history | Revision rollback design present; automatic rollback absent |
| Artifact Registry | Immutable approved image digest and retention policy | Digest resolution present; signing/provenance absent |
| WorkOS/Stripe/Lago/LiveKit state | Provider exports/API reconciliation and incident contacts | Not verified |
| Audit/security logs | Separate durable retention with access/integrity protection | Not verified |
| CI/CD configuration | Git history and protected repository/environment settings | Repository present; live protection settings Not verified |

## Required restore procedure

1. Incident commander defines recovery point and freezes unsafe writes/jobs.
2. Evidence custodian records current revision, image digest, migration state, database timestamp and backup identifier.
3. Restore into an isolated staging/scratch environment with production egress and notifications disabled.
4. Apply only the source/migrations that belong to the chosen recovery point.
5. Verify schema, constraints, RLS runtime role, row counts, sampled relationships, private-media references, webhook uniqueness and audit continuity.
6. Reconcile billing/provider state from authoritative provider APIs without replaying browser returns.
7. Verify account deletions remain deleted/beyond use and blocked/private relationships remain enforced.
8. Run signed-out, cross-user, cross-role, critical read/write, messaging, media and billing smoke tests.
9. Obtain explicit incident/release approval before production traffic.
10. Record actual recovery time, recovery point, data gaps and follow-up actions.

## Backup safety

- Backups must be encrypted, private, separately authorised and inaccessible to ordinary runtime roles.
- Production restore credentials must not be available to pull-request or staging jobs.
- Backups must not be treated as an indefinite exception to APP 11 lifecycle duties. When immediate removal is impractical, deleted information must be beyond use, access-controlled and expire under an approved schedule.
- Malware/quarantined objects must not silently return through restore.
- Restore jobs need idempotency/locking so concurrent runs cannot corrupt the target.
- A successful backup job is not restore evidence.

## Release gates

Production remains blocked until:

1. Production backup/PITR settings and encryption are captured without secrets.
2. Named RPO/RTO and retention are approved by product, privacy and reliability owners.
3. A complete representative data restore succeeds in an isolated environment.
4. Authorization/RLS and deletion integrity tests pass on the restored data.
5. Backup freshness and restore-test failure alerts have owners and tested delivery.
6. Each production migration is bound to a successful backup identifier, exact source SHA/image digest and reviewed forward plan.
7. The restore drill is repeated on schedule and after material storage/schema change.
