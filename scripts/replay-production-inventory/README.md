# Replay production inventory

This workflow creates a restricted, read-only replay-evidence inventory from an offline PostgreSQL copy. It does not test playback, discover providers, repair links, contact the internet, or write to PostgreSQL.

## Safety boundary

`export.mjs` refuses to start unless all of these are true:

- `--container` is one explicit Docker container name;
- Docker reports that exact container as running with `NetworkMode=none`;
- both Docker port inventories have zero published bindings;
- `psql` runs as the container's `postgres` OS user against exactly `giq_production_stage11_20260718_r2`;
- libpq is pinned to the container-local PostgreSQL Unix socket and the SQL proves the `postgres` session identity;
- the session is read-only and repeatable-read and `pgcrypto` is installed;
- the export session uses a bounded 64 MiB PostgreSQL work-memory budget with a 1 GiB isolated-container shared-memory ceiling;
- the fixed cutoff is `TIMESTAMP '2006-01-01 00:00:00'`;
- the source projection is complete and the output filesystem has the conservative free-space reserve.

The SQL contains one `COPY (SELECT ...) TO STDOUT` statement. Raw provider JSON and result GPS are never emitted: only byte counts and SHA-256 digests are retained.

## Run

The output parent must already exist. The run directory must not exist.

```powershell
node scripts/replay-production-inventory/export.mjs `
  --container EXACT_OFFLINE_CONTAINER_NAME `
  --output D:\restricted-evidence\replay-inventory-YYYYMMDD
```

The workflow writes into `<output>.partial`, verifies the gzip stream, then atomically renames the directory to `<output>`. Failures leave the `.partial` directory for diagnosis and never overwrite a prior run.

To re-verify an incomplete offline artifact without querying PostgreSQL:

```powershell
node scripts/replay-production-inventory/verify.mjs D:\restricted-evidence\replay-inventory-YYYYMMDD.partial --finalize
```

After finalization, build the URL-free month grids and provenance companion without
querying PostgreSQL or rerunning the export:

```powershell
node scripts/replay-production-inventory/build-companion.mjs `
  --inventory D:\restricted-evidence\replay-inventory-YYYYMMDD `
  --output D:\restricted-evidence\replay-inventory-YYYYMMDD-companion `
  --source-dump D:\restricted-evidence\source.dump `
  --source-dump-sha256 EXACT_SHA256 `
  --recovery-evidence D:\restricted-evidence\source-verification.tsv
```

The companion accepts only a finalized inventory, validates its manifest, context,
snapshot header, counts, SQL hash and compressed ledger hash, excludes races scheduled
after the export transaction time, and atomically writes zero-filled month coverage,
scope evidence, a companion manifest and `SHA256SUMS` through `<output>.partial`.

## Artifacts

- `race-replay-inventory.restricted.jsonl.gz`: one URL-bearing row per canonical race, including full runner/result context and every stored video candidate.
- `replay-aggregates.json`: URL-free year, state, track, provider and provisional-class totals.
- `replay-anomalies.jsonl.gz`: URL-free anomaly rows; URL evidence is represented only by SHA-256 fingerprints.
- `export-context.json`: container isolation, source projection and query fingerprint.
- `manifest.json`: exact line/unique-ID gates and byte/SHA-256 evidence for every preceding artifact.

The raw ledger is restricted evidence. Do not publish it.

## Fail-closed classifications

Classification precedence is identity conflict, TheDogs licence gate, stored failure-only evidence, structurally resolvable, provider resolvable, partial source, legacy reference, provider discovery, then no stored evidence. The only emitted values are:

- `identity_conflict`
- `structurally_resolvable_unverified`
- `license_gated_unverified`
- `provider_resolvable_unverified`
- `stored_source_failure_only`
- `partial_source`
- `legacy_reference_unverified`
- `provider_discovery_unverified`
- `no_stored_replay_evidence`

HTTP status, URL shape, freshness and runtime-selection flags are metadata only. Every record and report explicitly leaves playback and cross-field coherence unverified.

## Offline check

```powershell
node --test scripts/replay-production-inventory/replay-production-inventory.test.mjs
node --test scripts/replay-production-inventory/build-companion.test.mjs
```
