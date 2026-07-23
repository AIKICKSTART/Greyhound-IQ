COPY (
WITH
guard AS (
  SELECT CASE
    WHEN current_database() = 'giq_production_stage11_20260718_r2'
      AND current_setting('transaction_read_only') = 'on'
      AND current_setting('transaction_isolation') = 'repeatable read'
      AND inet_server_addr() IS NULL
      AND session_user = 'postgres'
      AND current_user = 'postgres'
      AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
    THEN true
    ELSE length(current_database()) / 0 = 0
  END AS ok
),
scope_meta AS (
  SELECT COUNT(*)::bigint AS expected_race_count
  FROM "Race" r
  WHERE r."raceTime" >= TIMESTAMP '2006-01-01 00:00:00'
),
meeting_raw_evidence AS MATERIALIZED (
  SELECT
    m.id,
    CASE WHEN m."sourceRawJson" IS NULL THEN 0 ELSE octet_length(m."sourceRawJson") END AS raw_bytes,
    CASE WHEN m."sourceRawJson" IS NULL THEN NULL ELSE encode(digest(convert_to(m."sourceRawJson", 'UTF8'), 'sha256'), 'hex') END AS raw_sha256
  FROM "Meeting" m
),
runner_aggregates AS (
  SELECT
    ru."raceId",
    jsonb_agg(jsonb_build_object(
      'id', ru.id,
      'raceId', ru."raceId",
      'dogId', ru."dogId",
      'boxNumber', ru."boxNumber",
      'weight', ru.weight,
      'trainerId', ru."trainerId",
      'startingPrice', ru."startingPrice",
      'scratched', ru.scratched,
      'sourceProvider', ru."sourceProvider",
      'sourceId', ru."sourceId",
      'sourceRawJsonBytes', CASE WHEN ru."sourceRawJson" IS NULL THEN 0 ELSE octet_length(ru."sourceRawJson") END,
      'sourceRawJsonSha256', CASE WHEN ru."sourceRawJson" IS NULL THEN NULL ELSE encode(digest(convert_to(ru."sourceRawJson", 'UTF8'), 'sha256'), 'hex') END,
      'createdAt', ru."createdAt",
      'dog', jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'earBrand', d."earBrand",
        'colour', d.colour,
        'sex', d.sex,
        'whelpDate', d."whelpDate",
        'sireId', d."sireId",
        'damId', d."damId",
        'trainerId', d."trainerId",
        'sourceProvider', d."sourceProvider",
        'sourceId', d."sourceId",
        'profileUrl', d."profileUrl",
        'profileSourceRawJsonBytes', CASE WHEN d."profileSourceRawJson" IS NULL THEN 0 ELSE octet_length(d."profileSourceRawJson") END,
        'profileSourceRawJsonSha256', CASE WHEN d."profileSourceRawJson" IS NULL THEN NULL ELSE encode(digest(convert_to(d."profileSourceRawJson", 'UTF8'), 'sha256'), 'hex') END,
        'lastProfileSyncedAt', d."lastProfileSyncedAt",
        'retiredAt', d."retiredAt",
        'createdAt', d."createdAt",
        'updatedAt', d."updatedAt"
      ),
      'trainer', CASE WHEN tr.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', tr.id,
        'name', tr.name,
        'state', tr.state,
        'licenseNumber', tr."licenseNumber",
        'createdAt', tr."createdAt"
      ) END,
      'result', CASE WHEN re.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', re.id,
        'runnerId', re."runnerId",
        'raceId', re."raceId",
        'finishingPosition', re."finishingPosition",
        'runningTime', re."runningTime",
        'margin', re.margin,
        'prizeMoneyWon', re."prizeMoneyWon",
        'splitTime', re."splitTime",
        'sectionals', re.sectionals,
        'gpsDataBytes', CASE WHEN re."gpsData" IS NULL THEN 0 ELSE octet_length(re."gpsData") END,
        'gpsDataSha256', CASE WHEN re."gpsData" IS NULL THEN NULL ELSE encode(digest(convert_to(re."gpsData", 'UTF8'), 'sha256'), 'hex') END,
        'sourceProvider', re."sourceProvider",
        'sourceId', re."sourceId",
        'sourceRawJsonBytes', CASE WHEN re."sourceRawJson" IS NULL THEN 0 ELSE octet_length(re."sourceRawJson") END,
        'sourceRawJsonSha256', CASE WHEN re."sourceRawJson" IS NULL THEN NULL ELSE encode(digest(convert_to(re."sourceRawJson", 'UTF8'), 'sha256'), 'hex') END,
        'lastSyncedAt', re."lastSyncedAt",
        'createdAt', re."createdAt",
        'raceMismatch', re."raceId" <> ru."raceId"
      ) END
    ) ORDER BY ru."boxNumber", ru.id) AS runners,
    COALESCE(bool_or(re.id IS NOT NULL AND re."raceId" <> ru."raceId"), false)
      AS result_race_mismatch
  FROM "Runner" ru
  JOIN "Race" r_scope
    ON r_scope.id = ru."raceId"
   AND r_scope."raceTime" >= TIMESTAMP '2006-01-01 00:00:00'
  JOIN "Dog" d ON d.id = ru."dogId"
  LEFT JOIN "Trainer" tr ON tr.id = ru."trainerId"
  LEFT JOIN "Result" re ON re."runnerId" = ru.id
  GROUP BY ru."raceId"
),
video_base AS (
  SELECT
    rv.*,
    r_scope."meetingId" AS race_meeting_id,
    substring(COALESCE(r_scope."replayUrl", '') from '(?i)/videos/watch/races/([0-9]+)/replay/?')
      AS legacy_thedogs_replay_id,
    lower(btrim(rv."sourceProvider")) AS normalized_provider,
    btrim(rv."sourceId") AS normalized_source_id,
    lower(btrim(rv.kind)) AS normalized_kind,
    regexp_replace(rv."streamUrl", '[?#].*$', '') AS stream_resource,
    lower(substring(btrim(rv."streamUrl") from '^[A-Za-z][A-Za-z0-9+.-]*://([^/:?#]+)')) AS stream_host
  FROM "RaceVideo" rv
  JOIN "Race" r_scope
    ON r_scope.id = rv."raceId"
   AND r_scope."raceTime" >= TIMESTAMP '2006-01-01 00:00:00'
),
source_collisions AS (
  SELECT
    normalized_provider,
    normalized_source_id,
    normalized_kind,
    COUNT(DISTINCT "raceId")::bigint AS race_count
  FROM video_base
  WHERE normalized_provider <> ''
    AND normalized_source_id <> ''
    AND normalized_kind <> ''
  GROUP BY normalized_provider, normalized_source_id, normalized_kind
),
page_collisions AS (
  SELECT "pageUrl", COUNT(DISTINCT "raceId")::bigint AS race_count
  FROM video_base
  WHERE NULLIF("pageUrl", '') IS NOT NULL
  GROUP BY "pageUrl"
),
stream_collisions AS (
  SELECT "streamUrl", COUNT(DISTINCT "raceId")::bigint AS race_count
  FROM video_base
  WHERE NULLIF("streamUrl", '') IS NOT NULL
  GROUP BY "streamUrl"
),
resource_collisions AS (
  SELECT stream_resource, COUNT(DISTINCT "raceId")::bigint AS race_count
  FROM video_base
  WHERE NULLIF(stream_resource, '') IS NOT NULL
  GROUP BY stream_resource
),
video_ranked AS (
  SELECT
    vb.*,
    ROW_NUMBER() OVER (
      PARTITION BY vb."raceId"
      ORDER BY vb."fetchedAt" DESC, vb.id ASC
    )::integer AS fetched_rank
  FROM video_base vb
),
video_runtime AS (
  SELECT
    vr.*,
    MIN(vr.fetched_rank) FILTER (
      WHERE vr.fetched_rank <= 16
        AND NULLIF(btrim(vr."streamUrl"), '') IS NOT NULL
    ) OVER (PARTITION BY vr."raceId") AS runtime_primary_rank
  FROM video_ranked vr
),
video_enriched AS (
  SELECT
    vr.*,
    COALESCE(sc.race_count, 0)::bigint AS source_identity_race_count,
    COALESCE(pc.race_count, 0)::bigint AS page_url_race_count,
    COALESCE(stc.race_count, 0)::bigint AS stream_url_race_count,
    COALESCE(rc.race_count, 0)::bigint AS stream_resource_race_count,
    vr.fetched_rank <= 16 AS runtime_loaded,
    COALESCE(vr.fetched_rank = vr.runtime_primary_rank, false) AS runtime_primary,
    COALESCE(vr.stream_host = ANY (ARRAY[
      'd2w8yyjcswa0zt.cloudfront.net',
      'mediatdogs.skyracing.com.au',
      'mediarqs.skyracing.com.au',
      'tasracing-race-replays.s3.ap-southeast-2.amazonaws.com',
      'www.thedogs.com.au'
    ]), false) AS direct_stream_shape,
    lower(COALESCE(vr."pageUrl", '') || ' ' || COALESCE(vr."streamUrl", '')) ~
      '(youtube\.com/embed/|youtube-nocookie\.com/embed/|player\.vimeo\.com/video/)' AS embed_shape,
    CASE vr.normalized_provider
      WHEN 'racing-queensland' THEN lower(COALESCE(vr."pageUrl", '')) ~
        '^https?://(www\.)?racingqueensland\.com\.au/racing/replays/.*/race-player/greyhound/'
      WHEN 'thedogs' THEN NULLIF(vr.normalized_source_id, '') IS NOT NULL
        OR lower(COALESCE(vr."pageUrl", '')) ~ '^https?://(www\.)?thedogs\.com\.au/'
      WHEN 'tasracing' THEN NULLIF(vr.normalized_source_id, '') IS NOT NULL
        OR vr.stream_host = 'tasracing-race-replays.s3.ap-southeast-2.amazonaws.com'
      WHEN 'greyhoundswa' THEN NULLIF(vr.normalized_source_id, '') IS NOT NULL
        AND lower(COALESCE(vr."pageUrl", '') || ' ' || COALESCE(vr."streamUrl", '')) ~
          '(vimeo\.com/|player\.vimeo\.com/video/)'
      ELSE false
    END AS provider_resolvable_shape,
    lower(COALESCE(vr."pageUrl", '') || '&' || COALESCE(vr."streamUrl", '')) ~
      '[?&](expires?|exp|x-amz-expires|x-amz-date|signature|sig|token|policy|key-pair-id)='
      AS possible_signed_expiry_query,
    COALESCE(vr.normalized_provider = 'thedogs', false)
      OR lower(COALESCE(vr."pageUrl", '') || ' ' || COALESCE(vr."streamUrl", '')) ~
        'https?://([^/]+\.)?thedogs\.com\.au/' AS thedogs_licence_gate,
    CASE vr.normalized_provider
      WHEN 'racing-queensland' THEN upper(t.state) <> 'QLD'
      WHEN 'tasracing' THEN upper(t.state) <> 'TAS'
      WHEN 'greyhoundswa' THEN upper(t.state) <> 'WA'
      WHEN 'sa-race-replay' THEN upper(t.state) <> 'SA'
      WHEN 'watchdog' THEN upper(t.state) <> 'VIC'
      ELSE false
    END AS provider_state_mismatch,
    COALESCE(vr."sourceCode" = 'provider-video-id', false) AS synthetic_ingest,
    (
      vr."fetchedAt" IS NULL
      OR vr."fetchedAt" < transaction_timestamp() - INTERVAL '30 days'
      OR vr."lastSyncedAt" IS NULL
      OR vr."lastSyncedAt" < transaction_timestamp() - INTERVAL '30 days'
      OR vr."updatedAt" < transaction_timestamp() - INTERVAL '30 days'
    ) AS stale_by_age
  FROM video_runtime vr
  JOIN "Meeting" m ON m.id = vr.race_meeting_id
  JOIN "Track" t ON t.id = m."trackId"
  LEFT JOIN source_collisions sc
    ON sc.normalized_provider = vr.normalized_provider
   AND sc.normalized_source_id = vr.normalized_source_id
   AND sc.normalized_kind = vr.normalized_kind
  LEFT JOIN page_collisions pc ON pc."pageUrl" = vr."pageUrl"
  LEFT JOIN stream_collisions stc ON stc."streamUrl" = vr."streamUrl"
  LEFT JOIN resource_collisions rc ON rc.stream_resource = vr.stream_resource
),
video_aggregates AS (
  SELECT
    ve."raceId",
    COUNT(*)::integer AS video_count,
    jsonb_agg(jsonb_build_object(
      'id', ve.id,
      'raceId', ve."raceId",
      'sourceProvider', ve."sourceProvider",
      'sourceId', ve."sourceId",
      'kind', ve.kind,
      'pageUrl', ve."pageUrl",
      'embedSourceType', ve."embedSourceType",
      'sourceStatus', ve."sourceStatus",
      'sourceCode', ve."sourceCode",
      'playbackStatus', 'unverified',
      'licensingStatus', CASE WHEN ve.thedogs_licence_gate THEN 'license_gated' ELSE 'unverified' END,
      'fieldCoherenceVerified', false,
      'streamUrl', ve."streamUrl",
      'streamContentType', ve."streamContentType",
      'title', ve.title,
      'description', ve.description,
      'sourceRawJsonBytes', CASE WHEN ve."sourceRawJson" IS NULL THEN 0 ELSE octet_length(ve."sourceRawJson") END,
      'sourceRawJsonSha256', CASE WHEN ve."sourceRawJson" IS NULL THEN NULL ELSE encode(digest(convert_to(ve."sourceRawJson", 'UTF8'), 'sha256'), 'hex') END,
      'fetchedAt', ve."fetchedAt",
      'lastSyncedAt', ve."lastSyncedAt",
      'createdAt', ve."createdAt",
      'updatedAt', ve."updatedAt",
      'fetchedAgeSeconds', CASE WHEN ve."fetchedAt" IS NULL THEN NULL ELSE floor(extract(epoch FROM transaction_timestamp() - ve."fetchedAt"))::bigint END,
      'lastSyncedAgeSeconds', CASE WHEN ve."lastSyncedAt" IS NULL THEN NULL ELSE floor(extract(epoch FROM transaction_timestamp() - ve."lastSyncedAt"))::bigint END,
      'updatedAgeSeconds', floor(extract(epoch FROM transaction_timestamp() - ve."updatedAt"))::bigint,
      'fetchedRank', ve.fetched_rank,
      'runtimeLoaded', ve.runtime_loaded,
      'runtimePrimary', ve.runtime_primary,
      'sourceIdentityRaceCount', ve.source_identity_race_count,
      'pageUrlRaceCount', ve.page_url_race_count,
      'streamUrlRaceCount', ve.stream_url_race_count,
      'streamResourceRaceCount', ve.stream_resource_race_count,
      'directStreamShape', ve.direct_stream_shape,
      'embedShape', ve.embed_shape,
      'providerResolvableShape', ve.provider_resolvable_shape,
      'providerStateMismatch', ve.provider_state_mismatch,
      'possibleSignedExpiryQuery', ve.possible_signed_expiry_query,
      'thedogsLicenceGate', ve.thedogs_licence_gate,
      'syntheticIngest', ve.synthetic_ingest,
      'staleByAge', ve.stale_by_age,
      'syntheticOrStale', ve.synthetic_ingest OR ve.stale_by_age
    ) ORDER BY ve.fetched_rank) AS videos,
    COALESCE(bool_or(ve.source_identity_race_count > 1), false) AS source_identity_collision,
    COALESCE(bool_or(ve.page_url_race_count > 1), false) AS page_url_collision,
    COALESCE(bool_or(ve.stream_url_race_count > 1), false) AS stream_url_collision,
    COALESCE(bool_or(ve.stream_resource_race_count > 1), false) AS stream_resource_collision,
    COALESCE(bool_or(
      ve.legacy_thedogs_replay_id IS NOT NULL
      AND ve.normalized_provider = 'thedogs'
      AND ve.normalized_source_id IS DISTINCT FROM ve.legacy_thedogs_replay_id
    ), false) AS legacy_thedogs_conflict,
    COALESCE(bool_or(ve.provider_state_mismatch), false) AS provider_state_mismatch,
    COALESCE(bool_or(ve.possible_signed_expiry_query), false) AS possible_signed_expiry_query,
    COALESCE(bool_or(ve.thedogs_licence_gate), false) AS thedogs_licence_gate,
    COALESCE(bool_or(ve.synthetic_ingest OR ve.stale_by_age), false) AS synthetic_or_stale,
    COALESCE(bool_or(ve.direct_stream_shape OR ve.embed_shape), false) AS structurally_resolvable,
    COALESCE(bool_or(ve.provider_resolvable_shape), false) AS provider_resolvable,
    COUNT(*) > 0 AND COALESCE(bool_and(
      NOT ve.synthetic_ingest
      AND ve."sourceStatus" IS NOT NULL
      AND (ve."sourceStatus" < 200 OR ve."sourceStatus" >= 300)
    ), false) AS stored_source_failure_only
  FROM video_enriched ve
  GROUP BY ve."raceId"
),
race_rows AS (
  SELECT
    r.id AS race_id,
    jsonb_build_object(
    'inventory', jsonb_build_object(
      'schema', 'greyhoundiq.replay-production-inventory',
      'version', 1,
      'generatedAt', transaction_timestamp(),
      'snapshotId', pg_current_snapshot()::text,
      'database', current_database(),
      'cutoff', '2006-01-01T00:00:00.000Z',
      'expectedRaceCount', sm.expected_race_count,
      'runtimeCandidateLimit', 16,
      'staleAfterSeconds', 2592000,
      'playbackVerified', false
    ),
    'race', jsonb_build_object(
      'id', r.id,
      'meetingId', r."meetingId",
      'raceNumber', r."raceNumber",
      'name', r.name,
      'raceTime', r."raceTime",
      'distance', r.distance,
      'grade', r.grade,
      'prizeMoney', r."prizeMoney",
      'resultStatus', r."resultStatus",
      'replayUrl', r."replayUrl",
      'photoFinishUrl', r."photoFinishUrl",
      'sourceProvider', r."sourceProvider",
      'sourceId', r."sourceId",
      'sourceRawJsonBytes', CASE WHEN r."sourceRawJson" IS NULL THEN 0 ELSE octet_length(r."sourceRawJson") END,
      'sourceRawJsonSha256', CASE WHEN r."sourceRawJson" IS NULL THEN NULL ELSE encode(digest(convert_to(r."sourceRawJson", 'UTF8'), 'sha256'), 'hex') END,
      'lastSyncedAt', r."lastSyncedAt",
      'createdAt', r."createdAt"
    ),
    'meeting', jsonb_build_object(
      'id', m.id,
      'trackId', m."trackId",
      'meetingDate', m."meetingDate",
      'meetingType', m."meetingType",
      'sourceProvider', m."sourceProvider",
      'sourceId', m."sourceId",
      'sourceRawJsonBytes', mre.raw_bytes,
      'sourceRawJsonSha256', mre.raw_sha256,
      'lastSyncedAt', m."lastSyncedAt",
      'createdAt', m."createdAt"
    ),
    'track', jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'state', t.state,
      'surface', t.surface,
      'circumference', t.circumference,
      'straightLength', t."straightLength",
      'boxCount', t."boxCount",
      'hasIsolynx', t."hasIsolynx",
      'createdAt', t."createdAt"
    ),
    'runners', COALESCE(ra.runners, '[]'::jsonb),
    'videos', COALESCE(va.videos, '[]'::jsonb),
    'videoCandidateCount', COALESCE(va.video_count, 0),
    'runtimeTruncationRisk', COALESCE(va.video_count, 0) > 16,
    'legacyTheDogsReplayId', substring(
      COALESCE(r."replayUrl", '')
      from '(?i)/videos/watch/races/([0-9]+)/replay/?'
    ),
    'flags', jsonb_build_object(
      'resultRaceMismatch', COALESCE(ra.result_race_mismatch, false),
      'sourceIdentityCollision', COALESCE(va.source_identity_collision, false),
      'pageUrlCollision', COALESCE(va.page_url_collision, false),
      'streamUrlCollision', COALESCE(va.stream_url_collision, false),
      'streamResourceCollision', COALESCE(va.stream_resource_collision, false),
      'legacyTheDogsConflict', COALESCE(va.legacy_thedogs_conflict, false),
      'providerStateMismatch', COALESCE(va.provider_state_mismatch, false),
      'possibleSignedExpiryQuery', COALESCE(va.possible_signed_expiry_query, false),
      'thedogsLicenceGate', COALESCE(va.thedogs_licence_gate, false),
      'syntheticOrStale', COALESCE(va.synthetic_or_stale, false),
      'identityConflict', COALESCE(ra.result_race_mismatch, false)
        OR COALESCE(va.source_identity_collision, false)
        OR COALESCE(va.page_url_collision, false)
        OR COALESCE(va.stream_url_collision, false)
        OR COALESCE(va.stream_resource_collision, false)
        OR COALESCE(va.legacy_thedogs_conflict, false)
        OR COALESCE(va.provider_state_mismatch, false)
    ),
    'playbackStatus', 'unverified',
    'classification', CASE
      WHEN COALESCE(ra.result_race_mismatch, false)
        OR COALESCE(va.source_identity_collision, false)
        OR COALESCE(va.page_url_collision, false)
        OR COALESCE(va.stream_url_collision, false)
        OR COALESCE(va.stream_resource_collision, false)
        OR COALESCE(va.legacy_thedogs_conflict, false)
        OR COALESCE(va.provider_state_mismatch, false)
        THEN 'identity_conflict'
      WHEN COALESCE(va.thedogs_licence_gate, false) THEN 'license_gated_unverified'
      WHEN COALESCE(va.stored_source_failure_only, false) THEN 'stored_source_failure_only'
      WHEN COALESCE(va.structurally_resolvable, false) THEN 'structurally_resolvable_unverified'
      WHEN COALESCE(va.provider_resolvable, false) THEN 'provider_resolvable_unverified'
      WHEN COALESCE(va.video_count, 0) > 0 THEN 'partial_source'
      WHEN NULLIF(btrim(r."replayUrl"), '') IS NOT NULL THEN 'legacy_reference_unverified'
      WHEN upper(t.state) = ANY (ARRAY['ACT', 'NSW', 'NZ', 'QLD', 'SA', 'TAS', 'VIC', 'WA'])
        THEN 'provider_discovery_unverified'
      ELSE 'no_stored_replay_evidence'
    END
  ) AS inventory_row
  FROM "Race" r
  JOIN "Meeting" m ON m.id = r."meetingId"
  JOIN meeting_raw_evidence mre ON mre.id = m.id
  JOIN "Track" t ON t.id = m."trackId"
  LEFT JOIN runner_aggregates ra ON ra."raceId" = r.id
  LEFT JOIN video_aggregates va ON va."raceId" = r.id
  CROSS JOIN scope_meta sm
  CROSS JOIN guard g
  WHERE g.ok
    AND r."raceTime" >= TIMESTAMP '2006-01-01 00:00:00'
)
SELECT inventory_row::text
FROM race_rows
ORDER BY race_id
) TO STDOUT WITH (
  FORMAT csv,
  DELIMITER E'\x02',
  QUOTE E'\x01',
  ESCAPE E'\x01'
);
