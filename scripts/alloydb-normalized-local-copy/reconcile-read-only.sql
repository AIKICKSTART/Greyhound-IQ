\set ON_ERROR_STOP on

\if :{?GIQ_SNAPSHOT_EXPORT}
\else
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30min';
SET LOCAL lock_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL extra_float_digits = 3;
\endif

WITH RECURSIVE
required_states(state) AS (
  VALUES ('ACT'), ('NSW'), ('NT'), ('QLD'), ('SA'), ('TAS'), ('VIC'), ('WA')
),
nz_tracks(name) AS (
  VALUES
    ('ashburton'), ('auckland'), ('cambridge'), ('christchurch'),
    ('manawatu'), ('manukau'), ('otago'), ('palmerston - north'), ('palmerston north'),
    ('southland'), ('taranaki'), ('tokoroa'), ('waikato'),
    ('wanganui'), ('wellington')
),
normalized_tracks AS MATERIALIZED (
  SELECT
    track.id,
    track.name AS source_name,
    upper(btrim(track.state)) AS source_state,
    CASE
      WHEN lower(btrim(track.name)) = 'canberra' THEN 'ACT'
      WHEN lower(btrim(track.name)) IN (SELECT name FROM nz_tracks) THEN 'NZ'
      ELSE upper(btrim(track.state))
    END AS canonical_state,
    CASE
      WHEN lower(btrim(track.name)) IN ('meadows', 'the meadows')
        THEN 'The Meadows'
      WHEN lower(btrim(track.name)) IN ('palmerston - north', 'palmerston north')
        THEN 'Palmerston North'
      ELSE btrim(track.name)
    END AS canonical_name,
    lower(btrim(track.name)) = 'greyhoundiq demo park' AS excluded_synthetic
  FROM public."Track" track
),
state_coverage AS MATERIALIZED (
  SELECT
    required.state,
    count(DISTINCT track.id) AS tracks,
    count(DISTINCT meeting.id) AS meetings,
    count(DISTINCT race.id) AS races,
    count(DISTINCT runner.id) AS runners,
    count(DISTINCT result.id) AS results,
    count(DISTINCT video.id) AS race_videos,
    min(race."raceTime") AS min_race_time,
    max(race."raceTime") AS max_race_time
  FROM required_states required
  LEFT JOIN normalized_tracks track
    ON track.canonical_state = required.state
   AND NOT track.excluded_synthetic
  LEFT JOIN public."Meeting" meeting ON meeting."trackId" = track.id
  LEFT JOIN public."Race" race ON race."meetingId" = meeting.id
  LEFT JOIN public."Runner" runner ON runner."raceId" = race.id
  LEFT JOIN public."Result" result ON result."runnerId" = runner.id
  LEFT JOIN public."RaceVideo" video ON video."raceId" = race.id
  GROUP BY required.state
),
special_jurisdiction_coverage AS MATERIALIZED (
  SELECT
    track.canonical_state AS jurisdiction,
    count(DISTINCT track.id) AS tracks,
    count(DISTINCT meeting.id) AS meetings,
    count(DISTINCT race.id) AS races
  FROM normalized_tracks track
  LEFT JOIN public."Meeting" meeting ON meeting."trackId" = track.id
  LEFT JOIN public."Race" race ON race."meetingId" = meeting.id
  WHERE track.canonical_state IN ('ACT', 'NZ')
  GROUP BY track.canonical_state
),
race_video_partition AS MATERIALIZED (
  SELECT
    count(*) AS total,
    count(*) FILTER (
      WHERE nullif(btrim("sourceProvider"), '') IS NOT NULL
        AND nullif(btrim("sourceId"), '') IS NOT NULL
        AND nullif(btrim("pageUrl"), '') IS NOT NULL
        AND "pageUrl" !~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
    ) AS recognized,
    count(*) FILTER (
      WHERE nullif(btrim("sourceProvider"), '') IS NULL
         OR nullif(btrim("sourceId"), '') IS NULL
         OR nullif(btrim("pageUrl"), '') IS NULL
         OR "pageUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
    ) AS quarantined,
    count(*) FILTER (WHERE "pageUrl" ~* '/videos/watch/races/[^/?#]+/replay([/?#]|$)') AS race_level,
    count(*) FILTER (WHERE "pageUrl" ~* '/meetings?/.*preview') AS meeting_preview,
    count(*) FILTER (WHERE "pageUrl" ~* '/(live[-_/]?meetings?|meetings?/live)') AS live_meeting,
    count(*) FILTER (WHERE "pageUrl" ~* '/races?/.*preview') AS race_preview
  FROM public."RaceVideo"
),
photo_finish_partition AS MATERIALIZED (
  SELECT
    count(*) FILTER (WHERE nullif(btrim("photoFinishUrl"), '') IS NOT NULL) AS populated,
    count(*) FILTER (
      WHERE "photoFinishUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
    ) AS unsafe
  FROM public."Race"
),
table_counts(name, rows) AS MATERIALIZED (
  VALUES
    ('Track', (SELECT count(*) FROM public."Track")),
    ('Trainer', (SELECT count(*) FROM public."Trainer")),
    ('Dog', (SELECT count(*) FROM public."Dog")),
    ('Meeting', (SELECT count(*) FROM public."Meeting")),
    ('Race', (SELECT count(*) FROM public."Race")),
    ('RaceVideo', (SELECT count(*) FROM public."RaceVideo")),
    ('Runner', (SELECT count(*) FROM public."Runner")),
    ('Result', (SELECT count(*) FROM public."Result")),
    ('FormEntry', (SELECT count(*) FROM public."FormEntry")),
    ('DogProfileForm', (SELECT count(*) FROM public."DogProfileForm")),
    ('DogProfileArchive', (SELECT count(*) FROM public."DogProfileArchive")),
    ('RaceDayArchive', (SELECT count(*) FROM public."RaceDayArchive")),
    ('PedigreeImportRun', (SELECT count(*) FROM public."PedigreeImportRun")),
    ('DogSourceIdentity', (SELECT count(*) FROM public."DogSourceIdentity")),
    ('PedigreeAssertion', (SELECT count(*) FROM public."PedigreeAssertion")),
    ('PedigreeMergeLedger', (SELECT count(*) FROM public."PedigreeMergeLedger"))
),
provider_counts AS MATERIALIZED (
  SELECT entity, provider, sum(rows)::bigint AS rows
  FROM (
    SELECT 'Dog'::text AS entity, coalesce(nullif(lower(btrim("sourceProvider")), ''), '(none)') AS provider, count(*) AS rows FROM public."Dog" GROUP BY 2
    UNION ALL SELECT 'Meeting', coalesce(nullif(lower(btrim("sourceProvider")), ''), '(none)'), count(*) FROM public."Meeting" GROUP BY 2
    UNION ALL SELECT 'Race', coalesce(nullif(lower(btrim("sourceProvider")), ''), '(none)'), count(*) FROM public."Race" GROUP BY 2
    UNION ALL SELECT 'RaceVideo', coalesce(nullif(lower(btrim("sourceProvider")), ''), '(none)'), count(*) FROM public."RaceVideo" GROUP BY 2
    UNION ALL SELECT 'Runner', coalesce(nullif(lower(btrim("sourceProvider")), ''), '(none)'), count(*) FROM public."Runner" GROUP BY 2
    UNION ALL SELECT 'Result', coalesce(nullif(lower(btrim("sourceProvider")), ''), '(none)'), count(*) FROM public."Result" GROUP BY 2
    UNION ALL SELECT 'DogProfileForm', lower(btrim("sourceProvider")), count(*) FROM public."DogProfileForm" GROUP BY 2
    UNION ALL SELECT 'DogProfileArchive', lower(btrim("sourceProvider")), count(*) FROM public."DogProfileArchive" GROUP BY 2
    UNION ALL SELECT 'RaceDayArchive', lower(btrim("sourceProvider")), count(*) FROM public."RaceDayArchive" GROUP BY 2
    UNION ALL SELECT 'PedigreeImportRun', lower(btrim("sourceProvider")), count(*) FROM public."PedigreeImportRun" GROUP BY 2
    UNION ALL SELECT 'DogSourceIdentity', lower(btrim("sourceProvider")), count(*) FROM public."DogSourceIdentity" GROUP BY 2
    UNION ALL SELECT 'PedigreeAssertion', lower(btrim("sourceProvider")), count(*) FROM public."PedigreeAssertion" GROUP BY 2
    UNION ALL SELECT 'PedigreeMergeLedger', lower(btrim("sourceProvider")), count(*) FROM public."PedigreeMergeLedger" GROUP BY 2
  ) inventory
  GROUP BY entity, provider
),
trainer_identity_crosswalk AS MATERIALIZED (
  SELECT
    normalized.target_id AS candidate_trainer_id,
    'r2-source-trainer-id'::text AS identity_kind,
    map.source_id AS identity_value
  FROM _giq_history_stage.trainer_map map
  JOIN _giq_history_stage.normalized_trainer normalized
    ON normalized.natural_key = map.natural_key
  WHERE map.source_name = 'r2'
  UNION
  SELECT
    normalized.target_id,
    'thedogs-provider-id',
    normalized.source_id
  FROM _giq_history_stage.normalized_trainer normalized
  WHERE lower(normalized.source_provider) = 'thedogs'
    AND nullif(btrim(normalized.source_id), '') IS NOT NULL
  UNION
  SELECT
    runner."trainerId",
    'thedogs-provider-id',
    _giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId'
  FROM public."Runner" runner
  WHERE lower(coalesce(runner."sourceProvider", '')) = 'thedogs'
    AND runner."trainerId" IS NOT NULL
    AND nullif(_giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId', '') IS NOT NULL
),
trainer_identity_coverage AS MATERIALIZED (
  SELECT
    count(*) AS candidate_trainers,
    count(*) FILTER (WHERE identity.candidate_trainer_id IS NOT NULL) AS trainers_with_exact_identity,
    count(*) FILTER (WHERE identity.candidate_trainer_id IS NULL) AS unresolved_trainers
  FROM public."Trainer" trainer
  LEFT JOIN (
    SELECT DISTINCT candidate_trainer_id FROM trainer_identity_crosswalk
  ) identity ON identity.candidate_trainer_id = trainer.id
),
thedogs_local_identity_crosswalk AS MATERIALIZED (
  SELECT
    source.id AS local_r2_dog_id,
    substring(source."earBrand" FROM 9) AS provider_source_id,
    map.target_id AS candidate_dog_id,
    candidate.id IS NOT NULL
      AND lower(candidate."sourceProvider") = 'thedogs'
      AND candidate."sourceId" = substring(source."earBrand" FROM 9)
      AS candidate_identity_matches,
    candidate."earBrand" ~ '^thedogs:[0-9]+$' AS synthetic_ear_brand_remains
  FROM _giq_history_stage."r2_Dog" source
  LEFT JOIN _giq_history_stage.dog_map map
    ON map.source_name = 'r2'
   AND map.source_id = source.id
  LEFT JOIN public."Dog" candidate ON candidate.id = map.target_id
  WHERE source."earBrand" ~ '^thedogs:[0-9]+$'
),
thedogs_local_identity_summary AS MATERIALIZED (
  SELECT
    count(*) AS local_synthetic_identities,
    count(DISTINCT local_r2_dog_id) AS distinct_local_dog_ids,
    count(DISTINCT provider_source_id) AS distinct_provider_source_ids,
    count(DISTINCT candidate_dog_id) AS distinct_candidate_dog_ids,
    count(*) FILTER (WHERE candidate_identity_matches) AS exact_candidate_matches,
    count(*) FILTER (WHERE synthetic_ear_brand_remains) AS candidate_synthetic_ear_brands
  FROM thedogs_local_identity_crosswalk
),
thedogs_dogs AS MATERIALIZED (
  SELECT dog.id
  FROM public."Dog" dog
  WHERE (
      lower(coalesce(dog."sourceProvider", '')) = 'thedogs'
      AND nullif(btrim(dog."sourceId"), '') IS NOT NULL
    )
    OR dog."earBrand" LIKE 'thedogs:%'
),
profiled_dogs AS MATERIALIZED (
  SELECT DISTINCT archive."dogId" AS id
  FROM public."DogProfileArchive" archive
  WHERE archive."dogId" IS NOT NULL
),
race_observed_dogs AS MATERIALIZED (
  SELECT runner."dogId" AS id FROM public."Runner" runner
  UNION
  SELECT form."dogId" AS id FROM public."FormEntry" form
  UNION
  SELECT form."dogId" AS id FROM public."DogProfileForm" form
),
parent_stub_dogs AS MATERIALIZED (
  SELECT dog."sireId" AS id FROM public."Dog" dog WHERE dog."sireId" IS NOT NULL
  UNION
  SELECT dog."damId" AS id FROM public."Dog" dog WHERE dog."damId" IS NOT NULL
),
dog_verification_classes AS MATERIALIZED (
  SELECT
    count(*) FILTER (WHERE profile.id IS NOT NULL) AS full_profile,
    count(*) FILTER (
      WHERE profile.id IS NULL AND observed.id IS NOT NULL
    ) AS race_observed,
    count(*) FILTER (
      WHERE profile.id IS NULL AND observed.id IS NULL AND stub.id IS NOT NULL
    ) AS provider_stub,
    count(*) FILTER (
      WHERE profile.id IS NULL AND observed.id IS NULL AND stub.id IS NULL
    ) AS unclassified,
    count(*) AS total
  FROM thedogs_dogs dog
  LEFT JOIN profiled_dogs profile ON profile.id = dog.id
  LEFT JOIN race_observed_dogs observed ON observed.id = dog.id
  LEFT JOIN parent_stub_dogs stub ON stub.id = dog.id
),
profile_form_partition AS MATERIALIZED (
  SELECT
    count(*) AS total,
    count(*) FILTER (
      WHERE "raceUrl" ~ '^/racing/[^?#]+/?$'
        AND "raceUrl" !~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
    ) AS canonical_total,
    count(*) FILTER (
      WHERE "raceUrl" ~ '^/racing/[^?#]+/?$'
        AND "raceUrl" !~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
        AND lower(coalesce("trackName", '')) = 'temora'
        AND date::date = DATE '2008-10-19'
        AND "raceUrl" = '/racing/temora/2008-10-19/3/'
        AND "sourceId" = '/racing/temora/2008-10-19/3?trial=false'
    ) AS recovered,
    count(*) FILTER (
      WHERE "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
    ) AS quarantined,
    count(*) FILTER (
      WHERE "raceUrl" !~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
        AND "raceUrl" !~ '^/racing/[^?#]+/?$'
    ) AS other_shape
  FROM public."DogProfileForm"
),
profile_form_source_coverage AS MATERIALIZED (
  SELECT
    count(*) FILTER (WHERE resolution.url_class = 'canonical-racing-url') AS canonical_source_rows,
    count(*) FILTER (
      WHERE resolution.url_class = 'canonical-racing-url'
        AND resolution.race_id IS NULL
    ) AS canonical_unresolved_race_rows,
    count(*) FILTER (
      WHERE resolution.url_class = 'dog-url-recovery-only'
    ) AS excluded_dog_url_rows,
    count(*) FILTER (
      WHERE resolution.url_class = 'canonical-racing-url'
        AND resolution.dog_id IS NULL
    ) AS canonical_dog_unresolved_rows,
    count(*) FILTER (WHERE resolution.url_class = 'canonical-racing-url')
      - count(DISTINCT (
          resolution.dog_id,
          resolution.payload->>'sourceId'
        )) FILTER (WHERE resolution.url_class = 'canonical-racing-url')
      AS canonical_duplicate_identity_rows,
    count(*) FILTER (
      WHERE resolution.url_class = 'canonical-racing-url'
        AND NOT EXISTS (
          SELECT 1
          FROM public."DogProfileForm" target
          WHERE target."dogId" = resolution.dog_id
            AND lower(target."sourceProvider") = 'thedogs'
            AND target."sourceId" = resolution.payload->>'sourceId'
        )
    ) AS canonical_missing_from_public,
    count(*) FILTER (
      WHERE resolution.url_class = 'canonical-racing-url'
        AND resolution.race_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public."DogProfileForm" target
          WHERE target."dogId" = resolution.dog_id
            AND lower(target."sourceProvider") = 'thedogs'
            AND target."sourceId" = resolution.payload->>'sourceId'
        )
    ) AS canonical_unresolved_missing_from_public
  FROM _giq_history_stage.profile_form_resolution resolution
),
thedogs_pedigree_classification AS MATERIALIZED (
  SELECT
    assertion.id,
    CASE
      WHEN assertion."subjectIdentityId" = assertion."parentIdentityId"
        OR (
          subject."dogId" IS NOT NULL
          AND subject."dogId" = parent."dogId"
        ) THEN 'rejected-self'
      WHEN EXISTS (
        SELECT 1 FROM public."PedigreeMergeLedger" ledger
        WHERE ledger."assertionId" = assertion.id
          AND ledger.decision = 'preserved_higher_authority'
      ) THEN 'replaced'
      WHEN assertion."verificationStatus" IN ('verified', 'source-verified', 'verified-exact-crosswalk') AND EXISTS (
        SELECT 1 FROM public."PedigreeMergeLedger" ledger
        WHERE ledger."assertionId" = assertion.id
          AND ledger.decision IN ('accepted', 'no_change', 'applied', 'verified-existing')
          AND ledger."verificationStatus" = 'verified'
      ) THEN 'verified'
      WHEN assertion."verificationStatus" ~* '(conflict|reject|quarantin)' OR EXISTS (
        SELECT 1 FROM public."PedigreeMergeLedger" ledger
        WHERE ledger."assertionId" = assertion.id
          AND ledger.decision IN ('quarantined_conflict', 'rejected_ambiguous', 'rejected')
      ) THEN 'quarantined'
      ELSE 'pending'
    END AS class
  FROM public."PedigreeAssertion" assertion
  JOIN public."DogSourceIdentity" subject ON subject.id = assertion."subjectIdentityId"
  LEFT JOIN public."DogSourceIdentity" parent ON parent.id = assertion."parentIdentityId"
  WHERE lower(assertion."sourceProvider") = 'thedogs'
),
thedogs_pedigree_partition AS MATERIALIZED (
  SELECT
    count(*) AS staged,
    count(*) FILTER (WHERE class = 'rejected-self') AS rejected_self,
    count(*) FILTER (WHERE class = 'verified') AS verified,
    count(*) FILTER (WHERE class = 'replaced') AS replaced,
    count(*) FILTER (WHERE class = 'quarantined') AS quarantined,
    count(*) FILTER (WHERE class = 'pending') AS pending
  FROM thedogs_pedigree_classification
),
pedigree_providers(provider) AS MATERIALIZED (
  SELECT provider
  FROM (VALUES ('galtd'), ('greyhound-recorder'), ('fasttrack'), ('thedogs')) required(provider)
  UNION
  SELECT lower(btrim("sourceProvider")) FROM public."PedigreeImportRun"
  UNION
  SELECT lower(btrim("sourceProvider")) FROM public."DogSourceIdentity"
  UNION
  SELECT lower(btrim("sourceProvider")) FROM public."PedigreeAssertion"
  UNION
  SELECT lower(btrim("sourceProvider")) FROM public."PedigreeMergeLedger"
),
pedigree_provider_status AS MATERIALIZED (
  SELECT
    provider.provider,
    (SELECT count(*) FROM public."PedigreeImportRun" run
      WHERE lower(btrim(run."sourceProvider")) = provider.provider) AS import_runs,
    (SELECT count(*) FROM public."DogSourceIdentity" identity
      WHERE lower(btrim(identity."sourceProvider")) = provider.provider) AS identities,
    (SELECT count(*) FROM public."PedigreeAssertion" assertion
      WHERE lower(btrim(assertion."sourceProvider")) = provider.provider) AS assertions,
    (SELECT count(*) FROM public."PedigreeMergeLedger" ledger
      WHERE lower(btrim(ledger."sourceProvider")) = provider.provider) AS ledger_rows,
    coalesce((
      SELECT jsonb_object_agg(status, rows ORDER BY status)
      FROM (
        SELECT run."verificationStatus" AS status, count(*) AS rows
        FROM public."PedigreeImportRun" run
        WHERE lower(btrim(run."sourceProvider")) = provider.provider
        GROUP BY run."verificationStatus"
      ) grouped
    ), '{}'::jsonb) AS import_run_statuses,
    coalesce((
      SELECT jsonb_object_agg(status, rows ORDER BY status)
      FROM (
        SELECT identity."verificationStatus" AS status, count(*) AS rows
        FROM public."DogSourceIdentity" identity
        WHERE lower(btrim(identity."sourceProvider")) = provider.provider
        GROUP BY identity."verificationStatus"
      ) grouped
    ), '{}'::jsonb) AS identity_statuses,
    coalesce((
      SELECT jsonb_object_agg(status, rows ORDER BY status)
      FROM (
        SELECT assertion."verificationStatus" AS status, count(*) AS rows
        FROM public."PedigreeAssertion" assertion
        WHERE lower(btrim(assertion."sourceProvider")) = provider.provider
        GROUP BY assertion."verificationStatus"
      ) grouped
    ), '{}'::jsonb) AS assertion_statuses,
    coalesce((
      SELECT jsonb_object_agg(status, rows ORDER BY status)
      FROM (
        SELECT ledger."verificationStatus" AS status, count(*) AS rows
        FROM public."PedigreeMergeLedger" ledger
        WHERE lower(btrim(ledger."sourceProvider")) = provider.provider
        GROUP BY ledger."verificationStatus"
      ) grouped
    ), '{}'::jsonb) AS ledger_statuses,
    coalesce((
      SELECT jsonb_object_agg(decision, rows ORDER BY decision)
      FROM (
        SELECT ledger.decision, count(*) AS rows
        FROM public."PedigreeMergeLedger" ledger
        WHERE lower(btrim(ledger."sourceProvider")) = provider.provider
        GROUP BY ledger.decision
      ) grouped
    ), '{}'::jsonb) AS ledger_decisions
  FROM pedigree_providers provider
),
galtd_conflict_evidence AS MATERIALIZED (
  SELECT
    (check_row.metrics->>'conflictGroups')::bigint AS conflict_groups,
    (check_row.metrics->>'conflictObservations')::bigint AS conflict_observations,
    (SELECT count(*) FROM public."DogSourceIdentity"
      WHERE lower(btrim("sourceProvider")) = 'galtd'
        AND lower("verificationStatus") ~ '(conflict|quarantin|pending|unlinked)') AS identity_conflict_or_pending,
    (SELECT count(*) FROM public."PedigreeAssertion"
      WHERE lower(btrim("sourceProvider")) = 'galtd'
        AND lower("verificationStatus") ~ '(conflict|quarantin|pending|unlinked)') AS assertion_conflict_or_pending,
    (SELECT count(*) FROM public."PedigreeMergeLedger"
      WHERE lower(btrim("sourceProvider")) = 'galtd'
        AND (lower("verificationStatus") ~ '(conflict|quarantin|pending|unlinked)'
          OR lower(decision) ~ '(conflict|quarantin|reject|pending)')) AS ledger_conflict_or_pending
  FROM _giq_history_merge.verification_check check_row
  WHERE check_row.check_name = 'galtd_conflict_resolution'
),
source_natural_key_coverage AS MATERIALIZED (
  SELECT
    'Meeting'::text AS entity,
    source.source_name,
    coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)') AS provider,
    count(*)::bigint AS source_rows,
    count(DISTINCT source.natural_key)::bigint AS natural_keys,
    count(DISTINCT source.natural_key) FILTER (WHERE target.id IS NOT NULL)::bigint AS present_natural_keys
  FROM _giq_history_stage.meeting_source source
  LEFT JOIN _giq_history_stage.normalized_meeting normalized USING (natural_key)
  LEFT JOIN public."Meeting" target ON target.id = normalized.target_id
  GROUP BY source.source_name, coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)')
  UNION ALL
  SELECT
    'Race', source.source_name,
    coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)'),
    count(*)::bigint, count(DISTINCT source.natural_key)::bigint,
    count(DISTINCT source.natural_key) FILTER (WHERE target.id IS NOT NULL)::bigint
  FROM _giq_history_stage.race_source source
  LEFT JOIN _giq_history_stage.normalized_race normalized USING (natural_key)
  LEFT JOIN public."Race" target ON target.id = normalized.target_id
  GROUP BY source.source_name, coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)')
  UNION ALL
  SELECT
    'Runner', source.source_name,
    coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)'),
    count(*)::bigint, count(DISTINCT source.natural_key)::bigint,
    count(DISTINCT source.natural_key) FILTER (WHERE target.id IS NOT NULL)::bigint
  FROM _giq_history_stage.runner_source source
  LEFT JOIN _giq_history_stage.normalized_runner normalized USING (natural_key)
  LEFT JOIN public."Runner" target ON target.id = normalized.target_id
  GROUP BY source.source_name, coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)')
  UNION ALL
  SELECT
    'Result', source.source_name,
    coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)'),
    count(*)::bigint, count(DISTINCT source.natural_key)::bigint,
    count(DISTINCT source.natural_key) FILTER (WHERE target.id IS NOT NULL)::bigint
  FROM _giq_history_stage.result_source source
  LEFT JOIN _giq_history_stage.normalized_result normalized USING (natural_key)
  LEFT JOIN public."Result" target ON target.id = normalized.target_id
  GROUP BY source.source_name, coalesce(nullif(lower(btrim(source.source_provider)), ''), '(none)')
),
pedigree_edges(child_id, parent_id) AS MATERIALIZED (
  SELECT id, "sireId" FROM public."Dog" WHERE "sireId" IS NOT NULL
  UNION
  SELECT id, "damId" FROM public."Dog" WHERE "damId" IS NOT NULL
),
pedigree_walk(root_id, dog_id) AS (
  SELECT child_id, parent_id FROM pedigree_edges
  UNION
  SELECT walk.root_id, edge.parent_id
  FROM pedigree_walk walk
  JOIN pedigree_edges edge ON edge.child_id = walk.dog_id
),
checks AS MATERIALIZED (
  SELECT 'required_state_has_races'::text AS name,
         coalesce(sum((races = 0)::int), 0)::bigint AS failures,
         'blocker'::text AS severity
  FROM state_coverage
  UNION ALL
  SELECT 'required_state_has_results', coalesce(sum((results = 0)::int), 0), 'blocker' FROM state_coverage
  UNION ALL
  SELECT 'canberra_is_act', count(*), 'blocker'
  FROM normalized_tracks WHERE lower(btrim(source_name)) = 'canberra' AND source_state <> 'ACT'
  UNION ALL
  SELECT 'new_zealand_not_misclassified_as_au', count(*), 'blocker'
  FROM normalized_tracks
  WHERE canonical_state = 'NZ' AND source_state <> 'NZ'
  UNION ALL
  SELECT 'new_zealand_historical_coverage_exact',
         greatest(14 - coalesce(tracks, 0), 0)
           + greatest(3968 - coalesce(meetings, 0), 0)
           + greatest(42339 - coalesce(races, 0), 0),
         'blocker'
  FROM (VALUES (1)) singleton(value)
  LEFT JOIN special_jurisdiction_coverage coverage ON coverage.jurisdiction = 'NZ'
  UNION ALL
  SELECT 'act_historical_coverage_exact',
         greatest(536 - coalesce(meetings, 0), 0)
           + greatest(5681 - coalesce(races, 0), 0),
         'blocker'
  FROM (VALUES (1)) singleton(value)
  LEFT JOIN special_jurisdiction_coverage coverage ON coverage.jurisdiction = 'ACT'
  UNION ALL
  SELECT 'synthetic_demo_track_absent', count(*), 'blocker'
  FROM normalized_tracks WHERE excluded_synthetic
  UNION ALL
  SELECT 'canonical_track_key_unique', count(*), 'blocker'
  FROM (
    SELECT canonical_state, lower(canonical_name)
    FROM normalized_tracks
    WHERE NOT excluded_synthetic
    GROUP BY canonical_state, lower(canonical_name)
    HAVING count(*) > 1
  ) duplicate_track
  UNION ALL
  SELECT 'trainer_exact_identity_unique', count(*), 'blocker'
  FROM (
    SELECT identity_kind, identity_value
    FROM trainer_identity_crosswalk
    GROUP BY identity_kind, identity_value
    HAVING count(DISTINCT candidate_trainer_id) > 1
  ) ambiguous_identity
  UNION ALL
  SELECT 'trainer_provider_identity_unambiguous_per_candidate', count(*), 'blocker'
  FROM (
    SELECT candidate_trainer_id
    FROM trainer_identity_crosswalk
    WHERE identity_kind = 'thedogs-provider-id'
    GROUP BY candidate_trainer_id
    HAVING count(DISTINCT identity_value) > 1
  ) ambiguous_candidate
  UNION ALL
  SELECT 'trainer_exact_identity_coverage', unresolved_trainers, 'blocker'
  FROM trainer_identity_coverage
  UNION ALL
  SELECT 'thedogs_local_candidate_identity_one_to_one',
         abs(local_synthetic_identities - 198887)
           + abs(distinct_local_dog_ids - 198887)
           + abs(distinct_provider_source_ids - 198887)
           + abs(distinct_candidate_dog_ids - 198887)
           + abs(exact_candidate_matches - 198887)
           + candidate_synthetic_ear_brands,
         'blocker'
  FROM thedogs_local_identity_summary
  UNION ALL
  SELECT 'dog_has_stable_provider_identity', count(*), 'blocker'
  FROM public."Dog"
  WHERE nullif(btrim("earBrand"), '') IS NULL
    AND (
      nullif(btrim("sourceProvider"), '') IS NULL
      OR nullif(btrim("sourceId"), '') IS NULL
    )
  UNION ALL
  SELECT 'dog_provider_identity_unique', count(*), 'blocker'
  FROM (
    SELECT lower(btrim("sourceProvider")), btrim("sourceId")
    FROM public."Dog"
    WHERE nullif(btrim("sourceProvider"), '') IS NOT NULL
      AND nullif(btrim("sourceId"), '') IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) duplicate_dog
  UNION ALL
  SELECT 'dog_names_not_placeholder', count(*), 'blocker'
  FROM public."Dog"
  WHERE lower(btrim(name)) ~ '^(unknown|unnamed|n/?a|tba|tbd|placeholder|test dog|demo dog)([[:space:]-]+[0-9]+)?$'
  UNION ALL
  SELECT 'thedogs_identity_union_minimum', greatest(212391 - count(*), 0), 'blocker' FROM thedogs_dogs
  UNION ALL
  SELECT 'thedogs_full_profiles_minimum', greatest(170780 - full_profile, 0), 'blocker' FROM dog_verification_classes
  UNION ALL
  SELECT 'thedogs_identity_classified', unclassified, 'blocker' FROM dog_verification_classes
  UNION ALL
  SELECT 'meetings_have_tracks', count(*), 'blocker'
  FROM public."Meeting" meeting LEFT JOIN public."Track" track ON track.id = meeting."trackId" WHERE track.id IS NULL
  UNION ALL
  SELECT 'races_have_meetings', count(*), 'blocker'
  FROM public."Race" race LEFT JOIN public."Meeting" meeting ON meeting.id = race."meetingId" WHERE meeting.id IS NULL
  UNION ALL
  SELECT 'runners_have_races_and_dogs', count(*), 'blocker'
  FROM public."Runner" runner
  LEFT JOIN public."Race" race ON race.id = runner."raceId"
  LEFT JOIN public."Dog" dog ON dog.id = runner."dogId"
  WHERE race.id IS NULL OR dog.id IS NULL
  UNION ALL
  SELECT 'results_match_runner_race', count(*), 'blocker'
  FROM public."Result" result
  LEFT JOIN public."Runner" runner ON runner.id = result."runnerId"
  WHERE runner.id IS NULL OR result."raceId" <> runner."raceId"
  UNION ALL
  SELECT 'form_entries_have_canonical_race', count(*), 'blocker'
  FROM public."FormEntry" form
  LEFT JOIN public."Race" race ON race.id = form."raceId"
  WHERE form."raceId" IS NULL OR race.id IS NULL
  UNION ALL
  SELECT 'profile_forms_have_source_identity', count(*), 'blocker'
  FROM public."DogProfileForm"
  WHERE nullif(btrim("sourceProvider"), '') IS NULL OR nullif(btrim("sourceId"), '') IS NULL
  UNION ALL
  SELECT 'profile_form_race_url_is_not_dog_or_profile', count(*), 'blocker'
  FROM public."DogProfileForm"
  WHERE "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
  UNION ALL
  SELECT 'profile_form_race_url_is_race_identity', count(*), 'blocker'
  FROM public."DogProfileForm"
  WHERE "raceUrl" !~ '^/racing/[^?#]+/?$'
  UNION ALL
  SELECT 'canonical_race_provider_key_not_dog_url', count(*), 'blocker'
  FROM public."Race"
  WHERE "sourceId" ~* '(^|/)(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
  UNION ALL
  SELECT 'profile_form_race_url_has_no_secret', count(*), 'blocker'
  FROM public."DogProfileForm"
  WHERE "raceUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
  UNION ALL
  SELECT 'profile_form_canonical_source_partition_exact',
         abs(canonical_source_rows - 5904337)
           + abs(canonical_unresolved_race_rows - 444857)
           + abs(excluded_dog_url_rows - 314502),
         'blocker'
  FROM profile_form_source_coverage
  UNION ALL
  SELECT 'profile_form_canonical_source_dogs_resolved', canonical_dog_unresolved_rows, 'blocker'
  FROM profile_form_source_coverage
  UNION ALL
  SELECT 'profile_form_canonical_source_identity_unique', canonical_duplicate_identity_rows, 'blocker'
  FROM profile_form_source_coverage
  UNION ALL
  SELECT 'profile_form_all_canonical_source_rows_in_public', canonical_missing_from_public, 'blocker'
  FROM profile_form_source_coverage
  UNION ALL
  SELECT 'profile_form_unresolved_race_rows_in_public', canonical_unresolved_missing_from_public, 'blocker'
  FROM profile_form_source_coverage
  UNION ALL
  SELECT 'temora_slugless_race_identity_normalized_exact', abs(recovered - 8), 'blocker'
  FROM profile_form_partition
  UNION ALL
  SELECT 'profile_archives_link_to_dog', count(*), 'blocker'
  FROM public."DogProfileArchive" archive
  LEFT JOIN public."Dog" dog ON dog.id = archive."dogId"
  WHERE archive."dogId" IS NULL OR dog.id IS NULL
  UNION ALL
  SELECT 'race_videos_have_public_locator', count(*), 'blocker'
  FROM public."RaceVideo"
  WHERE nullif(btrim("pageUrl"), '') IS NULL
  UNION ALL
  SELECT 'race_video_page_url_has_no_secret', count(*), 'blocker'
  FROM public."RaceVideo"
  WHERE "pageUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
  UNION ALL
  SELECT 'photo_finish_not_stored_as_race_video', count(*), 'blocker'
  FROM public."RaceVideo"
  WHERE lower(kind) IN ('photo', 'photo-finish', 'photo_finish', 'photofinish')
  UNION ALL
  SELECT 'photo_finish_historical_minimum', greatest(248078 - populated, 0), 'blocker'
  FROM photo_finish_partition
  UNION ALL
  SELECT 'photo_finish_url_has_no_secret', unsafe, 'blocker'
  FROM photo_finish_partition
  UNION ALL
  SELECT 'race_level_replay_source_id_not_cross_race', count(*), 'blocker'
  FROM (
    SELECT lower("sourceProvider"), "sourceId"
    FROM public."RaceVideo"
    WHERE "pageUrl" ~* '/videos/watch/races/[^/?#]+/replay([/?#]|$)'
    GROUP BY 1, 2
    HAVING count(DISTINCT "raceId") > 1
  ) conflict
  UNION ALL
  SELECT 'legacy_replay_has_normalized_video', count(*), 'blocker'
  FROM public."Race" race
  WHERE nullif(btrim(race."replayUrl"), '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public."RaceVideo" video WHERE video."raceId" = race.id)
  UNION ALL
  SELECT 'pedigree_identity_links_to_dog', count(*), 'blocker'
  FROM public."DogSourceIdentity" identity
  WHERE identity."verificationStatus" IN ('verified', 'approved', 'accepted', 'source-verified', 'verified-exact-crosswalk')
    AND identity."dogId" IS NULL
  UNION ALL
  SELECT 'verified_pedigree_assertions_have_parent_identity', count(*), 'blocker'
  FROM public."PedigreeAssertion"
  WHERE "verificationStatus" IN ('verified', 'approved', 'accepted', 'source-verified', 'verified-exact-crosswalk')
    AND "parentIdentityId" IS NULL
  UNION ALL
  SELECT 'pedigree_relationship_is_sire_or_dam', count(*), 'blocker'
  FROM public."PedigreeAssertion" WHERE lower(relationship) NOT IN ('sire', 'dam')
  UNION ALL
  SELECT 'thedogs_exported_status_partition_balances',
         abs(staged - (rejected_self + verified + replaced + quarantined + pending)),
         'blocker'
  FROM thedogs_pedigree_partition
  UNION ALL
  SELECT 'galtd_volumes_66_to_73_accounted', count(*), 'blocker'
  FROM (VALUES ('66'), ('67'), ('68'), ('69'), ('70'), ('71'), ('72'), ('73')) required(volume)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."PedigreeImportRun" run
    WHERE lower(run."sourceProvider") = 'galtd'
      AND run."sourceVolume" = required.volume
      AND run."completedAt" IS NOT NULL
  )
  UNION ALL
  SELECT 'galtd_reviewed_conflict_evidence_exact',
         abs(conflict_groups - 5) + abs(conflict_observations - 18), 'blocker'
  FROM galtd_conflict_evidence
  UNION ALL
  SELECT 'canonical_pedigree_ledger_is_verified', count(*), 'blocker'
  FROM public."PedigreeMergeLedger"
  WHERE decision IN ('accepted', 'no_change', 'preserved_higher_authority', 'applied', 'verified-existing')
    AND "verificationStatus" <> 'verified'
  UNION ALL
  SELECT 'canonical_pedigree_ledger_matches_relationship', count(*), 'blocker'
  FROM public."PedigreeMergeLedger" ledger
  JOIN public."Dog" dog ON dog.id = ledger."dogId"
  WHERE ledger.decision IN ('accepted', 'no_change', 'applied', 'verified-existing')
    AND ledger."verificationStatus" = 'verified'
    AND (
      (ledger.relationship = 'sire' AND dog."sireId" IS DISTINCT FROM ledger."proposedParentDogId")
      OR (ledger.relationship = 'dam' AND dog."damId" IS DISTINCT FROM ledger."proposedParentDogId")
    )
  UNION ALL
  SELECT 'pedigree_has_no_self_parent', count(*), 'blocker'
  FROM public."Dog" WHERE id = "sireId" OR id = "damId"
  UNION ALL
  SELECT 'pedigree_parent_sex_consistent', count(*), 'blocker'
  FROM public."Dog" dog
  LEFT JOIN public."Dog" sire ON sire.id = dog."sireId"
  LEFT JOIN public."Dog" dam ON dam.id = dog."damId"
  WHERE (sire.id IS NOT NULL AND lower(coalesce(sire.sex, '')) IN ('f', 'female', 'bitch'))
     OR (dam.id IS NOT NULL AND lower(coalesce(dam.sex, '')) IN ('m', 'male', 'dog'))
  UNION ALL
  SELECT 'pedigree_has_no_cycles', count(*), 'blocker'
  FROM pedigree_walk WHERE root_id = dog_id
  UNION ALL
  SELECT 'dog_minimum_rows', greatest(212391 - count(*), 0), 'blocker' FROM public."Dog"
  UNION ALL
  SELECT 'non_demo_meeting_source_union_minimum_rows', greatest(76622 - count(*), 0), 'blocker' FROM public."Meeting"
  UNION ALL
  SELECT 'non_demo_race_source_union_minimum_rows', greatest(838536 - count(*), 0), 'blocker' FROM public."Race"
  UNION ALL
  SELECT 'non_demo_runner_source_union_minimum_rows', greatest(6434242 - count(*), 0), 'blocker' FROM public."Runner"
  UNION ALL
  SELECT 'non_demo_result_source_union_minimum_rows', greatest(5660837 - count(*), 0), 'blocker' FROM public."Result"
  UNION ALL
  SELECT 'non_demo_source_union_natural_keys_present',
         coalesce(sum(natural_keys - present_natural_keys), 0), 'blocker'
  FROM source_natural_key_coverage
  UNION ALL
  SELECT 'profile_form_minimum_canonical_rows', greatest(5904337 - canonical_total, 0), 'blocker' FROM profile_form_partition
  UNION ALL
  SELECT 'profile_archive_minimum_rows', greatest(170780 - count(*), 0), 'blocker' FROM public."DogProfileArchive"
  UNION ALL
  SELECT 'pedigree_identity_minimum_rows', greatest(212391 - count(*), 0), 'blocker' FROM public."DogSourceIdentity"
),
date_ranges AS MATERIALIZED (
  SELECT 'Track'::text AS entity, min("createdAt") AS min_value, max("createdAt") AS max_value FROM public."Track"
  UNION ALL SELECT 'Trainer', min("createdAt"), max("createdAt") FROM public."Trainer"
  UNION ALL SELECT 'Dog', min("updatedAt"), max("updatedAt") FROM public."Dog"
  UNION ALL SELECT 'Meeting', min("meetingDate"), max("meetingDate") FROM public."Meeting"
  UNION ALL SELECT 'Race', min("raceTime"), max("raceTime") FROM public."Race"
  UNION ALL SELECT 'RaceVideo', min("updatedAt"), max("updatedAt") FROM public."RaceVideo"
  UNION ALL SELECT 'Runner', min("createdAt"), max("createdAt") FROM public."Runner"
  UNION ALL SELECT 'Result', min("createdAt"), max("createdAt") FROM public."Result"
  UNION ALL SELECT 'FormEntry', min(date), max(date) FROM public."FormEntry"
  UNION ALL SELECT 'DogProfileForm', min(date), max(date) FROM public."DogProfileForm"
  UNION ALL SELECT 'DogProfileArchive', min("fetchedAt"), max("fetchedAt") FROM public."DogProfileArchive"
  UNION ALL SELECT 'RaceDayArchive', min(date), max(date) FROM public."RaceDayArchive"
  UNION ALL SELECT 'PedigreeImportRun', min("startedAt"), max("startedAt") FROM public."PedigreeImportRun"
  UNION ALL SELECT 'DogSourceIdentity', min("createdAt"), max("createdAt") FROM public."DogSourceIdentity"
  UNION ALL SELECT 'PedigreeAssertion', min("createdAt"), max("createdAt") FROM public."PedigreeAssertion"
  UNION ALL SELECT 'PedigreeMergeLedger', min("createdAt"), max("createdAt") FROM public."PedigreeMergeLedger"
)
SELECT jsonb_build_object(
  'auditKind', 'normalized-public-racing-read-only-reconciliation',
  'database', current_database(),
  'blockerCount', coalesce(sum((failures > 0)::int) FILTER (WHERE severity = 'blocker'), 0),
  'failureRows', coalesce(sum(failures) FILTER (WHERE severity = 'blocker'), 0),
  'checks', coalesce(jsonb_agg(
    jsonb_build_object('name', name, 'failures', failures, 'severity', severity)
    ORDER BY name
  ), '[]'::jsonb),
  'tableCounts', (SELECT jsonb_object_agg(name, rows ORDER BY name) FROM table_counts),
  'dateRanges', (SELECT jsonb_agg(jsonb_build_object(
    'entity', entity, 'min', min_value, 'max', max_value
  ) ORDER BY entity) FROM date_ranges),
  'stateCoverage', (SELECT jsonb_agg(jsonb_build_object(
    'state', state,
    'tracks', tracks,
    'meetings', meetings,
    'races', races,
    'runners', runners,
    'results', results,
    'raceVideos', race_videos,
    'minRaceTime', min_race_time,
    'maxRaceTime', max_race_time
  ) ORDER BY state) FROM state_coverage),
  'providerCoverage', (SELECT jsonb_agg(jsonb_build_object(
    'entity', entity, 'provider', provider, 'rows', rows
  ) ORDER BY entity, provider) FROM provider_counts),
  'trainerIdentityCoverage', (SELECT jsonb_build_object(
    'candidateTrainers', candidate_trainers,
    'trainersWithExactIdentity', trainers_with_exact_identity,
    'unresolvedTrainers', unresolved_trainers,
    'crosswalkRows', (SELECT count(*) FROM trainer_identity_crosswalk),
    'identityKinds', jsonb_build_array('r2-source-trainer-id', 'thedogs-provider-id'),
    'nameOnlyMatchingAllowed', false
  ) FROM trainer_identity_coverage),
  'thedogsLocalIdentityCrosswalk', (SELECT jsonb_build_object(
    'localSyntheticIdentities', local_synthetic_identities,
    'distinctLocalDogIds', distinct_local_dog_ids,
    'distinctProviderSourceIds', distinct_provider_source_ids,
    'distinctCandidateDogIds', distinct_candidate_dog_ids,
    'exactCandidateMatches', exact_candidate_matches,
    'candidateSyntheticEarBrands', candidate_synthetic_ear_brands,
    'expectedExactMatches', 198887,
    'mapping', 'r2 earBrand=thedogs:<id> to candidate sourceProvider=thedogs/sourceId'
  ) FROM thedogs_local_identity_summary),
  'sourceNaturalKeyCoverage', (SELECT jsonb_agg(jsonb_build_object(
    'entity', entity,
    'source', source_name,
    'provider', provider,
    'sourceRows', source_rows,
    'naturalKeys', natural_keys,
    'presentNaturalKeys', present_natural_keys,
    'missingNaturalKeys', natural_keys - present_natural_keys
  ) ORDER BY entity, source_name, provider) FROM source_natural_key_coverage),
  'pedigreeProviderStatus', (SELECT jsonb_agg(jsonb_build_object(
    'provider', provider,
    'importRuns', import_runs,
    'identities', identities,
    'assertions', assertions,
    'ledgerRows', ledger_rows,
    'importRunStatuses', import_run_statuses,
    'identityStatuses', identity_statuses,
    'assertionStatuses', assertion_statuses,
    'ledgerStatuses', ledger_statuses,
    'ledgerDecisions', ledger_decisions
  ) ORDER BY provider) FROM pedigree_provider_status),
  'galtdConflictEvidence', (SELECT jsonb_build_object(
    'conflictGroups', conflict_groups,
    'conflictObservations', conflict_observations,
    'identityConflictOrPending', identity_conflict_or_pending,
    'assertionConflictOrPending', assertion_conflict_or_pending,
    'ledgerConflictOrPending', ledger_conflict_or_pending
  ) FROM galtd_conflict_evidence),
  'raceVideoPartition', (SELECT jsonb_build_object(
    'candidateTotal', total,
    'candidateRecognized', recognized,
    'candidateQuarantined', quarantined,
    'raceLevel', race_level,
    'meetingPreview', meeting_preview,
    'liveMeeting', live_meeting,
    'racePreview', race_preview,
    'partitionSum', recognized + quarantined
  ) FROM race_video_partition),
  'photoFinishPartition', (SELECT jsonb_build_object(
    'populated', populated,
    'unsafe', unsafe
  ) FROM photo_finish_partition),
  'dogVerificationClasses', (SELECT jsonb_build_object(
    'fullProfile', full_profile,
    'raceObserved', race_observed,
    'providerStub', provider_stub,
    'unclassified', unclassified,
    'total', total
  ) FROM dog_verification_classes),
  'profileFormPartition', (SELECT jsonb_build_object(
    'total', total,
    'canonicalRows', canonical_total,
    'normalizedTemoraSlugless', recovered,
    'forbiddenDogOrProfileRows', quarantined,
    'otherShape', other_shape,
    'partitionSum', canonical_total + quarantined + other_shape
  ) FROM profile_form_partition),
  'profileFormSourceCoverage', (SELECT jsonb_build_object(
    'canonicalSourceRows', canonical_source_rows,
    'canonicalUnresolvedRaceRows', canonical_unresolved_race_rows,
    'excludedDogUrlRows', excluded_dog_url_rows,
    'canonicalDogUnresolvedRows', canonical_dog_unresolved_rows,
    'canonicalDuplicateIdentityRows', canonical_duplicate_identity_rows,
    'canonicalMissingFromPublic', canonical_missing_from_public,
    'canonicalUnresolvedMissingFromPublic', canonical_unresolved_missing_from_public
  ) FROM profile_form_source_coverage),
  'thedogsPedigreePartition', (SELECT jsonb_build_object(
    'staged', staged,
    'rejectedSelf', rejected_self,
    'verified', verified,
    'replaced', replaced,
    'quarantined', quarantined,
    'pending', pending,
    'partitionSum', rejected_self + verified + replaced + quarantined + pending
  ) FROM thedogs_pedigree_partition)
)
FROM checks;

\if :{?GIQ_SNAPSHOT_EXPORT}
\else
ROLLBACK;
\endif
