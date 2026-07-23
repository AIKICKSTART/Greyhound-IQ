#!/bin/sh
set -eu

umask 077

readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_DATABASE="giq_production_stage11_20260718_r2"
readonly EXPECTED_USER="postgres"
readonly HISTORICAL_CUTOFF="2026-07-01T00:00:00Z"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${DEST_DATABASE_PASSWORD:-}" ] || die "DEST_DATABASE_PASSWORD is required"

export PGHOST="$EXPECTED_HOST"
export PGPORT="5432"
export PGDATABASE="$EXPECTED_DATABASE"
export PGUSER="$EXPECTED_USER"
export PGPASSWORD="$DEST_DATABASE_PASSWORD"
export PGSSLMODE="require"
export PGCONNECT_TIMEOUT="30"
export PGOPTIONS="-c default_transaction_read_only=on"

database_identity="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command='SELECT current_database();')"
[ "$database_identity" = "$EXPECTED_DATABASE" ] || \
  die "database identity mismatch: expected $EXPECTED_DATABASE, observed $database_identity"

audit_mode="${AUDIT_MODE:-full}"
case "$audit_mode" in
  full) ;;
  identity-diagnostics)
    psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align <<'SQL'
WITH runner_collision_groups AS (
  SELECT
    runner."raceId" AS race_id,
    runner."sourceProvider" AS source_provider,
    runner."sourceId" AS source_id,
    COUNT(*) AS rows,
    jsonb_agg(
      jsonb_build_object(
        'runnerId', runner.id,
        'boxNumber', runner."boxNumber",
        'dogId', runner."dogId",
        'dogName', dog.name
      ) ORDER BY runner."boxNumber", runner.id
    ) AS runners
  FROM public."Runner" runner
  JOIN public."Dog" dog ON dog.id = runner."dogId"
  WHERE runner."sourceProvider" IS NOT NULL
    AND runner."sourceId" IS NOT NULL
  GROUP BY runner."raceId", runner."sourceProvider", runner."sourceId"
  HAVING COUNT(*) > 1
),
form_mismatches AS (
  SELECT form.*
  FROM public."FormEntry" form
  WHERE form."raceId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public."Runner" runner
      WHERE runner."raceId" = form."raceId"
        AND runner."dogId" = form."dogId"
    )
)
SELECT jsonb_build_object(
  'auditKind', 'alloydb-production-identity-diagnostics',
  'database', current_database(),
  'runnerSourceCollisions', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'raceId', race_id,
          'sourceProvider', source_provider,
          'sourceId', source_id,
          'rows', rows,
          'runners', runners
        ) ORDER BY race_id, source_provider, source_id
      ),
      '[]'::jsonb
    )
    FROM runner_collision_groups
  ),
  'formDogRaceMismatches', jsonb_build_object(
    'total', (SELECT COUNT(*) FROM form_mismatches),
    'nullBoxNumber', (
      SELECT COUNT(*) FROM form_mismatches WHERE "boxNumber" IS NULL
    ),
    'matchingRaceBox', (
      SELECT COUNT(*)
      FROM form_mismatches form
      WHERE form."boxNumber" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public."Runner" runner
          WHERE runner."raceId" = form."raceId"
            AND runner."boxNumber" = form."boxNumber"
        )
    ),
    'withoutMatchingRaceBox', (
      SELECT COUNT(*)
      FROM form_mismatches form
      WHERE form."boxNumber" IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM public."Runner" runner
           WHERE runner."raceId" = form."raceId"
             AND runner."boxNumber" = form."boxNumber"
         )
    )
  ),
  'blankSourceIds', jsonb_build_object(
    'meetings', (SELECT COUNT(*) FROM public."Meeting" WHERE "sourceId" IS NOT NULL AND NULLIF(BTRIM("sourceId"), '') IS NULL),
    'races', (SELECT COUNT(*) FROM public."Race" WHERE "sourceId" IS NOT NULL AND NULLIF(BTRIM("sourceId"), '') IS NULL),
    'runners', (SELECT COUNT(*) FROM public."Runner" WHERE "sourceId" IS NOT NULL AND NULLIF(BTRIM("sourceId"), '') IS NULL),
    'results', (SELECT COUNT(*) FROM public."Result" WHERE "sourceId" IS NOT NULL AND NULLIF(BTRIM("sourceId"), '') IS NULL),
    'raceVideos', (SELECT COUNT(*) FROM public."RaceVideo" WHERE NULLIF(BTRIM("sourceId"), '') IS NULL)
  )
);
SQL
    printf 'PRODUCTION_DB_IDENTITY_DIAGNOSTICS_COMPLETE database=%s\n' "$EXPECTED_DATABASE"
    exit 0
    ;;
  *) die "unsupported AUDIT_MODE: $audit_mode" ;;
esac

psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --set=historical_cutoff="$HISTORICAL_CUTOFF" <<'SQL'
WITH
role_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role', rolname,
        'login', rolcanlogin,
        'superuser', rolsuper,
        'bypassRls', rolbypassrls,
        'inherit', rolinherit
      ) ORDER BY rolname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_roles
  WHERE rolname IN (
    'greyhoundiq_app',
    'greyhoundiq_migrator',
    'greyhoundiq_runtime'
  )
),
role_memberships AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('member', member.rolname, 'role', parent.rolname)
      ORDER BY member.rolname, parent.rolname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_auth_members membership
  JOIN pg_roles parent ON parent.oid = membership.roleid
  JOIN pg_roles member ON member.oid = membership.member
  WHERE parent.rolname LIKE 'greyhoundiq_%'
     OR member.rolname LIKE 'greyhoundiq_%'
),
migration_inventory AS (
  SELECT jsonb_build_object(
    'rows', COUNT(*),
    'completed', COUNT(*) FILTER (
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    'unfinished', COUNT(*) FILTER (
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ),
    'rolledBack', COUNT(*) FILTER (
      WHERE finished_at IS NULL AND rolled_back_at IS NOT NULL
    ),
    'latestFinishedAt', MAX(finished_at)
  ) AS value
  FROM public."_prisma_migrations"
),
unfinished_migration_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'migration', migration_name,
        'startedAt', started_at,
        'appliedSteps', applied_steps_count,
        'rolledBackAt', rolled_back_at
      ) ORDER BY started_at
    ),
    '[]'::jsonb
  ) AS value
  FROM public."_prisma_migrations"
  WHERE finished_at IS NULL
    AND rolled_back_at IS NULL
),
admin_function_inventory AS (
  SELECT jsonb_build_object(
    'exists', COUNT(DISTINCT procedure.oid) = 1,
    'owner', MAX(owner.rolname),
    'publicExecute', COALESCE(
      BOOL_OR(
        privilege.grantee = 0
        AND privilege.privilege_type = 'EXECUTE'
      ),
      false
    )
  ) AS value
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  JOIN pg_roles owner ON owner.oid = procedure.proowner
  LEFT JOIN LATERAL aclexplode(
    COALESCE(procedure.proacl, acldefault('f', procedure.proowner))
  ) privilege ON true
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'giq_is_admin'
    AND procedure.pronargs = 0
),
catalog_inventory AS (
  SELECT jsonb_build_object(
    'baseTables', (
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ),
    'rlsTables', (
      SELECT COUNT(*)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relrowsecurity
    ),
    'forceRlsTables', (
      SELECT COUNT(*)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relforcerowsecurity
    ),
    'foreignKeys', COUNT(*) FILTER (WHERE contype = 'f'),
    'invalidForeignKeys', COUNT(*) FILTER (
      WHERE contype = 'f' AND NOT convalidated
    ),
    'invalidConstraints', COUNT(*) FILTER (WHERE NOT convalidated),
    'disabledTriggers', (
      SELECT COUNT(*) FROM pg_trigger WHERE tgenabled = 'D'
    )
  ) AS value
  FROM pg_constraint
),
invalid_constraint_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'constraint', constraint_record.conname,
        'table', relation.relname,
        'type', constraint_record.contype
      ) ORDER BY relation.relname, constraint_record.conname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_constraint constraint_record
  JOIN pg_class relation ON relation.oid = constraint_record.conrelid
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND NOT constraint_record.convalidated
),
cluster_database_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'database', database.datname,
        'bytes', pg_database_size(database.datname),
        'allowConnections', database.datallowconn,
        'activeConnections', (
          SELECT COUNT(*)
          FROM pg_stat_activity activity
          WHERE activity.datname = database.datname
        )
      ) ORDER BY database.datname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_database database
  WHERE NOT database.datistemplate
),
row_counts AS (
  SELECT jsonb_build_object(
    'Dog', (SELECT COUNT(*) FROM public."Dog"),
    'DogProfileArchive', (SELECT COUNT(*) FROM public."DogProfileArchive"),
    'DogProfileForm', (SELECT COUNT(*) FROM public."DogProfileForm"),
    'FormEntry', (SELECT COUNT(*) FROM public."FormEntry"),
    'Meeting', (SELECT COUNT(*) FROM public."Meeting"),
    'Race', (SELECT COUNT(*) FROM public."Race"),
    'RaceDayArchive', (SELECT COUNT(*) FROM public."RaceDayArchive"),
    'RaceVideo', (SELECT COUNT(*) FROM public."RaceVideo"),
    'Result', (SELECT COUNT(*) FROM public."Result"),
    'Runner', (SELECT COUNT(*) FROM public."Runner"),
    'Track', (SELECT COUNT(*) FROM public."Track"),
    'Trainer', (SELECT COUNT(*) FROM public."Trainer")
  ) AS value
),
storage_reference_inventory AS (
  SELECT jsonb_build_object(
    'mediaAssets', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bucket', inventory."storageBucket",
            'processingStatus', inventory."processingStatus",
            'scanStatus', inventory."scanStatus",
            'objects', inventory.objects,
            'bytes', inventory.bytes
          ) ORDER BY inventory."storageBucket", inventory."processingStatus", inventory."scanStatus"
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT "storageBucket", "processingStatus", "scanStatus",
               COUNT(*) AS objects, COALESCE(SUM("sizeBytes"), 0) AS bytes
        FROM public."MediaAsset"
        WHERE "deletedAt" IS NULL
        GROUP BY "storageBucket", "processingStatus", "scanStatus"
      ) inventory
    ),
    'exportArtifacts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bucket', inventory."storageBucket",
            'status', inventory.status,
            'objects', inventory.objects,
            'bytes', inventory.bytes
          ) ORDER BY inventory."storageBucket", inventory.status
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT "storageBucket", status, COUNT(*) AS objects,
               COALESCE(SUM("sizeBytes"), 0) AS bytes
        FROM public."ExportArtifact"
        WHERE "storageBucket" IS NOT NULL AND "storagePath" IS NOT NULL
        GROUP BY "storageBucket", status
      ) inventory
    ),
    'pendingDeletionJobs', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bucket', inventory."storageBucket",
            'status', inventory.status,
            'objects', inventory.objects
          ) ORDER BY inventory."storageBucket", inventory.status
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT "storageBucket", status, COUNT(*) AS objects
        FROM public."DeletionJob"
        WHERE "storageBucket" IS NOT NULL AND "storagePath" IS NOT NULL
        GROUP BY "storageBucket", status
      ) inventory
    )
  ) AS value
),
race_coverage AS (
  SELECT jsonb_build_object(
    'earliestRaceTime', MIN("raceTime"),
    'latestRaceTime', MAX("raceTime"),
    'historicalBeforeCutoff', COUNT(*) FILTER (
      WHERE "raceTime" < :'historical_cutoff'::timestamptz
    ),
    'cutoffOrNewer', COUNT(*) FILTER (
      WHERE "raceTime" >= :'historical_cutoff'::timestamptz
    ),
    'withReplayUrl', COUNT(*) FILTER (
      WHERE NULLIF(BTRIM("replayUrl"), '') IS NOT NULL
    ),
    'withPhotoFinishUrl', COUNT(*) FILTER (
      WHERE NULLIF(BTRIM("photoFinishUrl"), '') IS NOT NULL
    ),
    'latestSourceSync', MAX("lastSyncedAt")
  ) AS value
  FROM public."Race"
),
canonical_jurisdictions AS (
  SELECT state_code
  FROM (VALUES
    ('ACT'), ('NSW'), ('NT'), ('QLD'), ('SA'), ('TAS'), ('VIC'), ('WA')
  ) AS jurisdiction(state_code)
),
track_jurisdictions AS (
  SELECT
    track.id AS track_id,
    track.state AS raw_state,
    CASE UPPER(BTRIM(track.state))
      WHEN 'ACT' THEN 'ACT'
      WHEN 'AUSTRALIAN CAPITAL TERRITORY' THEN 'ACT'
      WHEN 'NSW' THEN 'NSW'
      WHEN 'NEW SOUTH WALES' THEN 'NSW'
      WHEN 'NT' THEN 'NT'
      WHEN 'NORTHERN TERRITORY' THEN 'NT'
      WHEN 'QLD' THEN 'QLD'
      WHEN 'QUEENSLAND' THEN 'QLD'
      WHEN 'SA' THEN 'SA'
      WHEN 'SOUTH AUSTRALIA' THEN 'SA'
      WHEN 'TAS' THEN 'TAS'
      WHEN 'TASMANIA' THEN 'TAS'
      WHEN 'VIC' THEN 'VIC'
      WHEN 'VICTORIA' THEN 'VIC'
      WHEN 'WA' THEN 'WA'
      WHEN 'WESTERN AUSTRALIA' THEN 'WA'
      ELSE NULL
    END AS state_code
  FROM public."Track" track
),
raw_state_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'rawState', inventory.raw_state,
        'canonicalState', inventory.state_code,
        'tracks', inventory.tracks
      ) ORDER BY inventory.raw_state
    ),
    '[]'::jsonb
  ) AS value
  FROM (
    SELECT raw_state, state_code, COUNT(*) AS tracks
    FROM track_jurisdictions
    GROUP BY raw_state, state_code
  ) inventory
),
meeting_state_coverage AS (
  SELECT
    track.state_code,
    COUNT(*) AS meetings,
    COUNT(*) FILTER (
      WHERE meeting."sourceProvider" IS NULL OR meeting."sourceId" IS NULL
    ) AS missing_source_identity,
    MAX(meeting."lastSyncedAt") AS latest_sync
  FROM public."Meeting" meeting
  JOIN track_jurisdictions track ON track.track_id = meeting."trackId"
  GROUP BY track.state_code
),
race_state_base AS (
  SELECT
    race.id,
    track.state_code,
    race."raceTime",
    race."resultStatus",
    race."replayUrl",
    race."photoFinishUrl",
    race."sourceProvider",
    race."sourceId",
    race."lastSyncedAt"
  FROM public."Race" race
  JOIN public."Meeting" meeting ON meeting.id = race."meetingId"
  JOIN track_jurisdictions track ON track.track_id = meeting."trackId"
),
race_state_coverage AS (
  SELECT
    state_code,
    COUNT(*) AS races,
    MIN("raceTime") AS earliest_race,
    MAX("raceTime") AS latest_race,
    MAX("lastSyncedAt") AS latest_sync,
    COUNT(*) FILTER (WHERE "raceTime" < :'historical_cutoff'::timestamptz) AS historical_races,
    COUNT(*) FILTER (WHERE "raceTime" >= :'historical_cutoff'::timestamptz) AS current_races,
    COUNT(*) FILTER (WHERE "raceTime" > now()) AS future_races,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM("replayUrl"), '') IS NOT NULL) AS replay_references,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM("photoFinishUrl"), '') IS NOT NULL) AS photo_finish_references,
    COUNT(*) FILTER (
      WHERE "sourceProvider" IS NULL OR "sourceId" IS NULL
    ) AS missing_source_identity
  FROM race_state_base
  GROUP BY state_code
),
runner_state_coverage AS (
  SELECT
    race.state_code,
    COUNT(*) AS runners,
    COUNT(*) FILTER (WHERE runner.scratched) AS scratched,
    COUNT(*) FILTER (WHERE runner."trainerId" IS NULL) AS missing_trainer,
    COUNT(DISTINCT runner."dogId") AS dogs,
    COUNT(DISTINCT runner."trainerId") AS trainers
  FROM public."Runner" runner
  JOIN race_state_base race ON race.id = runner."raceId"
  GROUP BY race.state_code
),
result_state_coverage AS (
  SELECT
    race.state_code,
    COUNT(*) AS results,
    COUNT(*) FILTER (WHERE result."runningTime" IS NOT NULL) AS with_running_time,
    COUNT(*) FILTER (WHERE result."splitTime" IS NOT NULL) AS with_split_time,
    COUNT(*) FILTER (WHERE result.sectionals IS NOT NULL) AS with_sectionals,
    COUNT(*) FILTER (
      WHERE result."finishingPosition" IS NOT NULL
        AND result."finishingPosition" < 1
    ) AS invalid_finishing_positions,
    COUNT(*) FILTER (WHERE result."runningTime" < 0 OR result."splitTime" < 0) AS invalid_times,
    COUNT(*) FILTER (
      WHERE result."sourceProvider" IS NULL OR result."sourceId" IS NULL
    ) AS missing_source_identity
  FROM public."Result" result
  JOIN public."Runner" runner ON runner.id = result."runnerId"
  JOIN race_state_base race ON race.id = runner."raceId"
  GROUP BY race.state_code
),
form_state_coverage AS (
  SELECT
    COALESCE(track.state_code, race.state_code) AS state_code,
    COUNT(*) AS form_entries,
    COUNT(*) FILTER (WHERE form."raceId" IS NOT NULL) AS race_linked_entries,
    COUNT(*) FILTER (WHERE form."trackId" IS NOT NULL) AS track_linked_entries
  FROM public."FormEntry" form
  LEFT JOIN track_jurisdictions track ON track.track_id = form."trackId"
  LEFT JOIN race_state_base race ON race.id = form."raceId"
  GROUP BY COALESCE(track.state_code, race.state_code)
),
video_per_race AS (
  SELECT
    video."raceId",
    COUNT(*) AS video_rows,
    BOOL_OR(
      NULLIF(BTRIM(video."streamUrl"), '') IS NOT NULL
      OR LOWER(COALESCE(video."sourceProvider", '')) IN (
        'greyhoundswa', 'racing-queensland', 'tasracing', 'thedogs'
      )
      OR LOWER(COALESCE(video."embedSourceType", '')) IN (
        'race-replay', 'racing-queensland', 'tasracing-hls', 'vimeo', 'youtube'
      )
      OR video."pageUrl" ~* '(youtube\\.com|youtu\\.be|vimeo\\.com)'
    ) AS has_resolvable_shape
  FROM public."RaceVideo" video
  GROUP BY video."raceId"
),
video_state_coverage AS (
  SELECT
    race.state_code,
    COUNT(*) AS video_rows,
    COUNT(DISTINCT video."raceId") AS races_with_video,
    COUNT(*) FILTER (
      WHERE NULLIF(BTRIM(video."streamUrl"), '') IS NOT NULL
    ) AS stored_stream_rows,
    COUNT(*) FILTER (
      WHERE NULLIF(BTRIM(video."streamUrl"), '') IS NOT NULL
      OR LOWER(COALESCE(video."sourceProvider", '')) IN (
        'greyhoundswa', 'racing-queensland', 'tasracing', 'thedogs'
      )
      OR LOWER(COALESCE(video."embedSourceType", '')) IN (
        'race-replay', 'racing-queensland', 'tasracing-hls', 'vimeo', 'youtube'
      )
      OR video."pageUrl" ~* '(youtube\\.com|youtu\\.be|vimeo\\.com)'
    ) AS resolvable_shape_rows,
    COUNT(*) FILTER (
      WHERE video."sourceStatus" IS NOT NULL
        AND (video."sourceStatus" < 200 OR video."sourceStatus" >= 400)
    ) AS failed_source_status_rows,
    COUNT(*) FILTER (
      WHERE NULLIF(BTRIM(video."sourceProvider"), '') IS NULL
        OR NULLIF(BTRIM(video."sourceId"), '') IS NULL
        OR NULLIF(BTRIM(video."pageUrl"), '') IS NULL
    ) AS incomplete_rows
  FROM public."RaceVideo" video
  JOIN race_state_base race ON race.id = video."raceId"
  GROUP BY race.state_code
),
race_result_rows AS (
  SELECT
    race.id,
    race.state_code,
    race."raceTime",
    race."resultStatus",
    COUNT(runner.id) FILTER (WHERE NOT runner.scratched) AS expected_results,
    COUNT(result.id) FILTER (WHERE NOT runner.scratched) AS actual_results
  FROM race_state_base race
  LEFT JOIN public."Runner" runner ON runner."raceId" = race.id
  LEFT JOIN public."Result" result ON result."runnerId" = runner.id
  GROUP BY race.id, race.state_code, race."raceTime", race."resultStatus"
),
result_completeness AS (
  SELECT
    state_code,
    COUNT(*) FILTER (
      WHERE expected_results > 0 AND actual_results > 0 AND actual_results < expected_results
    ) AS partial_result_races,
    COUNT(*) FILTER (
      WHERE expected_results > 0
        AND actual_results = 0
        AND "raceTime" < now() - interval '6 hours'
        AND LOWER(COALESCE("resultStatus", '')) NOT IN (
          'abandoned', 'cancelled', 'canceled', 'postponed', 'no race'
        )
    ) AS overdue_result_races,
    COUNT(*) FILTER (WHERE actual_results > expected_results) AS result_overflow_races
  FROM race_result_rows
  GROUP BY state_code
),
jurisdiction_inventory AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'state', jurisdiction.state_code,
      'tracks', COALESCE(track_counts.tracks, 0),
      'meetings', COALESCE(meeting.meetings, 0),
      'races', COALESCE(race.races, 0),
      'historicalRaces', COALESCE(race.historical_races, 0),
      'currentRaces', COALESCE(race.current_races, 0),
      'futureRaces', COALESCE(race.future_races, 0),
      'earliestRaceTime', race.earliest_race,
      'latestRaceTime', race.latest_race,
      'latestSourceSync', GREATEST(meeting.latest_sync, race.latest_sync),
      'runners', COALESCE(runner.runners, 0),
      'scratchedRunners', COALESCE(runner.scratched, 0),
      'dogs', COALESCE(runner.dogs, 0),
      'trainers', COALESCE(runner.trainers, 0),
      'runnerTrainerMissing', COALESCE(runner.missing_trainer, 0),
      'results', COALESCE(result.results, 0),
      'resultsWithRunningTime', COALESCE(result.with_running_time, 0),
      'resultsWithSplitTime', COALESCE(result.with_split_time, 0),
      'resultsWithSectionals', COALESCE(result.with_sectionals, 0),
      'invalidResultPositions', COALESCE(result.invalid_finishing_positions, 0),
      'invalidResultTimes', COALESCE(result.invalid_times, 0),
      'formEntries', COALESCE(form.form_entries, 0),
      'raceLinkedFormEntries', COALESCE(form.race_linked_entries, 0),
      'trackLinkedFormEntries', COALESCE(form.track_linked_entries, 0),
      'raceReplayReferences', COALESCE(race.replay_references, 0),
      'photoFinishReferences', COALESCE(race.photo_finish_references, 0),
      'raceVideoRows', COALESCE(video.video_rows, 0),
      'racesWithVideoRows', COALESCE(video.races_with_video, 0),
      'storedReplayStreams', COALESCE(video.stored_stream_rows, 0),
      'resolvableReplayRows', COALESCE(video.resolvable_shape_rows, 0),
      'failedReplaySourceStatuses', COALESCE(video.failed_source_status_rows, 0),
      'incompleteReplayRows', COALESCE(video.incomplete_rows, 0),
      'missingMeetingSourceIdentity', COALESCE(meeting.missing_source_identity, 0),
      'missingRaceSourceIdentity', COALESCE(race.missing_source_identity, 0),
      'missingResultSourceIdentity', COALESCE(result.missing_source_identity, 0),
      'partialResultRaces', COALESCE(completeness.partial_result_races, 0),
      'overdueResultRaces', COALESCE(completeness.overdue_result_races, 0),
      'resultOverflowRaces', COALESCE(completeness.result_overflow_races, 0)
    ) ORDER BY jurisdiction.state_code
  ) AS value
  FROM canonical_jurisdictions jurisdiction
  LEFT JOIN (
    SELECT state_code, COUNT(*) AS tracks
    FROM track_jurisdictions
    GROUP BY state_code
  ) track_counts USING (state_code)
  LEFT JOIN meeting_state_coverage meeting USING (state_code)
  LEFT JOIN race_state_coverage race USING (state_code)
  LEFT JOIN runner_state_coverage runner USING (state_code)
  LEFT JOIN result_state_coverage result USING (state_code)
  LEFT JOIN form_state_coverage form USING (state_code)
  LEFT JOIN video_state_coverage video USING (state_code)
  LEFT JOIN result_completeness completeness USING (state_code)
),
duplicate_inventory AS (
  SELECT jsonb_build_object(
    'meetingSourceIdentity', (
      SELECT jsonb_build_object(
        'groups', COUNT(*),
        'extraRows', COALESCE(SUM(rows - 1), 0)
      )
      FROM (
        SELECT COUNT(*) AS rows
        FROM public."Meeting"
        WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
        GROUP BY "sourceProvider", "sourceId"
        HAVING COUNT(*) > 1
      ) duplicates
    ),
    'raceSourceIdentity', (
      SELECT jsonb_build_object(
        'groups', COUNT(*),
        'extraRows', COALESCE(SUM(rows - 1), 0)
      )
      FROM (
        SELECT COUNT(*) AS rows
        FROM public."Race"
        WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
        GROUP BY "sourceProvider", "sourceId"
        HAVING COUNT(*) > 1
      ) duplicates
    ),
    'runnerSourceIdentityWithinRace', (
      SELECT jsonb_build_object(
        'groups', COUNT(*),
        'extraRows', COALESCE(SUM(rows - 1), 0)
      )
      FROM (
        SELECT COUNT(*) AS rows
        FROM public."Runner"
        WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
        GROUP BY "raceId", "sourceProvider", "sourceId"
        HAVING COUNT(*) > 1
      ) duplicates
    ),
    'runnerDogIdentityWithinRace', (
      SELECT jsonb_build_object(
        'groups', COUNT(*),
        'extraRows', COALESCE(SUM(rows - 1), 0)
      )
      FROM (
        SELECT COUNT(*) AS rows
        FROM public."Runner"
        GROUP BY "raceId", "dogId"
        HAVING COUNT(*) > 1
      ) duplicates
    ),
    'resultSourceIdentityWithinRace', (
      SELECT jsonb_build_object(
        'groups', COUNT(*),
        'extraRows', COALESCE(SUM(rows - 1), 0)
      )
      FROM (
        SELECT COUNT(*) AS rows
        FROM public."Result"
        WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
        GROUP BY "raceId", "sourceProvider", "sourceId"
        HAVING COUNT(*) > 1
      ) duplicates
    ),
    'raceVideoSourceIdentity', (
      SELECT jsonb_build_object(
        'groups', COUNT(*),
        'extraRows', COALESCE(SUM(rows - 1), 0)
      )
      FROM (
        SELECT COUNT(*) AS rows
        FROM public."RaceVideo"
        WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
        GROUP BY "sourceProvider", "sourceId"
        HAVING COUNT(*) > 1
      ) duplicates
    )
  ) AS value
),
relationship_quality AS (
  SELECT jsonb_build_object(
    'invalidTrackStates', (
      SELECT COUNT(*) FROM track_jurisdictions WHERE state_code IS NULL
    ),
    'blankTrackNames', (
      SELECT COUNT(*) FROM public."Track" WHERE NULLIF(BTRIM(name), '') IS NULL
    ),
    'blankDogNames', (
      SELECT COUNT(*) FROM public."Dog" WHERE NULLIF(BTRIM(name), '') IS NULL
    ),
    'blankTrainerNames', (
      SELECT COUNT(*) FROM public."Trainer" WHERE NULLIF(BTRIM(name), '') IS NULL
    ),
    'partialDogSourceIdentity', (
      SELECT COUNT(*) FROM public."Dog"
      WHERE ("sourceProvider" IS NULL) <> ("sourceId" IS NULL)
    ),
    'resultRaceMismatches', (
      SELECT COUNT(*)
      FROM public."Result" result
      JOIN public."Runner" runner ON runner.id = result."runnerId"
      WHERE result."raceId" <> runner."raceId"
    ),
    'formRaceOrphans', (
      SELECT COUNT(*)
      FROM public."FormEntry" form
      LEFT JOIN public."Race" race ON race.id = form."raceId"
      WHERE form."raceId" IS NOT NULL AND race.id IS NULL
    ),
    'formDogRaceMismatches', (
      SELECT COUNT(*)
      FROM public."FormEntry" form
      WHERE form."raceId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public."Runner" runner
          WHERE runner."raceId" = form."raceId"
            AND runner."dogId" = form."dogId"
        )
    )
  ) AS value
),
replay_provider_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'state', inventory.state_code,
        'sourceProvider', inventory.source_provider,
        'embedSourceType', inventory.embed_source_type,
        'kind', inventory.kind,
        'pageHost', inventory.page_host,
        'rows', inventory.rows,
        'storedStreams', inventory.stored_streams,
        'failedSourceStatuses', inventory.failed_source_statuses
      ) ORDER BY inventory.state_code, inventory.source_provider,
                 inventory.embed_source_type, inventory.kind, inventory.page_host
    ),
    '[]'::jsonb
  ) AS value
  FROM (
    SELECT
      race.state_code,
      video."sourceProvider" AS source_provider,
      video."embedSourceType" AS embed_source_type,
      video.kind,
      LOWER(SUBSTRING(video."pageUrl" FROM '^https?://([^/]+)')) AS page_host,
      COUNT(*) AS rows,
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(video."streamUrl"), '') IS NOT NULL) AS stored_streams,
      COUNT(*) FILTER (
        WHERE video."sourceStatus" IS NOT NULL
          AND (video."sourceStatus" < 200 OR video."sourceStatus" >= 400)
      ) AS failed_source_statuses
    FROM public."RaceVideo" video
    JOIN race_state_base race ON race.id = video."raceId"
    GROUP BY race.state_code, video."sourceProvider", video."embedSourceType",
             video.kind, LOWER(SUBSTRING(video."pageUrl" FROM '^https?://([^/]+)'))
  ) inventory
),
replay_year_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'state', inventory.state_code,
        'year', inventory.race_year,
        'races', inventory.races,
        'raceReplayReferences', inventory.replay_references,
        'racesWithVideoRows', inventory.races_with_video,
        'racesWithResolvableVideoRows', inventory.races_with_resolvable_video,
        'videoRows', inventory.video_rows
      ) ORDER BY inventory.state_code, inventory.race_year
    ),
    '[]'::jsonb
  ) AS value
  FROM (
    SELECT
      race.state_code,
      EXTRACT(YEAR FROM race."raceTime")::integer AS race_year,
      COUNT(*) AS races,
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(race."replayUrl"), '') IS NOT NULL) AS replay_references,
      COUNT(*) FILTER (WHERE video.video_rows > 0) AS races_with_video,
      COUNT(*) FILTER (WHERE video.has_resolvable_shape) AS races_with_resolvable_video,
      COALESCE(SUM(video.video_rows), 0) AS video_rows
    FROM race_state_base race
    LEFT JOIN video_per_race video ON video."raceId" = race.id
    GROUP BY race.state_code, EXTRACT(YEAR FROM race."raceTime")
  ) inventory
),
pedigree_coverage AS (
  SELECT jsonb_build_object(
    'withSire', COUNT(*) FILTER (WHERE "sireId" IS NOT NULL),
    'withDam', COUNT(*) FILTER (WHERE "damId" IS NOT NULL),
    'withBothParents', COUNT(*) FILTER (
      WHERE "sireId" IS NOT NULL AND "damId" IS NOT NULL
    ),
    'withProviderIdentity', COUNT(*) FILTER (
      WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
    ),
    'syntheticEarBrands', COUNT(*) FILTER (
      WHERE "earBrand" LIKE 'thedogs:%'
    ),
    'placeholderLikeNames', COUNT(*) FILTER (
      WHERE name ~ ' (NBT|[0-9]{1,2}\\.[0-9]{2})$'
    ),
    'selfSireLinks', COUNT(*) FILTER (WHERE id = "sireId"),
    'selfDamLinks', COUNT(*) FILTER (WHERE id = "damId")
  ) AS value
  FROM public."Dog"
),
sensitive_rls AS (
  SELECT jsonb_build_object(
    'sensitivePolicies', COUNT(*),
    'moderatorPredicates', COUNT(*) FILTER (
      WHERE COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
        LIKE '%giq_is_moderator()%'
    ),
    'adminPredicates', COUNT(*) FILTER (
      WHERE COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
        LIKE '%giq_is_admin()%'
    )
  ) AS value
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'giq_billing_customer_read',
      'giq_billing_customer_write',
      'giq_billing_event_read',
      'giq_billing_event_write',
      'giq_credit_note_read',
      'giq_credit_note_write',
      'giq_entitlement_snapshot_read',
      'giq_entitlement_snapshot_write',
      'giq_invoice_read',
      'giq_invoice_write',
      'giq_media_delete',
      'giq_media_select',
      'giq_media_update',
      'giq_payment_read',
      'giq_payment_write',
      'giq_plan_entitlement_write',
      'giq_plan_write',
      'giq_price_catalog_write',
      'giq_profile_update',
      'giq_refund_read',
      'giq_refund_write',
      'giq_subscription_read',
      'giq_subscription_write',
      'giq_usage_aggregate_read',
      'giq_usage_aggregate_write',
      'giq_usage_event_read',
      'giq_usage_event_write',
      'giq_usage_outbox_read',
      'giq_usage_outbox_write',
      'giq_user_select',
      'giq_user_update',
      'giq_webhook_event_system'
    )
),
sensitive_policy_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'command', cmd,
        'policy', policyname,
        'table', tablename
      ) ORDER BY tablename, policyname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'BillingCustomer',
      'BillingEvent',
      'CreditNoteRecord',
      'EntitlementSnapshot',
      'InvoiceRecord',
      'MediaAsset',
      'PaymentRecord',
      'Plan',
      'PlanEntitlement',
      'PriceCatalog',
      'Profile',
      'RefundRecord',
      'Subscription',
      'UsageAggregate',
      'UsageEvent',
      'UsageOutbox',
      'User',
      'WebhookEvent'
    )
)
SELECT jsonb_build_object(
    'auditKind', 'alloydb-production-read-only',
    'adminFunction', admin_function_inventory.value,
    'database', current_database(),
    'historicalCutoff', :'historical_cutoff',
    'catalog', catalog_inventory.value,
    'invalidConstraints', invalid_constraint_inventory.value,
    'clusterDatabases', cluster_database_inventory.value,
    'duplicates', duplicate_inventory.value,
    'jurisdictions', jurisdiction_inventory.value,
    'migrations', migration_inventory.value,
    'unfinishedMigrations', unfinished_migration_inventory.value,
    'pedigree', pedigree_coverage.value,
    'raceCoverage', race_coverage.value,
    'rawTrackStates', raw_state_inventory.value,
    'relationships', relationship_quality.value,
    'replayProviders', replay_provider_inventory.value,
    'replayYears', replay_year_inventory.value,
    'roles', role_inventory.value,
    'roleMemberships', role_memberships.value,
    'rowCounts', row_counts.value,
    'storageReferences', storage_reference_inventory.value,
    'sensitivePolicyInventory', sensitive_policy_inventory.value,
    'sensitiveRls', sensitive_rls.value
  )
FROM catalog_inventory
CROSS JOIN admin_function_inventory
CROSS JOIN cluster_database_inventory
CROSS JOIN duplicate_inventory
CROSS JOIN invalid_constraint_inventory
CROSS JOIN jurisdiction_inventory
CROSS JOIN migration_inventory
CROSS JOIN unfinished_migration_inventory
CROSS JOIN pedigree_coverage
CROSS JOIN race_coverage
CROSS JOIN raw_state_inventory
CROSS JOIN relationship_quality
CROSS JOIN replay_provider_inventory
CROSS JOIN replay_year_inventory
CROSS JOIN role_inventory
CROSS JOIN role_memberships
CROSS JOIN row_counts
CROSS JOIN storage_reference_inventory
CROSS JOIN sensitive_policy_inventory
CROSS JOIN sensitive_rls;
SQL

printf 'PRODUCTION_DB_READ_ONLY_AUDIT_COMPLETE database=%s\n' "$EXPECTED_DATABASE"
