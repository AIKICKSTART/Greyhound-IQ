# Isolated database migration replay

Status: locally verified 97-migration replay; exact commit-bound parity and production parity remain open  
Owner: database reliability and application security  
Evidence date: 2026-07-15

## What was proved

An isolated PostgreSQL 15.18 container was rebuilt from empty storage and bound
only to `127.0.0.1:55734`; it does not share the active Design Lab database or
its volume. The current checkout applied all 97 forward migrations from an empty
`greyhoundiq` database. Prisma then compared `prisma/migrations` with that target
through a separately named disposable `greyhoundiq_shadow` database and returned
`No difference detected` with exit code zero. The source migration digest is
`4812e2d48b9e24ed89dae0c79fb2ff1966b73539bb1ae92a804c2c2ffef1162f` and the
sanitized replay-output digest is
`28e77f97ae58244e924dd9acfdc03fe391975a4d93358d3295aa65ca59eeb1b2`.

The target session used `greyhoundiq_runtime`. The collected role record was
non-superuser, `NOBYPASSRLS`, `NOCREATEROLE` and `NOCREATEDB`; it retained
database `CONNECT` while database `CREATE` and `TEMPORARY` were false. All 107
application tables enabled and forced row-level security. The current Design Lab
target and the clean replay matched all 16 catalog component families in a
read-only diagnostic comparison. That comparison is not canonical parity credit
until its stage-0 source and evidence files are committed exactly at one HEAD.

The source-bound machine artifact is `output/database-audit/migration-replay.json`. Its generator pins both URLs to the disposable port `55734`, requires the explicit `greyhoundiq` and `greyhoundiq_shadow` database names on one literal-loopback endpoint, requires the target to use `greyhoundiq_runtime` and the shadow to use a separate administrative identity, rejects endpoint-override URL parameters and same-database aliases, sanitizes credentials before retaining tool output, binds the replay control implementation, detects source changes during capture and treats Prisma exit code 2 as drift rather than success.

## What this does not prove

- The active Design Lab uses the separate clean v2 volume on port 55735. The
  previous v1 volume is retained offline as rollback evidence, and its account
  graph was restored into v2 with matching per-table hashes. The recovered
  provider/demo database on port 55733 remains separate and unchanged; its two
  historical applied/source checksum mismatches are not rewritten or excused by
  this replay.
- The replay does not prove the production database version, collation, extensions, grants, pooler, TLS path, failover behavior, backups or capacity.
- A clean migration replay proves reproducibility of the current directory. It does not prove every migration is safe under production data volume, lock contention, mixed application versions or rollback pressure.
- The before/after source binding detects a persistent source change during capture, but cannot prove that a file was not changed and restored between the two observations. Run the replay only from a quiescent checkout; an immutable CI workspace is still required for release evidence.
- `greyhoundiq_runtime LOGIN` was enabled only inside the disposable trust-authenticated replay container. Production credentials and role creation remain an external secret-manager/platform responsibility.

## Reproduction contract

1. Create a disposable PostgreSQL target and a different disposable shadow database on the same literal loopback address and port `55734`, named `greyhoundiq` and `greyhoundiq_shadow` respectively.
2. Apply `npx prisma migrate deploy` to the target using an administrative local principal.
3. Enable the migration-created `greyhoundiq_runtime` role only for the isolated local connection and run the RLS probe.
4. Set `LOCAL_DATABASE_URL` to the isolated runtime target and `LOCAL_SHADOW_DATABASE_URL` to the separate administrative shadow database.
5. Run `npm run check:database-migration-replay` and retain the source-bound artifact.

Never point either variable at staging or production. Prisma may reset the shadow database.
