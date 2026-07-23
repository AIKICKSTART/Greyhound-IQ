/**
 * Audit and backfill public race replay rows across supported states.
 *
 * Examples:
 *   npm run audit:race-videos -- --from 2026-07-01 --to 2026-07-05 --compact
 *   npm run backfill:race-videos -- --from 2026-07-01 --to 2026-07-05 --state QLD,TAS,WA --dry-run
 */
import "./load-import-env";

import { createHash, randomUUID } from "node:crypto";
import { win32 as windowsPath } from "node:path";
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
import type { LiveMeeting, LiveRace } from "../src/lib/live/provider";
import { WatchdogProvider } from "../src/lib/live/watchdog";
import { PHOTO_FINISH_IMAGE_ORIGIN } from "../src/lib/csp";
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
const EXPECTED_NORMALIZED_HISTORY_CUTOFF = "2026-07-16T16:12:26.544Z";
const EXPECTED_NORMALIZED_MANIFEST_SHA256 =
  "13bc8d83c048633b57c5299ec1e778179276fee855182b9c932f8a28a77fbf1c";
const EXPECTED_NORMALIZED_TRANSFORM_VERSION = "thedogs-normalized-harvest/v2";
const EXPECTED_ALLOYDB_HOST = "10.240.116.2";
const EXPECTED_ALLOYDB_PORT = 5432;
const EXPECTED_NATIVE_HOST = "127.0.0.1";
const EXPECTED_NATIVE_PORT = 55435;
const EXPECTED_NATIVE_POSTGRES_MAJOR = 16;
const EXPECTED_NATIVE_DATA_DIRECTORY =
  "G:\\GreyhoundIQ\\native-postgres16-canonical\\data";
const EXPECTED_DATABASE_USER = "postgres";
const EXPECTED_REPLAY_ARTIFACT_SHA256 =
  "89b90198d3197238a2476381c0917108f21d2e209c02ca066e8ec90c1e8385b1";
const EXPECTED_REPLAY_EVIDENCE_CONTRACT_SHA256 =
  "aa6e63533daf5dd8c8e0aa2d5654b91f49140aeb2338904664430551600aae16";
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
const EXPECTED_CANONICAL_DELTA_TABLES = [
  "Track",
  "Trainer",
  "Dog",
  "Meeting",
  "Race",
  "Runner",
  "Result",
  "FormEntry",
  "DogProfileForm",
  "RaceVideo",
  "DogProfileArchive",
  "RaceDayArchive",
  "PedigreeImportRun",
  "DogSourceIdentity",
  "PedigreeAssertion",
  "PedigreeMergeLedger",
] as const;
const SUPPORTED_JURISDICTIONS = [
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
];
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
  nativeLocal: boolean;
  serving: boolean;
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
  serverVersionNum: number;
  dataDirectory: string;
  markerPresent: boolean;
  quarantinePresent: boolean;
  replayTaxonomyPresent: boolean;
  snapshotProofPresent: boolean;
  canonicalDeltaPresent: boolean;
  verificationCheckPresent: boolean;
};

type CandidateMergeMarker = {
  id: number;
  phase: string;
  sourceProductionDatabase: string;
  sourceHistoryDatabase: string;
  sourceHistoryCutoff: Date;
  normalizedManifestSha256: string;
  normalizedTransformVersion: string;
  normalizedAt: Date | null;
  normalizationManifestValid: boolean;
  replayNormalizationVerifiedAt: Date | null;
  replayArtifactSha256: string | null;
  replayArtifactRows: bigint | null;
  replayEvidenceContractSha256: string | null;
  replayEvidenceStagedAt: Date | null;
  canonicalMergedAt: Date | null;
  canonicalMergeManifest: Prisma.JsonValue | null;
  liveDeltaAppliedAt: Date | null;
  liveDeltaSourceManifest: Prisma.JsonValue | null;
  verifiedAt: Date | null;
  verificationManifest: Prisma.JsonValue | null;
};

type CandidateMergeProof = {
  canonicalManifestValid: boolean;
  canonicalDeltaRows: bigint;
  canonicalDeltaCompleteRows: bigint;
  canonicalDeltaUnexpectedRows: bigint;
  canonicalVerificationRows: bigint;
  raceMediaVerificationRows: bigint;
  standaloneReplayVerificationRows: bigint;
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

type ProviderSourceCollisionRow = {
  sourceProvider: string;
  sourceId: string;
  videoRows: bigint;
  raceRows: bigint;
  raceIds: string[];
  collisionGroups: bigint;
  collisionRows: bigint;
};

type ReplayUrlEvidenceConflictRow = {
  raceId: string;
  sourceProvider: string;
  expectedSourceId: string;
  actualSourceId: string;
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.serving) {
    // Serving-DB mode: per-state provider backfill against the live database.
    // The merge-candidate identity/marker/taxonomy contracts do not apply
    // (the _giq_history_* schemas exist only on merge candidates), and the
    // canonical normalization/quarantine pre-steps are merge-only.
    await assertServingReplayTarget();
  } else {
    await assertCandidateReplayTarget(options);
    await assertHistoricalReplayTaxonomy();
    await assertSnapshotRaceVideosPresent();
  }
  const auditBefore = await auditRaceVideos(options);

  if (options.auditOnly) {
    console.log(json(auditBefore, options.compact));
    return;
  }

  const backfill: BackfillSummary[] = options.serving
    ? []
    : [
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
  if (providerEnabled(options, "watchdog") && stateEnabled(options, "VIC")) {
    backfill.push(await backfillWatchdog(options));
  }

  const auditAfter = await auditRaceVideos(options);
  if (!options.serving) {
    await assertSnapshotRaceVideosPresent();
  }
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

const EXPECTED_SERVING_DATABASE = "giq_production_stage11_20260718_r2";

async function assertServingReplayTarget() {
  const [identity] = await prisma.$queryRaw<
    Array<{ database: string; host: string; port: number; user: string; ssl: boolean }>
  >`
    SELECT
      current_database()::text AS "database",
      host(inet_server_addr())::text AS "host",
      inet_server_port()::int AS "port",
      current_user::text AS "user",
      COALESCE(
        (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
        FALSE
      ) AS "ssl"
  `;
  if (
    !identity ||
    identity.database !== EXPECTED_SERVING_DATABASE ||
    identity.host !== EXPECTED_ALLOYDB_HOST ||
    identity.port !== EXPECTED_ALLOYDB_PORT ||
    identity.user !== EXPECTED_DATABASE_USER ||
    !identity.ssl
  ) {
    throw new Error(
      `race_videos.serving_identity_mismatch observed=${JSON.stringify(identity ?? null)}`,
    );
  }
}

async function assertCandidateReplayTarget(options: Options) {
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
      current_setting('server_version_num')::int AS "serverVersionNum",
      current_setting('data_directory')::text AS "dataDirectory",
      (to_regclass('_giq_history_merge.run') IS NOT NULL) AS "markerPresent",
      (to_regclass('_giq_history_merge.quarantine') IS NOT NULL) AS "quarantinePresent",
      (to_regclass('_giq_history_stage.media_resolution') IS NOT NULL) AS "replayTaxonomyPresent",
      (to_regclass('_giq_history_merge.snapshot_race_video_proof') IS NOT NULL) AS "snapshotProofPresent",
      (to_regclass('_giq_history_merge.canonical_table_delta') IS NOT NULL) AS "canonicalDeltaPresent",
      (to_regclass('_giq_history_merge.verification_check') IS NOT NULL) AS "verificationCheckPresent"
  `;
  if (options.nativeLocal) {
    if (
      !identity ||
      identity.database !== EXPECTED_CANDIDATE_DATABASE ||
      !isExpectedNativeHost(identity.host) ||
      identity.port !== EXPECTED_NATIVE_PORT ||
      identity.user !== EXPECTED_DATABASE_USER ||
      Math.trunc(identity.serverVersionNum / 10_000) !==
        EXPECTED_NATIVE_POSTGRES_MAJOR ||
      !sameWindowsPath(identity.dataDirectory, EXPECTED_NATIVE_DATA_DIRECTORY) ||
      !identity.markerPresent ||
      !identity.quarantinePresent ||
      !identity.replayTaxonomyPresent ||
      !identity.snapshotProofPresent
    ) {
      throw new Error("race_videos.native_candidate_identity_mismatch");
    }
  } else if (
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
      run.id,
      run.phase,
      run.source_production_database AS "sourceProductionDatabase",
      run.source_history_database AS "sourceHistoryDatabase",
      run.source_history_cutoff AS "sourceHistoryCutoff",
      run.normalized_manifest_sha256 AS "normalizedManifestSha256",
      run.normalized_transform_version AS "normalizedTransformVersion",
      run.normalized_at AS "normalizedAt",
      COALESCE(
        jsonb_typeof(run.normalization_manifest) = 'object'
          AND run.normalization_manifest @> jsonb_build_object(
            'candidateOnlyWrites', TRUE,
            'sourceAccessModeDeclared', 'read-only pg_dump/SELECT-only FDW',
            'sourceDatabases', jsonb_build_array(
              ${EXPECTED_PRODUCTION_SOURCE},
              ${EXPECTED_HISTORY_SOURCE}
            )
          ),
        FALSE
      ) AS "normalizationManifestValid",
      run.replay_normalization_verified_at AS "replayNormalizationVerifiedAt",
      run.replay_artifact_sha256 AS "replayArtifactSha256",
      run.replay_artifact_rows AS "replayArtifactRows",
      run.replay_evidence_contract_sha256 AS "replayEvidenceContractSha256",
      run.replay_evidence_staged_at AS "replayEvidenceStagedAt",
      run.canonical_merged_at AS "canonicalMergedAt",
      run.canonical_merge_manifest AS "canonicalMergeManifest",
      run.live_delta_applied_at AS "liveDeltaAppliedAt",
      run.live_delta_source_manifest AS "liveDeltaSourceManifest",
      run.verified_at AS "verifiedAt",
      run.verification_manifest AS "verificationManifest"
    FROM _giq_history_merge.run run
    WHERE run.id = 1
  `;
  const marker = markers.length === 1 ? markers[0] : null;
  if (
    !marker ||
    marker.phase !== "canonical_merged" ||
    marker.sourceProductionDatabase !== EXPECTED_PRODUCTION_SOURCE ||
    marker.sourceHistoryDatabase !== EXPECTED_HISTORY_SOURCE ||
    marker.sourceHistoryCutoff.toISOString() !==
      EXPECTED_NORMALIZED_HISTORY_CUTOFF ||
    marker.normalizedManifestSha256 !== EXPECTED_NORMALIZED_MANIFEST_SHA256 ||
    marker.normalizedTransformVersion !== EXPECTED_NORMALIZED_TRANSFORM_VERSION ||
    marker.normalizedAt === null ||
    !marker.normalizationManifestValid ||
    marker.replayNormalizationVerifiedAt === null ||
    marker.replayArtifactSha256 !== EXPECTED_REPLAY_ARTIFACT_SHA256 ||
    marker.replayArtifactRows !== BigInt(EXPECTED_REPLAY_ARTIFACT_ROWS) ||
    marker.replayEvidenceContractSha256 !==
      EXPECTED_REPLAY_EVIDENCE_CONTRACT_SHA256 ||
    marker.replayEvidenceStagedAt === null ||
    marker.canonicalMergedAt === null ||
    marker.canonicalMergeManifest === null ||
    marker.replayEvidenceStagedAt.getTime() >
      marker.replayNormalizationVerifiedAt.getTime() ||
    marker.canonicalMergedAt.getTime() <
      marker.replayNormalizationVerifiedAt.getTime() ||
    marker.canonicalMergedAt.getTime() < marker.normalizedAt.getTime() ||
    marker.liveDeltaAppliedAt !== null ||
    marker.liveDeltaSourceManifest !== null ||
    marker.verifiedAt !== null ||
    marker.verificationManifest !== null
  ) {
    throw new Error("race_videos.candidate_merge_phase_mismatch");
  }

  if (!identity.canonicalDeltaPresent || !identity.verificationCheckPresent) {
    throw new Error("race_videos.candidate_merge_proof_mismatch");
  }

  const expectedDeltaValues = EXPECTED_CANONICAL_DELTA_TABLES.map(
    (tableName) => Prisma.sql`(${tableName}::text)`
  );
  // merge-canonical.sql consumes its same-session plan attestation before these
  // durable delta, verification, and phase records can commit atomically.
  const proofs = await prisma.$queryRaw<CandidateMergeProof[]>`
    WITH expected_delta("tableName") AS (
      VALUES ${Prisma.join(expectedDeltaValues)}
    ), canonical_delta AS (
      SELECT
        COUNT(*)::bigint AS "rows",
        COUNT(*) FILTER (
          WHERE expected_delta."tableName" IS NULL
        )::bigint AS "unexpectedRows",
        COUNT(*) FILTER (
          WHERE expected_delta."tableName" IS NOT NULL
            AND delta.before_rows >= 0
            AND delta.after_rows >= 0
            AND delta.inserted_rows = delta.after_rows - delta.before_rows
        )::bigint AS "completeRows",
        jsonb_object_agg(
          delta.table_name,
          to_jsonb(delta) - 'table_name'
          ORDER BY delta.table_name
        ) AS manifest
      FROM _giq_history_merge.canonical_table_delta delta
      LEFT JOIN expected_delta ON expected_delta."tableName" = delta.table_name
    )
    SELECT
      COALESCE(
        jsonb_typeof(run.canonical_merge_manifest) = 'object'
          AND run.canonical_merge_manifest @> jsonb_build_object(
            'candidateOnlyWrites', TRUE,
            'sourceAccessModeDeclared', 'read-only inputs',
            'snapshotRaceVideosPreserved', TRUE,
            'unauthorizedNonNullOverwrites', 0,
            'nonAllowlistedTablesUnchanged', TRUE
          )
          AND run.canonical_merge_manifest->'tableDeltas' = canonical_delta.manifest,
        FALSE
      ) AS "canonicalManifestValid",
      canonical_delta."rows" AS "canonicalDeltaRows",
      canonical_delta."completeRows" AS "canonicalDeltaCompleteRows",
      canonical_delta."unexpectedRows" AS "canonicalDeltaUnexpectedRows",
      (
        SELECT COUNT(*)::bigint
        FROM _giq_history_merge.verification_check verification
        WHERE verification.check_name = 'canonical_merge_partition'
          AND verification.verified_at IS NOT NULL
          AND verification.verified_at <= run.canonical_merged_at
          AND jsonb_typeof(verification.metrics) = 'object'
          AND verification.metrics @> jsonb_build_object(
            'candidateOnlyWrites', TRUE,
            'sourceAccessModeDeclared', 'read-only inputs',
            'unauthorizedNonNullOverwrites', 0,
            'snapshotRaceVideosChanged', 0
          )
          AND verification.metrics->'tables' = canonical_delta.manifest
      ) AS "canonicalVerificationRows",
      (
        SELECT COUNT(*)::bigint
        FROM _giq_history_merge.verification_check verification
        WHERE verification.check_name = 'race_media_partition'
          AND verification.verified_at IS NOT NULL
          AND verification.verified_at <= run.canonical_merged_at
          AND jsonb_typeof(verification.metrics) = 'object'
          AND (verification.metrics->>'staged')::bigint = ${EXPECTED_REPLAY_ARTIFACT_ROWS}
          AND (verification.metrics->>'raceReplayStaged')::bigint = ${EXPECTED_RACE_REPLAY_ROWS}
          AND verification.metrics->'snapshotRaceVideosPreserved' = 'true'::jsonb
          AND (verification.metrics->>'canonicalRaceVideosInserted')::bigint = (
            SELECT inserted_rows
            FROM _giq_history_merge.canonical_table_delta
            WHERE table_name = 'RaceVideo'
          )
      ) AS "raceMediaVerificationRows",
      (
        SELECT COUNT(*)::bigint
        FROM _giq_history_merge.verification_check verification
        WHERE verification.check_name = 'standalone_replay_membership'
          AND verification.verified_at IS NOT NULL
          AND verification.verified_at <= run.canonical_merged_at
          AND jsonb_typeof(verification.metrics) = 'object'
          AND verification.metrics->>'contractSha256' = run.replay_evidence_contract_sha256
          AND (verification.metrics->>'inputProviderIds')::bigint = 145
          AND (
            (verification.metrics->>'presentInClonedRaceVideo')::bigint
            + (verification.metrics->>'explicitlyMissing')::bigint
            + (verification.metrics->>'quarantined')::bigint
          ) = 145
          AND (verification.metrics->>'importedFromStandaloneLog')::bigint = 0
          AND (verification.metrics->>'ephemeralMediaValuesStored')::bigint = 0
      ) AS "standaloneReplayVerificationRows"
    FROM _giq_history_merge.run run
    CROSS JOIN canonical_delta
    WHERE run.id = 1
  `;
  const proof = proofs.length === 1 ? proofs[0] : null;
  if (
    !proof ||
    !proof.canonicalManifestValid ||
    proof.canonicalDeltaRows !== BigInt(EXPECTED_CANONICAL_DELTA_TABLES.length) ||
    proof.canonicalDeltaCompleteRows !==
      BigInt(EXPECTED_CANONICAL_DELTA_TABLES.length) ||
    proof.canonicalDeltaUnexpectedRows !== BigInt(0) ||
    proof.canonicalVerificationRows !== BigInt(1) ||
    proof.raceMediaVerificationRows !== BigInt(1) ||
    proof.standaloneReplayVerificationRows !== BigInt(1)
  ) {
    throw new Error("race_videos.candidate_merge_proof_mismatch");
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
  const providerSourceCollisions = await auditProviderSourceCollisions();
  const replayUrlEvidenceConflicts =
    await auditReplayUrlEvidenceConflicts(options);

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
    identityIntegrity: {
      mode: "read-only",
      providerSourceCollisions,
      replayUrlEvidenceConflicts,
    },
    unresolvedSampleLimit: 100,
    unresolvedSamples,
  };
}

async function auditProviderSourceCollisions() {
  const rows = await prisma.$queryRaw<ProviderSourceCollisionRow[]>`
    WITH collisions AS (
      SELECT
        rv."sourceProvider" AS "sourceProvider",
        rv."sourceId" AS "sourceId",
        COUNT(*)::bigint AS "videoRows",
        COUNT(DISTINCT rv."raceId")::bigint AS "raceRows",
        (ARRAY_AGG(DISTINCT rv."raceId" ORDER BY rv."raceId"))[1:10] AS "raceIds"
      FROM "RaceVideo" rv
      GROUP BY rv."sourceProvider", rv."sourceId"
      HAVING COUNT(DISTINCT rv."raceId") > 1
    )
    SELECT
      c.*,
      COUNT(*) OVER()::bigint AS "collisionGroups",
      SUM(c."videoRows") OVER()::bigint AS "collisionRows"
    FROM collisions c
    ORDER BY c."sourceProvider", c."sourceId"
    LIMIT 100
  `;
  const totals = rows[0];
  return {
    scope: "all RaceVideo rows",
    collisionGroups: Number(totals?.collisionGroups ?? BigInt(0)),
    collisionRows: Number(totals?.collisionRows ?? BigInt(0)),
    sampleLimit: 100,
    samples: rows.map((row) => ({
      sourceProvider: row.sourceProvider,
      sourceId: row.sourceId,
      videoRows: Number(row.videoRows),
      raceRows: Number(row.raceRows),
      raceIds: row.raceIds,
    })),
  };
}

async function auditReplayUrlEvidenceConflicts(options: Options) {
  let cursor: Pick<LegacyReplayRaceRow, "id" | "raceTime"> | null = null;
  let replayUrls = 0;
  let recognizedReplayUrls = 0;
  let conflictRows = 0;
  const samples: Array<
    ReplayUrlEvidenceConflictRow & {
      state: string;
      meetingDate: string;
      trackName: string;
      raceNumber: number;
    }
  > = [];

  while (true) {
    const races = await queryLegacyReplayRows(options, cursor);
    if (races.length === 0) break;
    replayUrls += races.length;
    const expected = races.flatMap((race) => {
      const source = normaliseLegacyRaceReplaySource({
        sourceProvider: race.raceSourceProvider,
        replayUrl: race.replayUrl,
      });
      return source ? [{ race, source }] : [];
    });
    recognizedReplayUrls += expected.length;

    if (expected.length > 0) {
      const values = expected.map(({ race, source }) =>
        Prisma.sql`(${race.id}::text, ${source.sourceProvider}::text, ${source.sourceId}::text)`
      );
      const conflicts = await prisma.$queryRaw<ReplayUrlEvidenceConflictRow[]>`
        WITH expected("raceId", "sourceProvider", "sourceId") AS (
          VALUES ${Prisma.join(values)}
        )
        SELECT
          expected."raceId" AS "raceId",
          expected."sourceProvider" AS "sourceProvider",
          expected."sourceId" AS "expectedSourceId",
          rv."sourceId" AS "actualSourceId"
        FROM expected
        JOIN "RaceVideo" rv
          ON rv."raceId" = expected."raceId"
         AND rv."sourceProvider" = expected."sourceProvider"
         AND rv."kind" = ${DEFAULT_KIND}
        WHERE rv."sourceId" IS DISTINCT FROM expected."sourceId"
      `;
      conflictRows += conflicts.length;
      const racesById = new Map(races.map((race) => [race.id, race]));
      for (const conflict of conflicts) {
        if (samples.length >= 100) break;
        const race = racesById.get(conflict.raceId);
        if (!race) continue;
        samples.push({
          ...conflict,
          state: race.state,
          meetingDate: formatDate(race.meetingDate),
          trackName: race.trackName,
          raceNumber: race.raceNumber,
        });
      }
    }

    const last = races.at(-1);
    if (!last || races.length < LEGACY_NORMALIZATION_BATCH_SIZE) break;
    cursor = { id: last.id, raceTime: last.raceTime };
  }

  return {
    scope: "selected race range and jurisdictions",
    replayUrls,
    recognizedReplayUrls,
    conflictRows,
    sampleLimit: 100,
    samples,
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

async function backfillWatchdog(options: Options): Promise<BackfillSummary> {
  const summary = newSummary("watchdog");
  const provider = new WatchdogProvider();
  const range = { from: startOfDay(options.from), to: endOfDay(options.to) };

  // calendar-month returns a ~6-week VIC meeting window around the anchor
  // (metadata back to 2006, race replay videoIds from 2014-01-01), so one
  // mid-month anchor per month covers the whole range; dedupe by meeting id.
  const meetingsById = new Map<string, LiveMeeting>();
  for (const anchor of eachMonthAnchor(options.from, options.to)) {
    try {
      const meetings = await provider.fetchMeetingsByCalendarMonth(anchor, range);
      for (const meeting of meetings) {
        meetingsById.set(
          meeting.sourceId ?? `${meeting.trackName}:${meeting.meetingDate}`,
          meeting
        );
      }
    } catch (err) {
      summary.errors += 1;
      if (summary.notes.length < 8) {
        summary.notes.push(
          `Watchdog calendar month ${formatDate(anchor)} failed: ${errorMessage(err)}`
        );
      }
    }
  }

  const meetingsByDate = new Map<string, LiveMeeting[]>();
  for (const meeting of meetingsById.values()) {
    const date = formatDate(new Date(meeting.meetingDate));
    const group = meetingsByDate.get(date) ?? [];
    group.push(meeting);
    meetingsByDate.set(date, group);
  }

  let photoFinishRowsWritten = 0;
  for (const [date, meetings] of [...meetingsByDate.entries()].sort()) {
    if (!canSelect(summary, options)) break;
    const races = await queryRacesByMeetingDate(date, options, {
      state: "VIC",
      onlyWithoutProvider: options.onlyMissing ? "watchdog" : null,
    });
    if (races.length === 0) continue;

    // Two watchdog meetings can share a track and date (day/night slots); a
    // race number matching more than one watchdog race is ambiguous evidence.
    const liveByKey = new Map<string, LiveRace[]>();
    for (const meeting of meetings) {
      for (const liveRace of meeting.races) {
        const key = raceKey(meeting.trackName, liveRace.raceNumber);
        const group = liveByKey.get(key) ?? [];
        group.push(liveRace);
        liveByKey.set(key, group);
      }
    }

    for (const race of races) {
      if (!canSelect(summary, options)) break;
      const candidates =
        liveByKey.get(raceKey(race.trackName, race.raceNumber)) ?? [];
      if (candidates.length === 0) continue;
      summary.selected += 1;
      if (candidates.length > 1) {
        summary.skipped += 1;
        summary.quarantined += 1;
        summary.quarantineRowsWritten += await writeReplayQuarantines(
          [
            {
              raceId: race.id,
              reasonCode: "watchdog_replay_match_ambiguous",
              sourceKey: `${date}:${race.trackName}:${race.raceNumber}`,
            },
          ],
          options
        );
        continue;
      }

      const liveRace = candidates[0];
      try {
        if (liveRace.photoFinishUrl) {
          photoFinishRowsWritten += await writeRacePhotoFinish(
            race.id,
            liveRace.photoFinishUrl,
            options
          );
        }
        const videoId = liveRace.videoSourceId;
        if (!videoId) {
          summary.skipped += 1;
          continue;
        }
        summary.resolved += 1;
        summary.wouldWrite += 1;
        summary.written += await writeRaceVideo(
          {
            raceId: race.id,
            sourceProvider: "watchdog",
            sourceId: videoId,
            kind: DEFAULT_KIND,
            pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
            embedSourceType: "youtube",
            sourceStatus: 200,
            sourceCode: "watchdog-calendar-month",
            streamUrl: null,
            streamContentType: null,
            title: `${race.trackName} Race ${race.raceNumber}`,
            description: race.name,
            sourceRawJson: liveRace.sourceRawJson ?? null,
          },
          options
        );
      } catch (err) {
        summary.errors += 1;
        if (summary.notes.length < 8) {
          summary.notes.push(
            `VIC ${date} ${race.trackName} R${race.raceNumber} failed: ${errorMessage(err)}`
          );
        }
      }
    }
  }
  if (photoFinishRowsWritten > 0) {
    summary.notes.push(`Race.photoFinishUrl rows written: ${photoFinishRowsWritten}`);
  }
  return summary;
}

async function writeRacePhotoFinish(
  raceId: string,
  url: string,
  options: Options
) {
  if (options.dryRun) return 0;
  // Defense in depth: provider data is untrusted; persist only the known GRV
  // photo-finish origin (the same origin the CSP img-src allowlist admits).
  try {
    if (new URL(url).origin !== PHOTO_FINISH_IMAGE_ORIGIN) return 0;
  } catch {
    return 0;
  }
  // FORCE RLS on Race requires giq_is_system(); claim it in the same
  // transaction as the write so pool recycling cannot drop the claim.
  const [, written] = await prisma.$transaction([
    prisma.$executeRawUnsafe("SELECT set_config('app.system', 'true', true)"),
    prisma.$executeRaw`
      UPDATE "Race"
      SET "photoFinishUrl" = ${url}
      WHERE "id" = ${raceId} AND "photoFinishUrl" IS NULL
    `,
  ]);
  return written;
}

function eachMonthAnchor(from: string, to: string) {
  const anchors: Date[] = [];
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, 15);
  let anchor = new Date(
    Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 15)
  );
  while (anchor.getTime() <= end) {
    anchors.push(anchor);
    anchor = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 15)
    );
  }
  return anchors;
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
  if (options.serving) {
    // Serving DB has no _giq_history_merge schema; skip the evidence side-write.
    return 0;
  }
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
  // FORCE RLS on RaceVideo requires giq_is_system(); claim it in the same
  // transaction as the write so pool recycling cannot drop the claim.
  const [, written] = await prisma.$transaction([
    prisma.$executeRawUnsafe("SELECT set_config('app.system', 'true', true)"),
    prisma.$executeRaw`
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
  `,
  ]);
  return written;
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
    nativeLocal: flags.has("native-local"),
    serving: flags.has("serving"),
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

function sameWindowsPath(left: string, right: string) {
  return windowsPath.normalize(left).toLowerCase() === windowsPath.normalize(right).toLowerCase();
}

function isExpectedNativeHost(value: string | null) {
  return value === EXPECTED_NATIVE_HOST || value === `${EXPECTED_NATIVE_HOST}/32`;
}

main()
  .catch((err) => {
    console.error("[race-videos] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
