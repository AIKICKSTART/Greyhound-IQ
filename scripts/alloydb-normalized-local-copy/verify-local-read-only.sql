\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30min';
SET LOCAL lock_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL extra_float_digits = 3;

WITH RECURSIVE
required_states(state) AS (
  VALUES ('ACT'), ('NSW'), ('NT'), ('QLD'), ('SA'), ('TAS'), ('VIC'), ('WA')
),
state_counts AS MATERIALIZED (
  SELECT
    required.state,
    count(DISTINCT race.id) AS races,
    count(DISTINCT result.id) AS results
  FROM required_states required
  LEFT JOIN public."Track" track ON upper(btrim(track.state)) = required.state
  LEFT JOIN public."Meeting" meeting ON meeting."trackId" = track.id
  LEFT JOIN public."Race" race ON race."meetingId" = meeting.id
  LEFT JOIN public."Runner" runner ON runner."raceId" = race.id
  LEFT JOIN public."Result" result ON result."runnerId" = runner.id
  GROUP BY required.state
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
checks AS (
  SELECT 'required_state_has_races'::text AS name, sum((races = 0)::int)::bigint AS failures FROM state_counts
  UNION ALL SELECT 'required_state_has_results', sum((results = 0)::int) FROM state_counts
  UNION ALL SELECT 'new_zealand_tracks_are_nz', count(*) FROM public."Track"
    WHERE lower(btrim(name)) IN ('ashburton', 'auckland', 'cambridge', 'christchurch', 'manawatu', 'manukau', 'otago', 'palmerston - north', 'palmerston north', 'southland', 'taranaki', 'tokoroa', 'waikato', 'wanganui', 'wellington') AND upper(btrim(state)) <> 'NZ'
  UNION ALL SELECT 'canberra_is_act', count(*) FROM public."Track" WHERE lower(btrim(name)) = 'canberra' AND upper(btrim(state)) <> 'ACT'
  UNION ALL SELECT 'meadows_alias_single_canonical_track', abs(count(*) - 1) FROM public."Track" WHERE lower(btrim(name)) IN ('meadows', 'the meadows')
  UNION ALL SELECT 'meadows_noncanonical_alias_absent', count(*) FROM public."Track" WHERE lower(btrim(name)) = 'meadows'
  UNION ALL SELECT 'synthetic_track_absent', count(*) FROM public."Track" WHERE lower(btrim(name)) = 'greyhoundiq demo park'
  UNION ALL SELECT 'synthetic_meetings_absent', count(*) FROM public."Meeting" WHERE lower(coalesce("sourceProvider", '')) IN ('demo', 'greyhoundiq-demo')
  UNION ALL SELECT 'synthetic_races_absent', count(*) FROM public."Race" WHERE lower(coalesce("sourceProvider", '')) IN ('demo', 'greyhoundiq-demo')
  UNION ALL SELECT 'synthetic_runners_absent', count(*) FROM public."Runner" WHERE lower(coalesce("sourceProvider", '')) IN ('demo', 'greyhoundiq-demo')
  UNION ALL SELECT 'dog_stable_identity', count(*) FROM public."Dog" WHERE nullif(btrim("earBrand"), '') IS NULL AND (nullif(btrim("sourceProvider"), '') IS NULL OR nullif(btrim("sourceId"), '') IS NULL)
  UNION ALL SELECT 'thedogs_synthetic_ear_brand_absent', count(*) FROM public."Dog" WHERE "earBrand" ~ '^thedogs:[0-9]+$'
  UNION ALL SELECT 'dog_provider_identity_unique', count(*) FROM (
    SELECT lower(btrim("sourceProvider")), btrim("sourceId")
    FROM public."Dog"
    WHERE nullif(btrim("sourceProvider"), '') IS NOT NULL AND nullif(btrim("sourceId"), '') IS NOT NULL
    GROUP BY 1, 2 HAVING count(*) > 1
  ) duplicate
  UNION ALL SELECT 'dog_minimum', greatest(212391 - count(*), 0) FROM public."Dog"
  UNION ALL SELECT 'meeting_minimum', greatest(76622 - count(*), 0) FROM public."Meeting"
  UNION ALL SELECT 'race_minimum', greatest(838536 - count(*), 0) FROM public."Race"
  UNION ALL SELECT 'runner_minimum', greatest(6434242 - count(*), 0) FROM public."Runner"
  UNION ALL SELECT 'result_minimum', greatest(5660837 - count(*), 0) FROM public."Result"
  UNION ALL SELECT 'profile_form_minimum', greatest(5904337 - count(*), 0) FROM public."DogProfileForm"
  UNION ALL SELECT 'profile_archive_minimum', greatest(170780 - count(*), 0) FROM public."DogProfileArchive"
  UNION ALL SELECT 'pedigree_identity_minimum', greatest(212391 - count(*), 0) FROM public."DogSourceIdentity"
  UNION ALL SELECT 'result_runner_race_integrity', count(*) FROM public."Result" result LEFT JOIN public."Runner" runner ON runner.id = result."runnerId" WHERE runner.id IS NULL OR runner."raceId" <> result."raceId"
  UNION ALL SELECT 'form_entry_race_integrity', count(*) FROM public."FormEntry" form LEFT JOIN public."Race" race ON race.id = form."raceId" WHERE form."raceId" IS NULL OR race.id IS NULL
  UNION ALL SELECT 'profile_archive_dog_integrity', count(*) FROM public."DogProfileArchive" archive LEFT JOIN public."Dog" dog ON dog.id = archive."dogId" WHERE archive."dogId" IS NULL OR dog.id IS NULL
  UNION ALL SELECT 'profile_form_canonical_race_shape', count(*) FROM public."DogProfileForm" WHERE "raceUrl" ~* '^/(dogs?|greyhounds?|profiles?)(/|[?#]|$)' OR "raceUrl" !~ '^/racing/[^?#]+/?$'
  UNION ALL SELECT 'temora_slugless_race_identity_normalized_exact', abs(count(*) - 8) FROM public."DogProfileForm" WHERE lower(coalesce("trackName", '')) = 'temora' AND date::date = DATE '2008-10-19' AND "raceUrl" = '/racing/temora/2008-10-19/3/' AND "sourceId" = '/racing/temora/2008-10-19/3?trial=false'
  UNION ALL SELECT 'race_provider_key_not_dog_url', count(*) FROM public."Race" WHERE "sourceId" ~* '(^|/)(dogs?|greyhounds?|profiles?)(/|[?#]|$)'
  UNION ALL SELECT 'race_video_locator_valid', count(*) FROM public."RaceVideo" WHERE nullif(btrim("pageUrl"), '') IS NULL OR "pageUrl" ~* '([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|://[^/@[:space:]]+:[^/@[:space:]]+@)'
  UNION ALL SELECT 'photo_finish_not_race_video', count(*) FROM public."RaceVideo" WHERE lower(kind) IN ('photo', 'photo-finish', 'photo_finish', 'photofinish')
  UNION ALL SELECT 'pedigree_no_self_parent', count(*) FROM public."Dog" WHERE id = "sireId" OR id = "damId"
  UNION ALL SELECT 'pedigree_parent_sex', count(*) FROM public."Dog" dog LEFT JOIN public."Dog" sire ON sire.id = dog."sireId" LEFT JOIN public."Dog" dam ON dam.id = dog."damId" WHERE (sire.id IS NOT NULL AND lower(coalesce(sire.sex, '')) IN ('f', 'female', 'bitch')) OR (dam.id IS NOT NULL AND lower(coalesce(dam.sex, '')) IN ('m', 'male', 'dog'))
  UNION ALL SELECT 'pedigree_no_cycles', count(*) FROM pedigree_walk WHERE root_id = dog_id
  UNION ALL SELECT 'galtd_volumes_accounted', count(*) FROM (VALUES ('66'), ('67'), ('68'), ('69'), ('70'), ('71'), ('72'), ('73')) required(volume) WHERE NOT EXISTS (SELECT 1 FROM public."PedigreeImportRun" run WHERE lower(run."sourceProvider") = 'galtd' AND run."sourceVolume" = required.volume AND run."completedAt" IS NOT NULL)
)
SELECT jsonb_build_object(
  'auditKind', 'normalized-local-racing-read-only-verification',
  'database', current_database(),
  'blockerCount', count(*) FILTER (WHERE failures > 0),
  'failureRows', coalesce(sum(failures), 0),
  'checks', jsonb_agg(jsonb_build_object('name', name, 'failures', failures) ORDER BY name),
  'stateCoverage', (SELECT jsonb_agg(jsonb_build_object('state', state, 'races', races, 'results', results) ORDER BY state) FROM state_counts)
)
FROM checks;

ROLLBACK;
