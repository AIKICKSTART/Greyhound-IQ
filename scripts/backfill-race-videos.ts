/**
 * Audit and backfill public race replay rows across supported states.
 *
 * Examples:
 *   npm run audit:race-videos -- --from 2026-07-01 --to 2026-07-05 --compact
 *   npm run backfill:race-videos -- --from 2026-07-01 --to 2026-07-05 --state QLD,TAS,WA --dry-run
 */
import "./load-import-env";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/db";
import {
  parseGreyhoundsWaVimeoVideos,
  parseSaRaceReplayVideoIds,
  parseTheDogsReplayCards,
  normaliseLegacyRaceReplaySource,
  resolveRaceVideoReplay,
  resolveRacingQueenslandReplay,
  streamContentType,
  tasracingStreamUrl,
} from "../src/lib/live/race-replay";
import { absoluteTheDogsUrl } from "../src/lib/live/thedogs-replay";
import { readBoundedTextResponse } from "../src/lib/remote-response";

const DEFAULT_KIND = "replay";
const THEDOGS_REPLAYS_URL =
  process.env.THEDOGS_REPLAYS_URL ?? "https://www.thedogs.com.au/videos/replays";
const RACING_QUEENSLAND_BASE =
  process.env.RACING_QUEENSLAND_BASE_URL ??
  "https://www.racingqueensland.com.au";
const TASRACING_EVENT_API =
  process.env.TASRACING_EVENT_REPLAY_API ??
  "https://test.tasracing.com.au/wp-json/event_replay/list";
const TASRACING_RACE_API =
  process.env.TASRACING_RACE_REPLAY_API ??
  "https://test.tasracing.com.au/wp-json/race_replay/list";
const GREYHOUNDS_WA_SHOWCASE_BASE =
  process.env.GREYHOUNDS_WA_SHOWCASE_BASE ?? "https://vimeo.com/showcase";
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LEGACY_NORMALIZATION_BATCH_SIZE = 1_000;
const EXPECTED_CANDIDATE_DATABASE = "giq_production_candidate_20260716_r1";
const EXPECTED_PRODUCTION_SOURCE = "giq_rehearsal_restore_v8";
const EXPECTED_HISTORY_SOURCE = "giq_full_history_rehearsal_20260716_r2";
const EXPECTED_HISTORY_CUTOFF = "2026-07-01T02:49:36.504Z";
const EXPECTED_ALLOYDB_HOST = "10.240.116.2";
const EXPECTED_ALLOYDB_PORT = 5432;
const EXPECTED_DATABASE_USER = "postgres";
const EXPECTED_REPLAY_ARTIFACT_ROWS = 538_849;
const EXPECTED_RACE_REPLAY_ROWS = 289_718;
const EXPECTED_MEETING_PREVIEW_ROWS = 900;
const EXPECTED_LIVE_MEETING_ROWS = 117;
const EXPECTED_RACE_PREVIEW_ROWS = 36;
const EXPECTED_PROVIDER_COLLISION_ROWS = 22;
const EXPECTED_PROVIDER_COLLISION_IDS = [
  "1049479",
  "1061579",
  "1068695",
  "1069289",
  "1069295",
  "1090391",
  "1090576",
  "1105870",
  "1185271",
  "916604",
  "932547",
] as const;
const SUPPORTED_JURISDICTIONS = ["NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const PROVIDER_RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
const PUBLIC_PROVIDERS = [
  "thedogs",
  "racing-queensland",
  "tasracing",
  "greyhoundswa",
  "sa-race-replay",
  "watchdog",
  "youtube",
  "vimeo",
];

type Options = {
  from: string;
  to: string;
  states: string[];
  providers: string[];
  limit: number;
  full: boolean;
  auditOnly: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
  compact: boolean;
  normalizeOnly: boolean;
};

type RaceRow = {
  id: string;
  raceTime: Date;
  meetingDate: Date;
  raceNumber: number;
  name: string | null;
  trackName: string;
  state: string;
};

type RaceVideoRow = RaceRow & {
  sourceProvider: string;
  sourceId: string;
  kind: string;
  pageUrl: string;
  embedSourceType: string | null;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
};

type LegacyReplayRaceRow = RaceRow & {
  raceSourceProvider: string | null;
  raceSourceId: string | null;
  replayUrl: string;
};

type RaceVideoWrite = {
  raceId: string;
  sourceProvider: string;
  sourceId: string;
  kind?: string;
  pageUrl: string;
  embedSourceType: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceRawJson: string | null;
};

type BackfillSummary = {
  provider: string;
  selected: number;
  resolved: number;
  written: number;
  wouldWrite: number;
  skipped: number;
  quarantined: number;
  quarantineRowsWritten: number;
  errors: number;
  notes: string[];
};

type TasEvent = {
  title?: string;
  category?: string;
  venue?: string;
  meeting_code?: string;
  meeting_date_format?: string;
  trial?: boolean;
};

type TasRace = {
  race_name?: string;
  race_number?: number;
  race_code?: string;
  angles?: Record<string, TasAngle> | TasAngle[];
};

type TasAngle = {
  name?: string;
  stream?: string;
  angle?: string;
  login?: boolean;
};

type CandidateIdentity = {
  database: string;
  host: string | null;
  port: number | null;
  user: string;
  ssl: boolean;
  markerPresent: boolean;
  quarantinePresent: boolean;
  replayTaxonomyPresent: boolean;
  snapshotProofPresent: boolean;
};

type CandidateMergeMarker = {
  id: number;
  sourceProductionDatabase: string;
  sourceHistoryDatabase: string;
  sourceHistoryCutoff: Date;
  normalizedAt: Date | null;
  replayNormalizationVerifiedAt: Date | null;
  replayArtifactRows: bigint | null;
  canonicalMergedAt: Date | null;
  liveDeltaAppliedAt: Date | null;
  verifiedAt: Date | null;
};

type HistoricalReplayTaxonomy = {
  artifactRows: bigint;
  raceReplayRows: bigint;
  meetingPreviewRows: bigint;
  liveMeetingRows: bigint;
  racePreviewRows: bigint;
  providerCollisionRows: bigint;
  providerCollisionIds: bigint;
  eligibleRows: bigint;
  normalizedRows: bigint;
  invalidEligibleRows: bigint;
  unresolvedNotQuarantinedRows: bigint;
  sharedOrPreviewNotQuarantinedRows: bigint;
  collisionNotQuarantinedRows: bigint;
  multipleRaceReplayNotQuarantinedRows: bigint;
  invalidNormalizedRows: bigint;
  missingQuarantineLedgerRows: bigint;
};

type SnapshotRaceVideoProof = {
  snapshotRows: bigint;
  missingRows: bigint;
};

type ReplayQuarantineRow = {
  id: string;
  raceTime: Date;
  replayUrl: string;
  state: string | null;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await assertCandidateReplayTarget();
  await assertHistoricalReplayTaxonomy();
  await assertSnapshotRaceVideosPresent();
  const auditBefore = await auditRaceVideos(options);

  if (options.auditOnly) {
    console.log(json(auditBefore, options.compact));
    return;
  }

  const backfill: BackfillSummary[] = [
    await quarantineUnsupportedJurisdictionReplays(options),
    await normaliseLegacyRaceReplayUrls(options),
  ];
  if (options.normalizeOnly) {
    const auditAfter = await auditRaceVideos(options);
    await assertSnapshotRaceVideosPresent();
    console.log(
      json(
        {
          generatedAt: new Date().toISOString(),
          dryRun: options.dryRun,
          normalizeOnly: true,
          rangeFrom: options.from,
          rangeTo: options.to,
          states: options.states.length ? options.states : "all",
          providers: options.providers.length ? options.providers : PUBLIC_PROVIDERS,
          auditBefore,
          backfill,
          auditAfter,
        },
        options.compact
      )
    );
    return;
  }
  if (providerEnabled(options, "thedogs")) {
    backfill.push(await backfillTheDogs(options));
  }
  if (providerEnabled(options, "racing-queensland") && stateEnabled(options, "QLD")) {
    backfill.push(await backfillRacingQueensland(options));
  }
  if (providerEnabled(options, "tasracing") && stateEnabled(options, "TAS")) {
    backfill.push(await backfillTasracing(options));
  }
  if (providerEnabled(options, "greyhoundswa") && stateEnabled(options, "WA")) {
    backfill.push(await backfillGreyhoundsWa(options));
  }
  if (providerEnabled(options, "sa-race-replay") && stateEnabled(options, "SA")) {
    backfill.push(await backfillSaRaceReplayYoutube(options));
  }

  const auditAfter = await auditRaceVideos(options);
  await assertSnapshotRaceVideosPresent();
  console.log(
    json(
      {
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        rangeFrom: options.from,
        rangeTo: options.to,
        states: options.states.length ? options.states : "all",
        providers: options.providers.length ? options.providers : PUBLIC_PROVIDERS,
        auditBefore,
        backfill,
        auditAfter,
      },
      options.compact
    )
  );
}

async function assertCandidateReplayTarget() {
  const [identity] = await prisma.$queryRaw<CandidateIdentity[]>`
    SELECT
      current_database()::text AS "database",
      inet_server_addr()::text AS "host",
      inet_server_port()::int AS "port",
      current_user::text AS "user",
      COALESCE(
        (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
        FALSE
      ) AS "ssl",
      (to_regclass('_giq_history_merge.run') IS NOT NULL) AS "markerPresent",
      (to_regclass('_giq_history_merge.quarantine') IS NOT NULL) AS "quarantinePresent",
      (to_regclass('_giq_history_stage.media_resolution') IS NOT NULL) AS "replayTaxonomyPresent",
      (to_regclass('_giq_history_merge.snapshot_race_video_proof') IS NOT NULL) AS "snapshotProofPresent"
  `;
  if (
    !identity ||
    identity.database !== EXPECTED_CANDIDATE_DATABASE ||
    identity.host !== EXPECTED_ALLOYDB_HOST ||
    identity.port !== EXPECTED_ALLOYDB_PORT ||
    identity.user !== EXPECTED_DATABASE_USER ||
    !identity.ssl ||
    !identity.markerPresent ||
    !identity.quarantinePresent ||
    !identity.replayTaxonomyPresent ||
    !identity.snapshotProofPresent
  ) {
    throw new Error("race_videos.candidate_identity_mismatch");
  }

  const markers = await prisma.$queryRaw<CandidateMergeMarker[]>`
    SELECT
      id,
      source_production_database AS "sourceProductionDatabase",
      source_history_database AS "sourceHistoryDatabase",
      source_history_cutoff AS "sourceHistoryCutoff",
      normalized_at AS "normalizedAt",
      replay_normalization_verified_at AS "replayNormalizationVerifiedAt",
      replay_artifact_rows AS "replayArtifactRows",
      canonical_merged_at AS "canonicalMergedAt",
      live_delta_applied_at AS "liveDeltaAppliedAt",
      verified_at AS "verifiedAt"
    FROM _giq_history_merge.run
    WHERE id = 1
  `;
  const marker = markers.length === 1 ? markers[0] : null;
  if (
    !marker ||
    marker.sourceProductionDatabase !== EXPECTED_PRODUCTION_SOURCE ||
    marker.sourceHistoryDatabase !== EXPECTED_HISTORY_SOURCE ||
    marker.sourceHistoryCutoff.toISOString() !== EXPECTED_HISTORY_CUTOFF ||
    marker.normalizedAt === null ||
    marker.replayNormalizationVerifiedAt === null ||
    marker.replayArtifactRows !== BigInt(EXPECTED_REPLAY_ARTIFACT_ROWS) ||
    marker.canonicalMergedAt === null ||
    marker.liveDeltaAppliedAt !== null ||
    marker.verifiedAt !== null
  ) {
    throw new Error("race_videos.candidate_merge_phase_mismatch");
  }
}

async function assertHistoricalReplayTaxonomy() {
  const [taxonomy] = await prisma.$queryRaw<HistoricalReplayTaxonomy[]>`
    WITH duplicate_race_replays AS (
      SELECT race_id
      FROM _giq_history_stage.media_resolution
      WHERE disposition IN ('eligible-race-replay', 'quarantined-multiple-race-replays')
      GROUP BY race_id
      HAVING COUNT(*) > 1
    )
    SELECT
      COUNT(*)::bigint AS "artifactRows",
      COUNT(*) FILTER (WHERE m.media_class = 'race-replay')::bigint AS "raceReplayRows",
      COUNT(*) FILTER (WHERE m.media_class = 'meeting-preview')::bigint AS "meetingPreviewRows",
      COUNT(*) FILTER (WHERE m.media_class = 'live-meeting')::bigint AS "liveMeetingRows",
      COUNT(*) FILTER (WHERE m.media_class = 'race-preview')::bigint AS "racePreviewRows",
      COUNT(*) FILTER (
        WHERE m.provider_media_id IN (${Prisma.join(EXPECTED_PROVIDER_COLLISION_IDS)})
      )::bigint AS "providerCollisionRows",
      COUNT(DISTINCT m.provider_media_id) FILTER (
        WHERE m.provider_media_id IN (${Prisma.join(EXPECTED_PROVIDER_COLLISION_IDS)})
      )::bigint AS "providerCollisionIds",
      COUNT(*) FILTER (WHERE m.disposition = 'eligible-race-replay')::bigint AS "eligibleRows",
      (SELECT COUNT(*)::bigint FROM _giq_history_stage.normalized_race_video) AS "normalizedRows",
      COUNT(*) FILTER (
        WHERE m.disposition = 'eligible-race-replay'
          AND (
            m.race_id IS NULL
            OR m.media_class <> 'race-replay'
            OR m.payload->>'sourceId' !~ '^/videos/watch/races/[0-9]+/replay$'
            OR m.provider_media_id IN (${Prisma.join(EXPECTED_PROVIDER_COLLISION_IDS)})
          )
      )::bigint AS "invalidEligibleRows",
      COUNT(*) FILTER (
        WHERE m.race_id IS NULL
          AND m.disposition <> 'quarantined-race-unresolved'
      )::bigint AS "unresolvedNotQuarantinedRows",
      COUNT(*) FILTER (
        WHERE m.media_class IN ('meeting-preview', 'live-meeting', 'race-preview')
          AND m.disposition <> 'quarantined-shared-or-preview-media'
      )::bigint AS "sharedOrPreviewNotQuarantinedRows",
      COUNT(*) FILTER (
        WHERE m.provider_media_id IN (${Prisma.join(EXPECTED_PROVIDER_COLLISION_IDS)})
          AND m.disposition <> 'quarantined-provider-id-race-conflict'
      )::bigint AS "collisionNotQuarantinedRows",
      COUNT(*) FILTER (
        WHERE d.race_id IS NOT NULL
          AND m.disposition IN (
            'eligible-race-replay',
            'quarantined-multiple-race-replays'
          )
          AND m.disposition <> 'quarantined-multiple-race-replays'
      )::bigint AS "multipleRaceReplayNotQuarantinedRows",
      (
        SELECT COUNT(*)::bigint
        FROM _giq_history_stage.normalized_race_video n
        WHERE NOT EXISTS (
          SELECT 1
          FROM _giq_history_stage.media_resolution source
          WHERE source.race_id = n.race_id
            AND source.provider_media_id = n.source_id
            AND source.disposition = 'eligible-race-replay'
            AND source.payload->>'sourceId' ~ '^/videos/watch/races/[0-9]+/replay$'
        )
      ) AS "invalidNormalizedRows",
      COUNT(*) FILTER (
        WHERE m.disposition LIKE 'quarantined-%'
          AND NOT EXISTS (
            SELECT 1
            FROM _giq_history_merge.quarantine q
            WHERE q.source_name = 'normalized-export'
              AND q.entity_type = 'race-media'
              AND q.source_key = m.source_file || ':' || m.line_number
              AND q.reason_code = m.disposition
              AND q.disposition = m.disposition
              AND q.blocking = FALSE
          )
      )::bigint AS "missingQuarantineLedgerRows"
    FROM _giq_history_stage.media_resolution m
    LEFT JOIN duplicate_race_replays d ON d.race_id = m.race_id
  `;
  if (
    !taxonomy ||
    taxonomy.artifactRows !== BigInt(EXPECTED_REPLAY_ARTIFACT_ROWS) ||
    taxonomy.raceReplayRows !== BigInt(EXPECTED_RACE_REPLAY_ROWS) ||
    taxonomy.meetingPreviewRows !== BigInt(EXPECTED_MEETING_PREVIEW_ROWS) ||
    taxonomy.liveMeetingRows !== BigInt(EXPECTED_LIVE_MEETING_ROWS) ||
    taxonomy.racePreviewRows !== BigInt(EXPECTED_RACE_PREVIEW_ROWS) ||
    taxonomy.providerCollisionRows !== BigInt(EXPECTED_PROVIDER_COLLISION_ROWS) ||
    taxonomy.providerCollisionIds !== BigInt(EXPECTED_PROVIDER_COLLISION_IDS.length) ||
    taxonomy.eligibleRows !== taxonomy.normalizedRows ||
    taxonomy.invalidEligibleRows !== BigInt(0) ||
    taxonomy.unresolvedNotQuarantinedRows !== BigInt(0) ||
    taxonomy.sharedOrPreviewNotQuarantinedRows !== BigInt(0) ||
    taxonomy.collisionNotQuarantinedRows !== BigInt(0) ||
    taxonomy.multipleRaceReplayNotQuarantinedRows !== BigInt(0) ||
    taxonomy.invalidNormalizedRows !== BigInt(0) ||
    taxonomy.missingQuarantineLedgerRows !== BigInt(0)
  ) {
    throw new Error("race_videos.historical_replay_taxonomy_mismatch");
  }
}

async function assertSnapshotRaceVideosPresent() {
  const [proof] = await prisma.$queryRaw<SnapshotRaceVideoProof[]>`
    SELECT
      COUNT(*)::bigint AS "snapshotRows",
      COUNT(*) FILTER (WHERE video."id" IS NULL)::bigint AS "missingRows"
    FROM _giq_history_merge.snapshot_race_video_proof snapshot
    LEFT JOIN public."RaceVideo" video ON video."id" = snapshot.id
  `;
  if (
    !proof ||
    proof.snapshotRows === BigInt(0) ||
    proof.missingRows !== BigInt(0)
  ) {
    throw new Error("race_videos.snapshot_baseline_missing");
  }
}

async function quarantineUnsupportedJurisdictionReplays(
  options: Options
): Promise<BackfillSummary> {
  const summary = newSummary("unsupported-jurisdiction");
  if (options.states.length > 0) return summary;

  let cursor: Pick<ReplayQuarantineRow, "id" | "raceTime"> | null = null;
  while (canSelect(summary, options)) {
    const limit = options.full
      ? LEGACY_NORMALIZATION_BATCH_SIZE
      : Math.min(
          LEGACY_NORMALIZATION_BATCH_SIZE,
          Math.max(options.limit - summary.selected, 0)
        );
    if (limit <= 0) break;
    const cursorSql: Prisma.Sql = cursor
      ? Prisma.sql`AND (r."raceTime", r."id") > (${cursor.raceTime}, ${cursor.id})`
      : Prisma.empty;
    const rows: ReplayQuarantineRow[] = await prisma.$queryRaw<
      ReplayQuarantineRow[]
    >`
      SELECT r."id", r."raceTime", r."replayUrl", t."state"
      FROM "Race" r
      JOIN "Meeting" m ON m."id" = r."meetingId"
      JOIN "Track" t ON t."id" = m."trackId"
      WHERE r."raceTime" >= ${startOfDay(options.from)}
        AND r."raceTime" <= ${endOfDay(options.to)}
        AND r."replayUrl" IS NOT NULL
        AND UPPER(TRIM(COALESCE(t."state", ''))) NOT IN (${Prisma.join(
          SUPPORTED_JURISDICTIONS
        )})
        ${cursorSql}
      ORDER BY r."raceTime", r."id"
      LIMIT ${limit}
    `;
    if (rows.length === 0) break;
    summary.selected += rows.length;
    summary.skipped += rows.length;
    summary.quarantined += rows.length;
    summary.wouldWrite += rows.length;
    summary.quarantineRowsWritten += await writeReplayQuarantines(
      rows.map((row: ReplayQuarantineRow) => ({
        raceId: row.id,
        reasonCode: "unsupported_jurisdiction",
        sourceKey: `${row.state ?? "<null>"}:${row.replayUrl}`,
      })),
      options
    );
    const last: ReplayQuarantineRow | undefined = rows.at(-1);
    if (!last || rows.length < limit) break;
    cursor = { id: last.id, raceTime: last.raceTime };
  }
  return summary;
}

async function normaliseLegacyRaceReplayUrls(
  options: Options
): Promise<BackfillSummary> {
  const summary = newSummary("legacy-race-replay-url");
  let cursor: Pick<LegacyReplayRaceRow, "id" | "raceTime"> | null = null;
  while (canSelect(summary, options)) {
    const rows = await queryLegacyReplayRows(options, cursor);
    if (rows.length === 0) break;
    for (const race of rows) {
      if (!canSelect(summary, options)) break;
      const source = normaliseLegacyRaceReplaySource({
        sourceProvider: race.raceSourceProvider,
        replayUrl: race.replayUrl,
      });
      if (!source) {
        summary.skipped += 1;
        summary.quarantined += 1;
        summary.quarantineRowsWritten += await writeReplayQuarantines(
          [
            {
              raceId: race.id,
              reasonCode: "legacy_replay_url_unrecognized",
              sourceKey: race.replayUrl,
            },
          ],
          options
        );
        if (summary.notes.length < 8) {
          summary.notes.push(
            `Quarantined unrecognised replay reference for ${race.state} ${formatDate(
              race.meetingDate
            )} ${race.trackName} R${race.raceNumber}`
          );
        }
        continue;
      }
      if (
        options.providers.length > 0 &&
        !options.providers.includes(source.sourceProvider)
      ) {
        continue;
      }

      summary.selected += 1;
      summary.resolved += 1;
      summary.wouldWrite += 1;
      try {
        summary.written += await writeRaceVideo(
          {
            raceId: race.id,
            sourceProvider: source.sourceProvider,
            sourceId: source.sourceId,
            kind: DEFAULT_KIND,
            pageUrl: source.pageUrl,
            embedSourceType: source.embedSourceType,
            sourceStatus: null,
            sourceCode: source.sourceCode,
            streamUrl: source.streamUrl,
            streamContentType: source.streamContentType,
            title: race.name,
            description: null,
            sourceRawJson: JSON.stringify({
              origin: "Race.replayUrl",
              normalizationStatus: "recognized_public_provider_reference",
              raceSourceProvider: race.raceSourceProvider,
              raceSourceId: race.raceSourceId,
            }),
          },
          options,
          "preserve"
        );
      } catch (err) {
        summary.errors += 1;
        if (summary.notes.length < 8) {
          summary.notes.push(
            `${race.state} ${formatDate(race.meetingDate)} ${race.trackName} R${
              race.raceNumber
            } normalization failed: ${errorMessage(err)}`
          );
        }
      }
    }
    const last = rows.at(-1);
    if (!last || rows.length < LEGACY_NORMALIZATION_BATCH_SIZE) break;
    cursor = { id: last.id, raceTime: last.raceTime };
  }
  return summary;
}

async function auditRaceVideos(options: Options) {
  const stateRows = await prisma.$queryRaw<
    Array<{
      state: string | null;
      races: bigint;
      videoRows: bigint;
      streamRows: bigint;
      replayAvailableRows: bigint;
      directPlayableRows: bigint;
      recognizedSourceRows: bigint;
    }>
  >`
    SELECT
      t."state",
      COUNT(DISTINCT r."id")::bigint AS "races",
      COUNT(rv."id")::bigint AS "videoRows",
      COUNT(DISTINCT r."id") FILTER (WHERE rv."streamUrl" IS NOT NULL)::bigint AS "streamRows",
      COUNT(DISTINCT r."id") FILTER (
        WHERE rv."id" IS NOT NULL
      )::bigint AS "replayAvailableRows"
      ,COUNT(DISTINCT r."id") FILTER (
        WHERE rv."streamUrl" IS NOT NULL
          OR rv."embedSourceType" IN ('youtube', 'vimeo')
          OR rv."pageUrl" ~* '^https://(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/'
      )::bigint AS "directPlayableRows"
      ,COUNT(DISTINCT r."id") FILTER (
        WHERE rv."streamUrl" IS NOT NULL
          OR rv."embedSourceType" IN ('youtube', 'vimeo', 'race-replay', 'racing-queensland', 'tasracing-hls')
          OR rv."sourceProvider" IN ('thedogs', 'racing-queensland', 'tasracing', 'greyhoundswa', 'sa-race-replay', 'watchdog', 'youtube', 'vimeo')
      )::bigint AS "recognizedSourceRows"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" rv ON rv."raceId" = r."id"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
    GROUP BY t."state"
    ORDER BY t."state" NULLS LAST
  `;

  const providerRows = await prisma.$queryRaw<
    Array<{
      state: string | null;
      sourceProvider: string | null;
      videoRows: bigint;
      streamRows: bigint;
      replayAvailableRows: bigint;
      directPlayableRows: bigint;
      verifiedSourceRows: bigint;
      providerErrorRows: bigint;
    }>
  >`
    SELECT
      t."state",
      rv."sourceProvider" AS "sourceProvider",
      COUNT(rv."id")::bigint AS "videoRows",
      COUNT(rv."id") FILTER (WHERE rv."streamUrl" IS NOT NULL)::bigint AS "streamRows",
      COUNT(rv."id") FILTER (
        WHERE rv."id" IS NOT NULL
      )::bigint AS "replayAvailableRows",
      COUNT(rv."id") FILTER (
        WHERE rv."streamUrl" IS NOT NULL
          OR rv."embedSourceType" IN ('youtube', 'vimeo')
          OR rv."pageUrl" ~* '^https://(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/'
      )::bigint AS "directPlayableRows",
      COUNT(rv."id") FILTER (
        WHERE rv."sourceStatus" >= 200 AND rv."sourceStatus" < 300
      )::bigint AS "verifiedSourceRows",
      COUNT(rv."id") FILTER (WHERE rv."sourceStatus" >= 400)::bigint AS "providerErrorRows"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" rv ON rv."raceId" = r."id"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
    GROUP BY t."state", rv."sourceProvider"
    ORDER BY t."state" NULLS LAST, rv."sourceProvider" NULLS LAST
  `;

  const sourceDateRows = await prisma.$queryRaw<
    Array<{
      state: string | null;
      meetingDate: string;
      sourceProvider: string | null;
      races: bigint;
      videoRows: bigint;
      directPlayableRows: bigint;
      verifiedSourceRows: bigint;
      providerErrorRows: bigint;
    }>
  >`
    SELECT
      t."state",
      TO_CHAR(m."meetingDate", 'YYYY-MM-DD') AS "meetingDate",
      rv."sourceProvider" AS "sourceProvider",
      COUNT(DISTINCT r."id")::bigint AS "races",
      COUNT(rv."id")::bigint AS "videoRows",
      COUNT(DISTINCT r."id") FILTER (
        WHERE rv."streamUrl" IS NOT NULL
          OR rv."embedSourceType" IN ('youtube', 'vimeo')
          OR rv."pageUrl" ~* '^https://(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/'
      )::bigint AS "directPlayableRows",
      COUNT(rv."id") FILTER (
        WHERE rv."sourceStatus" >= 200 AND rv."sourceStatus" < 300
      )::bigint AS "verifiedSourceRows",
      COUNT(rv."id") FILTER (WHERE rv."sourceStatus" >= 400)::bigint AS "providerErrorRows"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" rv ON rv."raceId" = r."id"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
    GROUP BY t."state", "meetingDate", rv."sourceProvider"
    ORDER BY "meetingDate", t."state" NULLS LAST, rv."sourceProvider" NULLS LAST
  `;

  const unresolvedSamples = await prisma.$queryRaw<
    Array<{
      raceId: string;
      state: string | null;
      meetingDate: string;
      trackName: string;
      raceNumber: number;
      sourceProviders: string[];
      attachmentStatus: string;
    }>
  >`
    SELECT
      r."id" AS "raceId",
      t."state",
      TO_CHAR(m."meetingDate", 'YYYY-MM-DD') AS "meetingDate",
      t."name" AS "trackName",
      r."raceNumber",
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT rv."sourceProvider"), NULL),
        ARRAY[]::text[]
      ) AS "sourceProviders",
      CASE
        WHEN COUNT(rv."id") = 0 THEN 'missing_source_record'
        ELSE 'requires_provider_resolution'
      END AS "attachmentStatus"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    LEFT JOIN "RaceVideo" rv ON rv."raceId" = r."id"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
    GROUP BY r."id", t."state", m."meetingDate", t."name", r."raceNumber"
    HAVING NOT COALESCE(
      BOOL_OR(
        rv."streamUrl" IS NOT NULL
          OR rv."embedSourceType" IN ('youtube', 'vimeo')
          OR rv."pageUrl" ~* '^https://(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/'
      ),
      FALSE
    )
    ORDER BY m."meetingDate" DESC, t."state" NULLS LAST, t."name", r."raceNumber"
    LIMIT 100
  `;

  const jurisdictionRows = await prisma.$queryRaw<
    Array<{ state: string | null; races: bigint; replayUrls: bigint }>
  >`
    SELECT
      NULLIF(UPPER(TRIM(COALESCE(t."state", ''))), '') AS "state",
      COUNT(DISTINCT r."id")::bigint AS "races",
      COUNT(DISTINCT r."id") FILTER (
        WHERE r."replayUrl" IS NOT NULL
      )::bigint AS "replayUrls"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
    GROUP BY "state"
    ORDER BY "state" NULLS LAST
  `;

  const expectedJurisdictions = options.states.length
    ? options.states
    : SUPPORTED_JURISDICTIONS;
  const observedJurisdictions = stateRows.map((row) => row.state?.trim() || "<unknown>");
  const unexpectedJurisdictions = jurisdictionRows.filter(
    (row) => !row.state || !SUPPORTED_JURISDICTIONS.includes(row.state)
  );

  return {
    generatedAt: new Date().toISOString(),
    rangeFrom: options.from,
    rangeTo: options.to,
    perState: stateRows.map((row) => ({
      state: row.state,
      races: Number(row.races),
      videoRows: Number(row.videoRows),
      streamRows: Number(row.streamRows),
      replayAvailableRows: Number(row.replayAvailableRows),
      directPlayableRows: Number(row.directPlayableRows),
      recognizedSourceRows: Number(row.recognizedSourceRows),
      missingSourceRows: Number(row.races) - Number(row.replayAvailableRows),
      requiresProviderResolutionRows:
        Number(row.recognizedSourceRows) - Number(row.directPlayableRows),
      replayAvailabilityRate: ratio(
        Number(row.replayAvailableRows),
        Number(row.races)
      ),
      streamRate: ratio(Number(row.streamRows), Number(row.races)),
    })),
    perProvider: providerRows
      .filter((row) => row.sourceProvider)
      .map((row) => ({
        state: row.state,
        sourceProvider: row.sourceProvider,
        videoRows: Number(row.videoRows),
        streamRows: Number(row.streamRows),
        replayAvailableRows: Number(row.replayAvailableRows),
        directPlayableRows: Number(row.directPlayableRows),
        verifiedSourceRows: Number(row.verifiedSourceRows),
        providerErrorRows: Number(row.providerErrorRows),
      })),
    perSourceDate: sourceDateRows.map((row) => ({
      state: row.state?.trim() || "<unknown>",
      meetingDate: row.meetingDate,
      sourceProvider: row.sourceProvider ?? "<unattached>",
      races: Number(row.races),
      videoRows: Number(row.videoRows),
      directPlayableRows: Number(row.directPlayableRows),
      verifiedSourceRows: Number(row.verifiedSourceRows),
      providerErrorRows: Number(row.providerErrorRows),
    })),
    jurisdictionIntegrity: {
      expected: expectedJurisdictions,
      observed: observedJurisdictions,
      missingExpected: expectedJurisdictions.filter(
        (state) => !observedJurisdictions.includes(state)
      ),
      unexpected: unexpectedJurisdictions.map((row) => ({
        state: row.state ?? "<unknown>",
        races: Number(row.races),
        replayUrls: Number(row.replayUrls),
        disposition: "quarantine",
      })),
    },
    unresolvedSampleLimit: 100,
    unresolvedSamples,
  };
}

async function backfillTheDogs(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("thedogs");
  const remaining = () =>
    options.full ? Number.POSITIVE_INFINITY : Math.max(options.limit - summary.selected, 0);

  const existingRows = await queryTheDogsExistingRows(options, remaining());
  for (const row of existingRows) {
    if (!canSelect(summary, options)) break;
    summary.selected += 1;
    try {
      const replay = await resolveRaceVideoReplay(row);
      if (!replay?.streamUrl) {
        summary.skipped += 1;
        continue;
      }
      summary.resolved += 1;
      summary.wouldWrite += 1;
      summary.written += await writeRaceVideo(
        {
          raceId: row.id,
          sourceProvider: row.sourceProvider,
          sourceId: row.sourceId,
          kind: row.kind,
          pageUrl: replay.pageUrl,
          embedSourceType: row.embedSourceType ?? "race-replay",
          sourceStatus: replay.sourceStatus,
          sourceCode: replay.sourceCode,
          streamUrl: replay.streamUrl,
          streamContentType: replay.streamContentType,
          title: replay.title ?? row.title,
          description: replay.description ?? row.description,
          sourceRawJson: null,
        },
        options
      );
    } catch {
      summary.errors += 1;
    }
  }

  if (remaining() > 0) {
    await backfillTheDogsReplayPages(options, summary);
  }

  return summary;
}

async function backfillTheDogsReplayPages(
  options: Options,
  summary: BackfillSummary
) {
  for (const date of eachDate(options.from, options.to)) {
    if (!canSelect(summary, options)) break;
    const races = await queryRacesByMeetingDate(date, options, {
      sourceProvider: "thedogs",
      onlyWithoutProvider: options.onlyMissing ? "thedogs" : null,
    });
    const racesByKey = new Map(
      races.map((race) => [raceKey(race.trackName, race.raceNumber), race])
    );
    if (racesByKey.size === 0) continue;

    const url = new URL(THEDOGS_REPLAYS_URL);
    url.searchParams.set("date", date);
    let html: string;
    try {
      html = await fetchText(url.toString());
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`The Dogs ${date} replay page failed: ${errorMessage(err)}`);
      }
      continue;
    }
    const cardsByRace = new Map<
      string,
      ReturnType<typeof parseTheDogsReplayCards>
    >();
    for (const card of parseTheDogsReplayCards(html)) {
      const key = raceKey(card.trackName, card.raceNumber);
      const cards = cardsByRace.get(key) ?? [];
      cards.push(card);
      cardsByRace.set(key, cards);
    }
    for (const [key, cards] of cardsByRace) {
      if (!canSelect(summary, options)) break;
      const race = racesByKey.get(key);
      if (!race) continue;
      summary.selected += 1;

      const sourceIds = new Set(cards.map((card) => card.videoSourceId));
      if (sourceIds.size !== 1) {
        summary.skipped += 1;
        summary.quarantined += 1;
        summary.quarantineRowsWritten += await writeReplayQuarantines(
          [
            {
              raceId: race.id,
              reasonCode: "thedogs_replay_match_ambiguous",
              sourceKey: [...sourceIds].sort().join(":"),
            },
          ],
          options
        );
        continue;
      }
      const card = cards[0];

      try {
        const pageUrl = absoluteTheDogsUrl(card.pageUrl);
        const replay = await resolveRaceVideoReplay({
          sourceProvider: "thedogs",
          sourceId: card.videoSourceId,
          pageUrl,
          embedSourceType: "race-replay",
          title: card.title,
        });
        if (replay?.streamUrl) summary.resolved += 1;
        summary.wouldWrite += 1;
        summary.written += await writeRaceVideo(
          {
            raceId: race.id,
            sourceProvider: "thedogs",
            sourceId: card.videoSourceId,
            kind: DEFAULT_KIND,
            pageUrl,
            embedSourceType: "race-replay",
            sourceStatus: replay?.sourceStatus ?? 200,
            sourceCode: replay?.sourceCode ?? "thedogs-replay-card",
            streamUrl: replay?.streamUrl ?? null,
            streamContentType: replay?.streamContentType ?? null,
            title: replay?.title ?? card.title,
            description: replay?.description ?? race.name,
            sourceRawJson: JSON.stringify(card),
          },
          options
        );
      } catch {
        summary.errors += 1;
      }
    }
  }
}

async function backfillRacingQueensland(
  options: Options
): Promise<BackfillSummary> {
  const summary = newSummary("racing-queensland");
  const races = await queryRacesForState(options, "QLD", "racing-queensland");
  for (const race of races) {
    if (!canSelect(summary, options)) break;
    const trackCode = racingQueenslandTrackCode(race.trackName);
    if (!trackCode) {
      summary.skipped += 1;
      summary.quarantined += 1;
      summary.quarantineRowsWritten += await writeReplayQuarantines(
        [
          {
            raceId: race.id,
            reasonCode: "racing_queensland_track_mapping_missing",
            sourceKey: race.trackName,
          },
        ],
        options
      );
      if (summary.notes.length < 8) {
        summary.notes.push(`No Racing Queensland code for ${race.trackName}`);
      }
      continue;
    }

    summary.selected += 1;
    const dateKey = compactDate(formatDate(race.meetingDate));
    const encodedCode = encodeURIComponent(trackCode);
    const pageUrl = `${RACING_QUEENSLAND_BASE}/racing/replays/tab-race-replays/race-player/greyhound/${encodedCode}/${dateKey}/race/${race.raceNumber}`;

    try {
      const replay = await resolveRacingQueenslandReplay(pageUrl, {
        sourceProvider: "racing-queensland",
        sourceId: `${trackCode}:${dateKey}:${race.raceNumber}`,
        title: race.name,
      });
      if (
        !replay?.streamUrl ||
        (replay.sourceStatus != null && replay.sourceStatus >= 400)
      ) {
        summary.skipped += 1;
        summary.quarantined += 1;
        summary.quarantineRowsWritten += await writeReplayQuarantines(
          [
            {
              raceId: race.id,
              reasonCode: "racing_queensland_replay_unresolved",
              sourceKey: pageUrl,
            },
          ],
          options
        );
        continue;
      }
      summary.resolved += 1;

      summary.wouldWrite += 1;
      summary.written += await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "racing-queensland",
          sourceId: `${trackCode}:${dateKey}:${race.raceNumber}`,
          kind: DEFAULT_KIND,
          pageUrl,
          embedSourceType: "racing-queensland",
          sourceStatus: replay.sourceStatus,
          sourceCode: replay.sourceCode,
          streamUrl: null,
          streamContentType: null,
          title: replay.title ?? race.name,
          description: race.name,
          sourceRawJson: JSON.stringify({
            pageUrl,
            resolvedStreamAtBackfill: Boolean(replay.streamUrl),
          }),
        },
        options
      );
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}

async function backfillTasracing(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("tasracing");
  const races = await queryRacesForState(options, "TAS", "tasracing");
  const racesByKey = new Map(
    races.map((race) => [
      `${formatDate(race.meetingDate)}:${normaliseName(race.trackName)}:${race.raceNumber}`,
      race,
    ])
  );

  const events = await fetchTasracingEvents(options);
  for (const event of events) {
    if (!canSelect(summary, options)) break;
    if (!event.meeting_code || !event.meeting_date_format || !event.venue) continue;
    const replay = await fetchJson<{ races?: TasRace[] }>(
      `${TASRACING_RACE_API}?search=${encodeURIComponent(event.meeting_code)}`
    );
    for (const raceReplay of replay.races ?? []) {
      if (!canSelect(summary, options)) break;
      const raceNumber = Number(raceReplay.race_number);
      const race = racesByKey.get(
        `${event.meeting_date_format}:${normaliseName(event.venue)}:${raceNumber}`
      );
      if (!race) continue;
      const angle = publicTasracingAngle(raceReplay);
      if (!angle?.stream) {
        summary.skipped += 1;
        continue;
      }
      const streamUrl = tasracingStreamUrl(angle.stream);
      if (!streamUrl) {
        summary.skipped += 1;
        continue;
      }

      summary.selected += 1;
      summary.resolved += 1;
      summary.wouldWrite += 1;
      summary.written += await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "tasracing",
          sourceId: angle.stream,
          kind: DEFAULT_KIND,
          pageUrl: `https://form.tasracing.com.au/replays/${event.meeting_code}?race=${raceNumber}`,
          embedSourceType: "tasracing-hls",
          sourceStatus: 200,
          sourceCode: "tasracing-public-angle",
          streamUrl,
          streamContentType: streamContentType(streamUrl),
          title: angle.name ?? raceReplay.race_name ?? race.name,
          description: race.name,
          sourceRawJson: JSON.stringify({ event, raceReplay, angle }),
        },
        options
      );
    }
  }
  return summary;
}

async function backfillGreyhoundsWa(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("greyhoundswa");
  for (const date of eachDate(options.from, options.to)) {
    if (!canSelect(summary, options)) break;
    const races = await queryRacesByMeetingDate(date, options, {
      state: "WA",
      onlyWithoutProvider: options.onlyMissing ? "greyhoundswa" : null,
    });
    const trackCount = new Set(races.map((race) => normaliseName(race.trackName))).size;
    if (trackCount !== 1) {
      if (races.length > 0) {
        summary.selected += races.length;
        summary.skipped += races.length;
        summary.quarantined += races.length;
        summary.quarantineRowsWritten += await writeReplayQuarantines(
          races.map((race) => ({
            raceId: race.id,
            reasonCode: "greyhoundswa_track_match_ambiguous",
            sourceKey: `${date}:${race.trackName}:${race.raceNumber}`,
          })),
          options
        );
        if (summary.notes.length < 8) {
          summary.notes.push(
            `Skipped ${date}; Vimeo titles do not identify one of ${trackCount} WA tracks`
          );
        }
      }
      continue;
    }
    const racesByNumber = new Map(races.map((race) => [race.raceNumber, race]));
    if (racesByNumber.size === 0) continue;

    let html: string;
    try {
      html = await fetchText(
        `${GREYHOUNDS_WA_SHOWCASE_BASE}/greyhoundswa${compactDate(date)}`
      );
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`Greyhounds WA ${date} showcase failed: ${errorMessage(err)}`);
      }
      continue;
    }
    for (const video of parseGreyhoundsWaVimeoVideos(html)) {
      if (!canSelect(summary, options)) break;
      const race = racesByNumber.get(video.raceNumber);
      if (!race) continue;
      summary.selected += 1;
      summary.resolved += 1;
      summary.wouldWrite += 1;
      summary.written += await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "greyhoundswa",
          sourceId: video.videoId,
          kind: DEFAULT_KIND,
          pageUrl: video.pageUrl,
          embedSourceType: "vimeo",
          sourceStatus: 200,
          sourceCode: "greyhoundswa-vimeo",
          streamUrl: null,
          streamContentType: null,
          title: `${race.trackName} Race ${race.raceNumber}`,
          description: race.name,
          sourceRawJson: JSON.stringify(video),
        },
        options
      );
    }
  }
  return summary;
}

async function backfillSaRaceReplayYoutube(
  options: Options
): Promise<BackfillSummary> {
  const summary = newSummary("sa-race-replay");
  const races = await queryRacesForState(options, "SA", "sa-race-replay");
  for (const race of races) {
    if (!canSelect(summary, options)) break;
    const exactTitle = saRaceReplayTitle(race);
    summary.selected += 1;
    try {
      const videoIds = await findSaRaceReplayVideoIds(exactTitle);
      if (videoIds.length === 0) {
        summary.skipped += 1;
        continue;
      }
      if (videoIds.length !== 1) {
        summary.skipped += 1;
        summary.quarantined += 1;
        summary.quarantineRowsWritten += await writeReplayQuarantines(
          [
            {
              raceId: race.id,
              reasonCode: "sa_race_replay_match_ambiguous",
              sourceKey: `${exactTitle}:${videoIds.join(":")}`,
            },
          ],
          options
        );
        continue;
      }
      const videoId = videoIds[0];
      summary.resolved += 1;
      summary.wouldWrite += 1;
      summary.written += await writeRaceVideo(
        {
          raceId: race.id,
          sourceProvider: "sa-race-replay",
          sourceId: videoId,
          kind: DEFAULT_KIND,
          pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
          embedSourceType: "youtube",
          sourceStatus: 200,
          sourceCode: "sa-race-replay-youtube-exact-title",
          streamUrl: null,
          streamContentType: null,
          title: exactTitle,
          description: race.name,
          sourceRawJson: JSON.stringify({
            exactTitle,
            authoritativeChannel: "@saracereplays",
            matchStatus: "unique_exact_title",
          }),
        },
        options
      );
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(`${exactTitle} failed: ${errorMessage(err)}`);
      }
    }
  }
  return summary;
}

async function queryTheDogsExistingRows(options: Options, limit: number) {
  if (!options.full && limit <= 0) return [];
  const limitSql = options.full ? Prisma.empty : Prisma.sql`LIMIT ${limit}`;
  const missingSql = options.onlyMissing
    ? Prisma.sql`AND rv."streamUrl" IS NULL`
    : Prisma.empty;

  return prisma.$queryRaw<RaceVideoRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state",
      rv."sourceProvider",
      rv."sourceId",
      rv."kind",
      rv."pageUrl",
      rv."embedSourceType",
      rv."streamUrl",
      rv."streamContentType",
      rv."title",
      rv."description",
      rv."sourceStatus",
      rv."sourceCode"
    FROM "RaceVideo" rv
    JOIN "Race" r ON r."id" = rv."raceId"
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE rv."sourceProvider" = 'thedogs'
      AND rv."kind" = ${DEFAULT_KIND}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${stateSql(options)}
      ${missingSql}
    ORDER BY r."raceTime" ASC, r."raceNumber" ASC
    ${limitSql}
  `;
}

async function queryLegacyReplayRows(
  options: Options,
  cursor: Pick<LegacyReplayRaceRow, "id" | "raceTime"> | null
) {
  const cursorSql = cursor
    ? Prisma.sql`AND (r."raceTime", r."id") > (${cursor.raceTime}, ${cursor.id})`
    : Prisma.empty;
  return prisma.$queryRaw<LegacyReplayRaceRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state",
      r."sourceProvider" AS "raceSourceProvider",
      r."sourceId" AS "raceSourceId",
      r."replayUrl"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      AND r."replayUrl" IS NOT NULL
      ${stateSql(options)}
      ${cursorSql}
    ORDER BY r."raceTime" ASC, r."id" ASC
    LIMIT ${LEGACY_NORMALIZATION_BATCH_SIZE}
  `;
}

async function queryRacesForState(
  options: Options,
  state: string,
  onlyWithoutProvider: string
) {
  const limitSql = options.full ? Prisma.empty : Prisma.sql`LIMIT ${options.limit}`;
  const missingSql = options.onlyMissing
    ? Prisma.sql`
      AND NOT EXISTS (
        SELECT 1 FROM "RaceVideo" rv
        WHERE rv."raceId" = r."id"
          AND rv."sourceProvider" = ${onlyWithoutProvider}
          AND rv."kind" = ${DEFAULT_KIND}
      )
    `
    : Prisma.empty;

  return prisma.$queryRaw<RaceRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE UPPER(TRIM(COALESCE(t."state", ''))) = ${state}
      AND r."raceTime" >= ${startOfDay(options.from)}
      AND r."raceTime" <= ${endOfDay(options.to)}
      ${missingSql}
    ORDER BY r."raceTime" ASC, r."raceNumber" ASC
    ${limitSql}
  `;
}

async function queryRacesByMeetingDate(
  date: string,
  options: Options,
  filters: { state?: string; sourceProvider?: string; onlyWithoutProvider?: string | null }
) {
  const stateFilter = filters.state
    ? Prisma.sql`AND UPPER(TRIM(COALESCE(t."state", ''))) = ${filters.state}`
    : stateSql(options);
  const sourceProviderFilter = filters.sourceProvider
    ? Prisma.sql`AND r."sourceProvider" = ${filters.sourceProvider}`
    : Prisma.empty;
  const missingFilter = filters.onlyWithoutProvider
    ? Prisma.sql`
      AND NOT EXISTS (
        SELECT 1 FROM "RaceVideo" rv
        WHERE rv."raceId" = r."id"
          AND rv."sourceProvider" = ${filters.onlyWithoutProvider}
          AND rv."kind" = ${DEFAULT_KIND}
      )
    `
    : Prisma.empty;

  return prisma.$queryRaw<RaceRow[]>`
    SELECT
      r."id",
      r."raceTime",
      m."meetingDate",
      r."raceNumber",
      r."name",
      t."name" AS "trackName",
      t."state"
    FROM "Race" r
    JOIN "Meeting" m ON m."id" = r."meetingId"
    JOIN "Track" t ON t."id" = m."trackId"
    WHERE m."meetingDate" >= ${startOfDay(date)}
      AND m."meetingDate" <= ${endOfDay(date)}
      ${stateFilter}
      ${sourceProviderFilter}
      ${missingFilter}
    ORDER BY t."name" ASC, r."raceNumber" ASC
  `;
}

async function fetchTasracingEvents(options: Options) {
  const events: TasEvent[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const payload = await fetchJson<{ videos?: TasEvent[] }>(
      `${TASRACING_EVENT_API}?search=greyhound&page=${page}`
    );
    const videos = payload.videos ?? [];
    if (videos.length === 0) break;

    let allOlderThanRange = true;
    for (const event of videos) {
      const date = event.meeting_date_format;
      if (!date) continue;
      if (date >= options.from) allOlderThanRange = false;
      if (
        date >= options.from &&
        date <= options.to &&
        event.category === "Greyhounds" &&
        !event.trial
      ) {
        events.push(event);
      }
    }
    if (allOlderThanRange) break;
  }
  return events;
}

function publicTasracingAngle(race: TasRace) {
  const angles = Array.isArray(race.angles)
    ? race.angles
    : Object.values(race.angles ?? {});
  return angles.find((angle) => angle.login === false && angle.stream);
}

async function writeReplayQuarantines(
  rows: Array<{ raceId: string; reasonCode: string; sourceKey: string }>,
  options: Options
) {
  if (options.dryRun || rows.length === 0) return 0;
  const values = rows.map((row) => {
    const sourceKeySha256 = createHash("sha256")
      .update(row.sourceKey)
      .digest("hex");
    return Prisma.sql`(
      'race-video-backfill',
      'race-media',
      ${`${row.raceId}:${sourceKeySha256}`},
      ${row.reasonCode},
      'quarantined',
      FALSE,
      jsonb_build_object(
        'raceId', ${row.raceId},
        'sourceKeySha256', ${sourceKeySha256}
      )
    )`;
  });
  return prisma.$executeRaw`
    INSERT INTO _giq_history_merge.quarantine (
      source_name,
      entity_type,
      source_key,
      reason_code,
      disposition,
      blocking,
      evidence
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT (source_name, entity_type, source_key, reason_code) DO NOTHING
  `;
}

async function writeRaceVideo(
  row: RaceVideoWrite,
  options: Options,
  conflictMode: "enrich" | "preserve" = "enrich"
) {
  if (options.dryRun) return 0;
  const now = new Date();
  const conflictSql =
    conflictMode === "preserve"
      ? Prisma.sql`DO NOTHING`
      : Prisma.sql`DO UPDATE SET
          "embedSourceType" = COALESCE("RaceVideo"."embedSourceType", EXCLUDED."embedSourceType"),
          "sourceStatus" = CASE
            WHEN "RaceVideo"."streamUrl" IS NULL AND EXCLUDED."streamUrl" IS NOT NULL
            THEN EXCLUDED."sourceStatus"
            ELSE COALESCE("RaceVideo"."sourceStatus", EXCLUDED."sourceStatus")
          END,
          "sourceCode" = CASE
            WHEN "RaceVideo"."streamUrl" IS NULL AND EXCLUDED."streamUrl" IS NOT NULL
            THEN COALESCE(EXCLUDED."sourceCode", "RaceVideo"."sourceCode")
            ELSE COALESCE("RaceVideo"."sourceCode", EXCLUDED."sourceCode")
          END,
          "streamUrl" = COALESCE("RaceVideo"."streamUrl", EXCLUDED."streamUrl"),
          "streamContentType" = COALESCE("RaceVideo"."streamContentType", EXCLUDED."streamContentType"),
          "title" = COALESCE("RaceVideo"."title", EXCLUDED."title"),
          "description" = COALESCE("RaceVideo"."description", EXCLUDED."description"),
          "sourceRawJson" = COALESCE("RaceVideo"."sourceRawJson", EXCLUDED."sourceRawJson"),
          "fetchedAt" = EXCLUDED."fetchedAt",
          "lastSyncedAt" = EXCLUDED."lastSyncedAt",
          "updatedAt" = NOW()
        WHERE
          ("RaceVideo"."embedSourceType" IS NULL AND EXCLUDED."embedSourceType" IS NOT NULL)
          OR ("RaceVideo"."streamUrl" IS NULL AND EXCLUDED."streamUrl" IS NOT NULL)
          OR ("RaceVideo"."streamContentType" IS NULL AND EXCLUDED."streamContentType" IS NOT NULL)
          OR ("RaceVideo"."title" IS NULL AND EXCLUDED."title" IS NOT NULL)
          OR ("RaceVideo"."description" IS NULL AND EXCLUDED."description" IS NOT NULL)
          OR ("RaceVideo"."sourceRawJson" IS NULL AND EXCLUDED."sourceRawJson" IS NOT NULL)`;
  return prisma.$executeRaw`
    INSERT INTO "RaceVideo" (
      "id",
      "raceId",
      "sourceProvider",
      "sourceId",
      "kind",
      "pageUrl",
      "embedSourceType",
      "sourceStatus",
      "sourceCode",
      "streamUrl",
      "streamContentType",
      "title",
      "description",
      "sourceRawJson",
      "fetchedAt",
      "lastSyncedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${row.raceId},
      ${row.sourceProvider},
      ${row.sourceId},
      ${row.kind ?? DEFAULT_KIND},
      ${row.pageUrl},
      ${row.embedSourceType},
      ${row.sourceStatus},
      ${row.sourceCode},
      ${row.streamUrl},
      ${row.streamContentType},
      ${row.title},
      ${row.description},
      ${row.sourceRawJson},
      ${now},
      ${now},
      NOW(),
      NOW()
    )
    ON CONFLICT ("raceId", "sourceProvider", "kind") ${conflictSql}
  `;
}

function parseOptions(args: string[]): Options {
  const flags = parseFlags(args);
  const from = stringOption(flags, "from") ?? formatDate(addDays(new Date(), -7));
  const to = stringOption(flags, "to") ?? formatDate(new Date());
  assertDate(from, "--from");
  assertDate(to, "--to");
  if (dayValue(from) > dayValue(to)) {
    throw new Error("--from must be before or equal to --to");
  }

  const states = csvOption(flags, "state").map((state) => state.toUpperCase());
  const unsupportedStates = states.filter(
    (state) => !SUPPORTED_JURISDICTIONS.includes(state)
  );
  if (unsupportedStates.length > 0) {
    throw new Error(`--state contains unsupported jurisdiction: ${unsupportedStates.join(",")}`);
  }

  return {
    from,
    to,
    states,
    providers: csvOption(flags, "provider").map((provider) => provider.toLowerCase()),
    limit: positiveInt(stringOption(flags, "limit"), 100),
    full: flags.has("full"),
    auditOnly: flags.has("audit-only"),
    dryRun: flags.has("dry-run"),
    onlyMissing: !flags.has("refresh"),
    compact: flags.has("compact"),
    normalizeOnly: flags.has("normalize-only"),
  };
}

function parseFlags(args: string[]) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inlineValue != null) {
      values.set(key, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      values.set(key, true);
    }
  }
  return values;
}

function csvOption(values: Map<string, string | true>, key: string) {
  return (stringOption(values, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stateSql(options: Options) {
  const states = options.states.length ? options.states : SUPPORTED_JURISDICTIONS;
  return Prisma.sql`AND UPPER(TRIM(COALESCE(t."state", ''))) IN (${Prisma.join(
    states
  )})`;
}

function stateEnabled(options: Options, state: string) {
  return options.states.length === 0 || options.states.includes(state);
}

function providerEnabled(options: Options, provider: string) {
  return options.providers.length === 0 || options.providers.includes(provider);
}

function newSummary(provider: string): BackfillSummary {
  return {
    provider,
    selected: 0,
    resolved: 0,
    written: 0,
    wouldWrite: 0,
    skipped: 0,
    quarantined: 0,
    quarantineRowsWritten: 0,
    errors: 0,
    notes: [],
  };
}

function canSelect(summary: BackfillSummary, options: Options) {
  return options.full || summary.selected < options.limit;
}

function racingQueenslandTrackCode(trackName: string) {
  const key = normaliseName(trackName);
  const codes: Record<string, string> = {
    "betdeluxe capalaba": "capa",
    capalaba: "capa",
    "betdeluxe rockhampton": "rock",
    rockhampton: "rock",
    "ladbrokes q straight": "qst ",
    "q straight": "qst ",
    "ladbrokes q1 lakeside": "qot ",
    "q1 lakeside": "qot ",
    "ladbrokes q2 parklands": "qtt ",
    "q2 parklands": "qtt ",
  };
  return codes[key] ?? null;
}

function saRaceReplayTitle(race: RaceRow) {
  return `${hyphenTrackName(race.trackName)}-${dayMonthYear(race.meetingDate)}-Race-${race.raceNumber}`;
}

function hyphenTrackName(trackName: string) {
  return normaliseName(trackName)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

function dayMonthYear(date: Date) {
  const value = formatDate(date);
  const [year, month, day] = value.split("-");
  return `${day}${month}${year}`;
}

async function findSaRaceReplayVideoIds(exactTitle: string) {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", `${exactTitle} SA Race Replay`);
  const html = await fetchText(url.toString());
  return parseSaRaceReplayVideoIds(html, exactTitle);
}

function raceKey(trackName: string, raceNumber: number) {
  return `${normaliseName(trackName)}:${raceNumber}`;
}

function normaliseName(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      accept: "text/html,application/xhtml+xml,application/json",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${new URL(url).origin} returned ${response.status}`);
  }
  return readBoundedTextResponse(response, {
    maxBytes: PROVIDER_RESPONSE_MAX_BYTES,
    allowedContentTypes: [
      "text/html",
      "application/xhtml+xml",
      "application/json",
      "+json",
      "text/plain",
    ],
  });
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${new URL(url).origin} returned ${response.status}`);
  }
  const text = await readBoundedTextResponse(response, {
    maxBytes: PROVIDER_RESPONSE_MAX_BYTES,
    allowedContentTypes: ["application/json", "+json"],
  });
  return JSON.parse(text) as T;
}

function eachDate(from: string, to: string) {
  const dates: string[] = [];
  for (let value = dayValue(from); value <= dayValue(to); value += MS_PER_DAY) {
    dates.push(formatDate(new Date(value)));
  }
  return dates;
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function startOfDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function endOfDay(date: string) {
  return new Date(dayValue(date) + MS_PER_DAY - 1);
}

function dayValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function ratio(value: number, total: number) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

function json(value: unknown, compact: boolean) {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? Number(item) : item),
    compact ? 0 : 2
  );
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

main()
  .catch((err) => {
    console.error("[race-videos] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
