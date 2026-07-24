import "./load-env";

import { pathToFileURL } from "node:url";

import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/db";
import { withDbSystemContext } from "../src/lib/db-context";

const APPLY_CONFIRMATION = "RESOLVE-LIVE-FEED-QUARANTINE";
const ACTOR_JOB = "resolve-live-feed-quarantine/v1";

type Options = {
  apply: boolean;
  cutoff: Date;
  terminalClassifyUnresolved: boolean;
};

type LockRow = { acquired: boolean };

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!options.apply) {
    console.log(
      JSON.stringify(
        await inspect(options.cutoff),
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
      const [lock] = await tx.$queryRaw<LockRow[]>`
        SELECT pg_try_advisory_xact_lock(
          hashtext('greyhoundiq:resolve-live-feed-quarantine:v1')
        ) AS acquired
      `;
      if (!lock?.acquired) {
        throw new Error("Another quarantine resolution run holds the advisory lock.");
      }

      const aggregated = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "LiveFeedQuarantineSummary" (
          "id",
          "provider",
          "entityKind",
          "sourceId",
          "sourceKey",
          "naturalIdentity",
          "reasonCode",
          "classification",
          "evidenceSha256",
          "firstSeenAt",
          "lastSeenAt",
          "occurrenceCount",
          "reviewStatus",
          "createdAt",
          "updatedAt"
        )
        SELECT
          gen_random_uuid()::text,
          q.provider,
          q."entityKind",
          NULLIF(btrim(q."sourceId"), ''),
          COALESCE(NULLIF(btrim(q."sourceId"), ''), ''),
          MAX(NULLIF(btrim(q."naturalIdentity"), '')),
          q."reasonCode",
          MAX(q.classification),
          q."evidenceSha256",
          MIN(q."observedAt"),
          MAX(q."observedAt"),
          COUNT(*)::bigint,
          'pending',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM "LiveFeedQuarantine" q
        WHERE q."observedAt" <= ${options.cutoff}
        GROUP BY
          q.provider,
          q."entityKind",
          NULLIF(btrim(q."sourceId"), ''),
          COALESCE(NULLIF(btrim(q."sourceId"), ''), ''),
          q."reasonCode",
          q."evidenceSha256"
        ON CONFLICT (
          "provider",
          "entityKind",
          "sourceKey",
          "reasonCode",
          "evidenceSha256"
        ) DO UPDATE SET
          "naturalIdentity" = COALESCE(
            "LiveFeedQuarantineSummary"."naturalIdentity",
            EXCLUDED."naturalIdentity"
          ),
          "classification" = EXCLUDED."classification",
          "firstSeenAt" = LEAST(
            "LiveFeedQuarantineSummary"."firstSeenAt",
            EXCLUDED."firstSeenAt"
          ),
          "lastSeenAt" = GREATEST(
            "LiveFeedQuarantineSummary"."lastSeenAt",
            EXCLUDED."lastSeenAt"
          ),
          "occurrenceCount" = EXCLUDED."occurrenceCount",
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          (
            "LiveFeedQuarantineSummary"."naturalIdentity" IS NULL
            AND EXCLUDED."naturalIdentity" IS NOT NULL
          )
          OR "LiveFeedQuarantineSummary"."classification" IS DISTINCT FROM EXCLUDED."classification"
          OR "LiveFeedQuarantineSummary"."firstSeenAt" > EXCLUDED."firstSeenAt"
          OR "LiveFeedQuarantineSummary"."lastSeenAt" < EXCLUDED."lastSeenAt"
          OR "LiveFeedQuarantineSummary"."occurrenceCount" IS DISTINCT FROM EXCLUDED."occurrenceCount"
      `);

      const formEntriesLinked = await tx.$executeRaw(Prisma.sql`
        WITH raw_cases AS (
          SELECT
            s.id AS summary_id,
            evidence.payload->>'formEntryId' AS form_entry_id,
            evidence.payload->>'dogId' AS dog_id,
            evidence.payload->>'raceId' AS race_id
          FROM "LiveFeedQuarantineSummary" s
          JOIN LATERAL (
            SELECT q."evidenceJson"::jsonb AS payload
            FROM "LiveFeedQuarantine" q
            WHERE q."evidenceSha256" = s."evidenceSha256"
            ORDER BY q."observedAt" DESC
            LIMIT 1
          ) evidence ON true
          WHERE s."reviewStatus" = 'pending'
            AND s."reasonCode" = 'form_entry_runner_missing_after_live_sync'
            AND s."lastSeenAt" <= ${options.cutoff}
        ),
        cases AS (
          SELECT DISTINCT ON (raw_cases.dog_id, raw_cases.race_id)
            raw_cases.*
          FROM raw_cases
          JOIN "FormEntry" candidate ON candidate.id = raw_cases.form_entry_id
          WHERE candidate."raceId" IS NULL
          ORDER BY
            raw_cases.dog_id,
            raw_cases.race_id,
            (
              (candidate.time IS NOT NULL)::int
              + (candidate.weight IS NOT NULL)::int
              + (candidate.finish IS NOT NULL)::int
            ) DESC,
            candidate."createdAt" DESC,
            candidate.id
        )
        UPDATE "FormEntry" form_entry
        SET "raceId" = cases.race_id
        FROM cases
        JOIN "Race" race ON race.id = cases.race_id
        WHERE form_entry.id = cases.form_entry_id
          AND form_entry."dogId" = cases.dog_id
          AND form_entry."raceId" IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "FormEntry" existing
            WHERE existing."dogId" = cases.dog_id
              AND existing."raceId" = cases.race_id
              AND existing.id <> form_entry.id
          )
      `);

      const formEntrySurvivorsEnriched = await tx.$executeRaw(Prisma.sql`
        WITH cases AS (
          SELECT
            evidence.payload->>'formEntryId' AS form_entry_id,
            evidence.payload->>'dogId' AS dog_id,
            evidence.payload->>'raceId' AS race_id
          FROM "LiveFeedQuarantineSummary" s
          JOIN LATERAL (
            SELECT q."evidenceJson"::jsonb AS payload
            FROM "LiveFeedQuarantine" q
            WHERE q."evidenceSha256" = s."evidenceSha256"
            ORDER BY q."observedAt" DESC
            LIMIT 1
          ) evidence ON true
          WHERE s."reviewStatus" = 'pending'
            AND s."reasonCode" = 'form_entry_runner_missing_after_live_sync'
            AND s."lastSeenAt" <= ${options.cutoff}
        ),
        compatible AS (
          SELECT
            retired.id AS retired_id,
            survivor.id AS survivor_id,
            retired.time AS retired_time,
            retired.weight AS retired_weight
          FROM cases
          JOIN "FormEntry" retired ON retired.id = cases.form_entry_id
          JOIN "FormEntry" survivor
            ON survivor."dogId" = cases.dog_id
            AND survivor."raceId" = cases.race_id
            AND survivor.id <> retired.id
          WHERE retired."raceId" IS NULL
            AND (retired."trackId" IS NULL OR retired."trackId" IS NOT DISTINCT FROM survivor."trackId")
            AND retired.date IS NOT DISTINCT FROM survivor.date
            AND (retired."boxNumber" IS NULL OR retired."boxNumber" IS NOT DISTINCT FROM survivor."boxNumber")
            AND (retired.finish IS NULL OR retired.finish IS NOT DISTINCT FROM survivor.finish)
            AND (retired.distance IS NULL OR retired.distance IS NOT DISTINCT FROM survivor.distance)
            AND (retired.grade IS NULL OR retired.grade IS NOT DISTINCT FROM survivor.grade)
            AND (
              retired.time IS NULL
              OR survivor.time IS NULL
              OR abs(retired.time - survivor.time) <= 0.005
            )
            AND (
              retired.weight IS NULL
              OR survivor.weight IS NULL
              OR abs(retired.weight - survivor.weight) <= 0.05
            )
        )
        UPDATE "FormEntry" survivor
        SET
          time = COALESCE(survivor.time, compatible.retired_time),
          weight = COALESCE(survivor.weight, compatible.retired_weight)
        FROM compatible
        WHERE survivor.id = compatible.survivor_id
          AND (
            (survivor.time IS NULL AND compatible.retired_time IS NOT NULL)
            OR (survivor.weight IS NULL AND compatible.retired_weight IS NOT NULL)
          )
      `);

      const formEntryMergeLedgers = await tx.$executeRaw(Prisma.sql`
        WITH cases AS (
          SELECT
            s.provider,
            s."sourceId",
            s."evidenceSha256",
            evidence.payload->>'formEntryId' AS form_entry_id,
            evidence.payload->>'dogId' AS dog_id,
            evidence.payload->>'raceId' AS race_id
          FROM "LiveFeedQuarantineSummary" s
          JOIN LATERAL (
            SELECT q."evidenceJson"::jsonb AS payload
            FROM "LiveFeedQuarantine" q
            WHERE q."evidenceSha256" = s."evidenceSha256"
            ORDER BY q."observedAt" DESC
            LIMIT 1
          ) evidence ON true
          WHERE s."reviewStatus" = 'pending'
            AND s."reasonCode" = 'form_entry_runner_missing_after_live_sync'
            AND s."lastSeenAt" <= ${options.cutoff}
        ),
        compatible AS (
          SELECT
            cases.*,
            retired.id AS retired_id,
            survivor.id AS survivor_id,
            encode(digest(to_jsonb(retired)::text, 'sha256'), 'hex') AS before_sha256,
            encode(digest(to_jsonb(survivor)::text, 'sha256'), 'hex') AS after_sha256
          FROM cases
          JOIN "FormEntry" retired ON retired.id = cases.form_entry_id
          JOIN "FormEntry" survivor
            ON survivor."dogId" = cases.dog_id
            AND survivor."raceId" = cases.race_id
            AND survivor.id <> retired.id
          WHERE retired."raceId" IS NULL
            AND (retired."trackId" IS NULL OR retired."trackId" IS NOT DISTINCT FROM survivor."trackId")
            AND retired.date IS NOT DISTINCT FROM survivor.date
            AND (retired."boxNumber" IS NULL OR retired."boxNumber" IS NOT DISTINCT FROM survivor."boxNumber")
            AND (retired.finish IS NULL OR retired.finish IS NOT DISTINCT FROM survivor.finish)
            AND (retired.distance IS NULL OR retired.distance IS NOT DISTINCT FROM survivor.distance)
            AND (retired.grade IS NULL OR retired.grade IS NOT DISTINCT FROM survivor.grade)
            AND (
              retired.time IS NULL
              OR survivor.time IS NULL
              OR abs(retired.time - survivor.time) <= 0.005
            )
            AND (
              retired.weight IS NULL
              OR survivor.weight IS NULL
              OR abs(retired.weight - survivor.weight) <= 0.05
            )
        )
        INSERT INTO "CanonicalEntityMerge" (
          "id",
          "entityKind",
          "survivingEntityId",
          "retiredEntityId",
          "sourceProvider",
          "sourceId",
          "reasonCode",
          "evidenceSha256",
          "beforeSha256",
          "afterSha256",
          "createdAt"
        )
        SELECT
          gen_random_uuid()::text,
          'form_entry',
          compatible.survivor_id,
          compatible.retired_id,
          compatible.provider,
          compatible."sourceId",
          'form_entry_runner_duplicate_after_live_sync',
          compatible."evidenceSha256",
          compatible.before_sha256,
          compatible.after_sha256,
          CURRENT_TIMESTAMP
        FROM compatible
        ON CONFLICT ("entityKind", "retiredEntityId") DO NOTHING
      `);

      const formEntriesRetired = await tx.$executeRaw`
        DELETE FROM "FormEntry" form_entry
        USING "CanonicalEntityMerge" merge
        WHERE merge."entityKind" = 'form_entry'
          AND merge."reasonCode" = 'form_entry_runner_duplicate_after_live_sync'
          AND merge."retiredEntityId" = form_entry.id
      `;

      const resolved = await tx.$executeRaw(Prisma.sql`
        WITH evidence AS (
          SELECT
            s.*,
            raw.payload
          FROM "LiveFeedQuarantineSummary" s
          JOIN LATERAL (
            SELECT q."evidenceJson"::jsonb AS payload
            FROM "LiveFeedQuarantine" q
            WHERE q."evidenceSha256" = s."evidenceSha256"
            ORDER BY q."observedAt" DESC
            LIMIT 1
          ) raw ON true
          WHERE s."reviewStatus" = 'pending'
            AND s."lastSeenAt" <= ${options.cutoff}
        ),
        matches AS (
          SELECT
            evidence.*,
            merge."survivingEntityId" AS merged_entity_id,
            CASE lower(evidence."entityKind")
              WHEN 'dog' THEN (
                SELECT i."dogId"
                FROM "DogProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'greyhound' THEN (
                SELECT i."dogId"
                FROM "DogProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'trainer' THEN (
                SELECT i."trainerId"
                FROM "TrainerProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'track' THEN (
                SELECT i."trackId"
                FROM "TrackProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'meeting' THEN (
                SELECT i."meetingId"
                FROM "MeetingProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'race' THEN (
                SELECT i."raceId"
                FROM "RaceProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'owner' THEN (
                SELECT i."ownerId"
                FROM "OwnerProviderIdentity" i
                WHERE i."sourceProvider" = lower(evidence.provider)
                  AND i."sourceId" = evidence."sourceId"
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'runner' THEN (
                SELECT i."dogId"
                FROM "DogProviderIdentity" i
                WHERE evidence."reasonCode" = 'missing_canonical_dog_identity'
                  AND i."sourceProvider" = lower(COALESCE(
                    evidence.payload->>'dogSourceProvider',
                    evidence.provider
                  ))
                  AND i."sourceId" = evidence.payload->>'dogSourceId'
                  AND i."verificationStatus" = 'verified'
              )
              WHEN 'form_entry' THEN COALESCE(
                merge."survivingEntityId",
                (
                  SELECT form_entry.id
                  FROM "FormEntry" form_entry
                  WHERE form_entry.id = evidence.payload->>'formEntryId'
                    AND form_entry."dogId" = evidence.payload->>'dogId'
                    AND form_entry."raceId" = evidence.payload->>'raceId'
                )
              )
              ELSE NULL
            END AS canonical_id,
            CASE lower(evidence."entityKind")
              WHEN 'runner' THEN 'dog'
              ELSE lower(evidence."entityKind")
            END AS canonical_kind
          FROM evidence
          LEFT JOIN "CanonicalEntityMerge" merge
            ON merge."entityKind" = 'form_entry'
            AND merge."retiredEntityId" = evidence.payload->>'formEntryId'
        ),
        classified AS (
          SELECT
            m.*,
            CASE
              WHEN m.merged_entity_id IS NOT NULL THEN 'duplicate'
              WHEN m.canonical_id IS NOT NULL THEN 'linked'
              WHEN lower(m."reasonCode") LIKE '%preferred_source_discarded%'
                THEN 'superseded'
              WHEN lower(m."reasonCode") LIKE '%duplicate%'
                THEN 'duplicate'
              WHEN lower(m.classification) = 'invalid'
                OR lower(m."reasonCode") LIKE '%invalid%'
                THEN 'invalid'
              WHEN m."sourceId" IS NULL THEN 'not_linkable'
              WHEN ${options.terminalClassifyUnresolved}
                AND m."reasonCode" IN (
                  'conflicting_provider_identity',
                  'missing_canonical_dog_identity',
                  'possible_existing_candidate',
                  'provider_not_approved_for_creation'
                )
                THEN 'not_linkable'
              ELSE NULL
            END AS outcome
          FROM matches m
        ),
        eligible AS (
          SELECT
            c.*,
            CASE c.outcome
              WHEN 'linked' THEN CASE
                WHEN lower(c."entityKind") = 'form_entry'
                  THEN 'Exact preserved evidence linked the form entry to its canonical race.'
                WHEN lower(c."entityKind") = 'runner'
                  THEN 'Exact verified provider dog identity linked the runner evidence.'
                ELSE 'Exact verified provider identity linked.'
              END
              WHEN 'superseded' THEN 'Preferred authoritative source intentionally superseded this observation.'
              WHEN 'duplicate' THEN CASE
                WHEN c.merged_entity_id IS NOT NULL
                  THEN 'Confirmed duplicate form entry merged into the canonical race-linked entry; raw evidence remains archived.'
                ELSE 'Duplicate evidence retained once in the aggregated case ledger.'
              END
              WHEN 'invalid' THEN 'Provider evidence explicitly classified this observation as invalid.'
              WHEN 'not_linkable' THEN CASE c."reasonCode"
                WHEN 'conflicting_provider_identity'
                  THEN 'The provider identifier maps to competing canonical records; no authoritative evidence safely selects or merges one.'
                WHEN 'missing_canonical_dog_identity'
                  THEN 'The preserved provider dog identifier has no verified canonical mapping after the full exact-identity scan.'
                WHEN 'possible_existing_candidate'
                  THEN 'Only name-based candidate records exist; name-only linking is prohibited.'
                WHEN 'provider_not_approved_for_creation'
                  THEN 'The preserved evidence does not authorize creation of a canonical record for this provider observation.'
                ELSE 'No stable authoritative provider identifier exists in the preserved evidence.'
              END
            END AS resolution_reason
          FROM classified c
          WHERE c.outcome IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM "LiveFeedQuarantineResolution" r
              WHERE r."summaryId" = c.id
            )
        )
        INSERT INTO "LiveFeedQuarantineResolution" (
          "id",
          "summaryId",
          "outcome",
          "resolutionReason",
          "resolvedEntityKind",
          "resolvedEntityId",
          "beforeSha256",
          "afterSha256",
          "evidenceSha256",
          "actorOrJob",
          "affectedIdsJson",
          "createdAt"
        )
        SELECT
          gen_random_uuid()::text,
          e.id,
          e.outcome,
          e.resolution_reason,
          CASE WHEN e.canonical_id IS NULL THEN NULL ELSE e.canonical_kind END,
          e.canonical_id,
          encode(digest(concat_ws(
            '|',
            e.provider,
            e."entityKind",
            e."sourceKey",
            e."reasonCode",
            e."evidenceSha256",
            e."occurrenceCount"::text
          ), 'sha256'), 'hex'),
          encode(digest(concat_ws(
            '|',
            e.outcome,
            COALESCE(e.canonical_id, ''),
            e.resolution_reason
          ), 'sha256'), 'hex'),
          e."evidenceSha256",
          ${ACTOR_JOB},
          CASE
            WHEN e.canonical_id IS NULL THEN '[]'
            ELSE jsonb_build_array(e.canonical_id)::text
          END,
          CURRENT_TIMESTAMP
        FROM eligible e
      `);

      const summariesUpdated = await tx.$executeRaw`
        UPDATE "LiveFeedQuarantineSummary" s
        SET
          "reviewStatus" = 'resolved',
          "resolvedEntityId" = r."resolvedEntityId",
          "resolutionReason" = r."resolutionReason",
          "reviewedAt" = r."createdAt",
          "updatedAt" = CURRENT_TIMESTAMP
        FROM (
          SELECT DISTINCT ON ("summaryId")
            "summaryId",
            "resolvedEntityId",
            "resolutionReason",
            "createdAt"
          FROM "LiveFeedQuarantineResolution"
          ORDER BY "summaryId", "createdAt" DESC
        ) r
        WHERE r."summaryId" = s.id
          AND s."reviewStatus" = 'pending'
      `;

      return {
        aggregated,
        formEntriesLinked,
        formEntrySurvivorsEnriched,
        formEntryMergeLedgers,
        formEntriesRetired,
        resolved,
        summariesUpdated,
      };
    },
    { maxWait: 10_000, timeout: 1_000_000 },
  );

  console.log(
    JSON.stringify(
      { ...result, ...(await inspect(options.cutoff)) },
      bigintReplacer,
      2,
    ),
  );
}

async function inspect(cutoff: Date) {
  const [raw] = await prisma.$queryRaw<
    Array<{ events: bigint; evidenceHashes: bigint }>
  >`
    SELECT
      COUNT(*)::bigint AS events,
      COUNT(DISTINCT "evidenceSha256")::bigint AS "evidenceHashes"
    FROM "LiveFeedQuarantine"
    WHERE "observedAt" <= ${cutoff}
  `;
  const [cases] = await prisma.$queryRaw<
    Array<{ pending: bigint; resolved: bigint; total: bigint }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE "reviewStatus" = 'pending')::bigint AS pending,
      COUNT(*) FILTER (WHERE "reviewStatus" = 'resolved')::bigint AS resolved,
      COUNT(*)::bigint AS total
    FROM "LiveFeedQuarantineSummary"
    WHERE "lastSeenAt" <= ${cutoff}
  `;
  return { mode: "inspect", cutoff: cutoff.toISOString(), raw, cases };
}

function parseOptions(argv: string[]): Options {
  const apply = argv.includes("--apply");
  const confirmation = argv
    .find((value) => value.startsWith("--confirm="))
    ?.slice("--confirm=".length);
  const cutoffValue = argv
    .find((value) => value.startsWith("--cutoff="))
    ?.slice("--cutoff=".length);
  const terminalClassifyUnresolved = argv.includes(
    "--terminal-classify-unresolved",
  );
  const cutoff = cutoffValue ? new Date(cutoffValue) : new Date();
  if (Number.isNaN(cutoff.getTime())) throw new Error("Invalid --cutoff timestamp.");
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm=${APPLY_CONFIRMATION}.`);
  }
  return { apply, cutoff, terminalClassifyUnresolved };
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

const isMain =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
