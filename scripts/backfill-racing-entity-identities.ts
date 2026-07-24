import "./load-env";

import { prisma } from "../src/lib/db";
import { withDbSystemContext } from "../src/lib/db-context";

const APPLY_CONFIRMATION = "BACKFILL-RACING-ENTITY-IDENTITIES";

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmation = process.argv
    .find((value) => value.startsWith("--confirm="))
    ?.slice("--confirm=".length);
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm=${APPLY_CONFIRMATION}.`);
  }
  if (!apply) {
    const [counts] = await prisma.$queryRaw<
      Array<{ meetings: bigint; races: bigint; watchdogTracks: bigint }>
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE m."sourceProvider" IS NOT NULL AND btrim(m."sourceProvider") <> ''
            AND m."sourceId" IS NOT NULL AND btrim(m."sourceId") <> ''
        )::bigint AS meetings,
        (
          SELECT COUNT(*)::bigint
          FROM "Race" r
          WHERE r."sourceProvider" IS NOT NULL AND btrim(r."sourceProvider") <> ''
            AND r."sourceId" IS NOT NULL AND btrim(r."sourceId") <> ''
        ) AS races,
        COUNT(*) FILTER (
          WHERE lower(m."sourceProvider") = 'watchdog'
            AND m."sourceRawJson" IS JSON
            AND NULLIF(btrim(m."sourceRawJson"::jsonb->>'trackCode'), '') IS NOT NULL
        )::bigint AS "watchdogTracks"
      FROM "Meeting" m
    `;
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          candidates: counts,
          message: `Pass --apply --confirm=${APPLY_CONFIRMATION} to write.`,
        },
        bigintReplacer,
        2,
      ),
    );
    return;
  }

  const result = await withDbSystemContext(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`);
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '15min'`);
      const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          hashtext('greyhoundiq:backfill-racing-entity-identities:v1')
        ) AS acquired
      `;
      if (!lock?.acquired) {
        throw new Error("Another racing identity backfill holds the advisory lock.");
      }

      const meetings = await tx.$executeRaw`
        WITH candidates AS (
          SELECT
            lower(btrim("sourceProvider")) AS provider,
            btrim("sourceId") AS source_id,
            MIN(id) AS canonical_id,
            COUNT(DISTINCT id) AS canonical_count,
            MIN("createdAt") AS first_seen,
            MAX(COALESCE("lastSyncedAt", "createdAt")) AS last_seen
          FROM "Meeting"
          WHERE "sourceProvider" IS NOT NULL AND btrim("sourceProvider") <> ''
            AND "sourceId" IS NOT NULL AND btrim("sourceId") <> ''
          GROUP BY lower(btrim("sourceProvider")), btrim("sourceId")
        )
        INSERT INTO "MeetingProviderIdentity" (
          id,
          "meetingId",
          "sourceProvider",
          "sourceId",
          "verificationStatus",
          "evidenceSha256",
          "firstSeenAt",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        SELECT
          gen_random_uuid()::text,
          canonical_id,
          provider,
          source_id,
          'verified',
          encode(digest(concat_ws('|', provider, 'meeting', source_id, canonical_id), 'sha256'), 'hex'),
          first_seen,
          last_seen,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM candidates
        WHERE canonical_count = 1
        ON CONFLICT ("sourceProvider", "sourceId") DO UPDATE SET
          "verificationStatus" = CASE
            WHEN "MeetingProviderIdentity"."meetingId" = EXCLUDED."meetingId"
              THEN 'verified'
            ELSE 'conflict'
          END,
          "evidenceSha256" = EXCLUDED."evidenceSha256",
          "firstSeenAt" = LEAST(
            "MeetingProviderIdentity"."firstSeenAt",
            EXCLUDED."firstSeenAt"
          ),
          "lastSeenAt" = GREATEST(
            "MeetingProviderIdentity"."lastSeenAt",
            EXCLUDED."lastSeenAt"
          ),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "MeetingProviderIdentity"."verificationStatus" IS DISTINCT FROM CASE
            WHEN "MeetingProviderIdentity"."meetingId" = EXCLUDED."meetingId"
              THEN 'verified'
            ELSE 'conflict'
          END
          OR "MeetingProviderIdentity"."evidenceSha256" IS DISTINCT FROM EXCLUDED."evidenceSha256"
          OR "MeetingProviderIdentity"."firstSeenAt" > EXCLUDED."firstSeenAt"
          OR "MeetingProviderIdentity"."lastSeenAt" < EXCLUDED."lastSeenAt"
      `;

      const races = await tx.$executeRaw`
        WITH candidates AS (
          SELECT
            lower(btrim("sourceProvider")) AS provider,
            btrim("sourceId") AS source_id,
            MIN(id) AS canonical_id,
            COUNT(DISTINCT id) AS canonical_count,
            MIN("createdAt") AS first_seen,
            MAX(COALESCE("lastSyncedAt", "createdAt")) AS last_seen
          FROM "Race"
          WHERE "sourceProvider" IS NOT NULL AND btrim("sourceProvider") <> ''
            AND "sourceId" IS NOT NULL AND btrim("sourceId") <> ''
          GROUP BY lower(btrim("sourceProvider")), btrim("sourceId")
        )
        INSERT INTO "RaceProviderIdentity" (
          id,
          "raceId",
          "sourceProvider",
          "sourceId",
          "verificationStatus",
          "evidenceSha256",
          "firstSeenAt",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        SELECT
          gen_random_uuid()::text,
          canonical_id,
          provider,
          source_id,
          'verified',
          encode(digest(concat_ws('|', provider, 'race', source_id, canonical_id), 'sha256'), 'hex'),
          first_seen,
          last_seen,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM candidates
        WHERE canonical_count = 1
        ON CONFLICT ("sourceProvider", "sourceId") DO UPDATE SET
          "verificationStatus" = CASE
            WHEN "RaceProviderIdentity"."raceId" = EXCLUDED."raceId"
              THEN 'verified'
            ELSE 'conflict'
          END,
          "evidenceSha256" = EXCLUDED."evidenceSha256",
          "firstSeenAt" = LEAST(
            "RaceProviderIdentity"."firstSeenAt",
            EXCLUDED."firstSeenAt"
          ),
          "lastSeenAt" = GREATEST(
            "RaceProviderIdentity"."lastSeenAt",
            EXCLUDED."lastSeenAt"
          ),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "RaceProviderIdentity"."verificationStatus" IS DISTINCT FROM CASE
            WHEN "RaceProviderIdentity"."raceId" = EXCLUDED."raceId"
              THEN 'verified'
            ELSE 'conflict'
          END
          OR "RaceProviderIdentity"."evidenceSha256" IS DISTINCT FROM EXCLUDED."evidenceSha256"
          OR "RaceProviderIdentity"."firstSeenAt" > EXCLUDED."firstSeenAt"
          OR "RaceProviderIdentity"."lastSeenAt" < EXCLUDED."lastSeenAt"
      `;

      const tracks = await tx.$executeRaw`
        WITH observations AS (
          SELECT
            'watchdog'::text AS provider,
            btrim(m."sourceRawJson"::jsonb->>'trackCode') AS source_id,
            m."trackId" AS canonical_id,
            MIN(m."createdAt") AS first_seen,
            MAX(COALESCE(m."lastSyncedAt", m."createdAt")) AS last_seen
          FROM "Meeting" m
          WHERE lower(m."sourceProvider") = 'watchdog'
            AND m."sourceRawJson" IS JSON
            AND NULLIF(btrim(m."sourceRawJson"::jsonb->>'trackCode'), '') IS NOT NULL
          GROUP BY btrim(m."sourceRawJson"::jsonb->>'trackCode'), m."trackId"
        ),
        candidates AS (
          SELECT
            provider,
            source_id,
            MIN(canonical_id) AS canonical_id,
            COUNT(DISTINCT canonical_id) AS canonical_count,
            MIN(first_seen) AS first_seen,
            MAX(last_seen) AS last_seen
          FROM observations
          GROUP BY provider, source_id
        )
        INSERT INTO "TrackProviderIdentity" (
          id,
          "trackId",
          "sourceProvider",
          "sourceId",
          "verificationStatus",
          "evidenceSha256",
          "firstSeenAt",
          "lastSeenAt",
          "createdAt",
          "updatedAt"
        )
        SELECT
          gen_random_uuid()::text,
          canonical_id,
          provider,
          source_id,
          'verified',
          encode(digest(concat_ws('|', provider, 'track', source_id, canonical_id), 'sha256'), 'hex'),
          first_seen,
          last_seen,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM candidates
        WHERE canonical_count = 1
        ON CONFLICT ("sourceProvider", "sourceId") DO UPDATE SET
          "verificationStatus" = CASE
            WHEN "TrackProviderIdentity"."trackId" = EXCLUDED."trackId"
              THEN 'verified'
            ELSE 'conflict'
          END,
          "evidenceSha256" = EXCLUDED."evidenceSha256",
          "firstSeenAt" = LEAST(
            "TrackProviderIdentity"."firstSeenAt",
            EXCLUDED."firstSeenAt"
          ),
          "lastSeenAt" = GREATEST(
            "TrackProviderIdentity"."lastSeenAt",
            EXCLUDED."lastSeenAt"
          ),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "TrackProviderIdentity"."verificationStatus" IS DISTINCT FROM CASE
            WHEN "TrackProviderIdentity"."trackId" = EXCLUDED."trackId"
              THEN 'verified'
            ELSE 'conflict'
          END
          OR "TrackProviderIdentity"."evidenceSha256" IS DISTINCT FROM EXCLUDED."evidenceSha256"
          OR "TrackProviderIdentity"."firstSeenAt" > EXCLUDED."firstSeenAt"
          OR "TrackProviderIdentity"."lastSeenAt" < EXCLUDED."lastSeenAt"
      `;

      return { meetings, races, tracks };
    },
    { maxWait: 10_000, timeout: 1_000_000 },
  );
  console.log(JSON.stringify(result, null, 2));
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
