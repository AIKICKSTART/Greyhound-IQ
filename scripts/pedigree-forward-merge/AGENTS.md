# Purpose

- Owns the one-off, pedigree-only forward merge into the exact Stage 11 R2 database.
- Preserves all live racing integration identities and replay data while adding append-only pedigree provenance and exact-provider parent links.

# Safety contract

- Verification is the default and must end with `ROLLBACK`.
- Apply requires `PEDIGREE_MERGE_MODE=apply` and the exact confirmation string enforced by `entrypoint.sh`.
- Never update or delete `Meeting`, `Race`, `RaceVideo`, or `Runner` rows.
- Never update `Dog.sourceProvider` or `Dog.sourceId`.
- Never match or link a parent by name. Only exact `thedogs` child and parent source IDs may mutate `Dog.sireId` or `Dog.damId`.
- GALTD Volumes 66-73 are retained as append-only observations and assertions. Conflicts remain quarantined and unresolved parent names remain evidence only.
- The job is one-off: do not create or modify a Cloud Scheduler schedule.

# Verification

- Run `node --test scripts/pedigree-forward-merge/contract.test.mjs`.
- Build the image and run verification mode against a disposable or isolated database before any production apply.
- Production apply requires a successful verification-only Cloud Run Job execution against the same immutable image digest and input artifact set.
