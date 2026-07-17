\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ WRITE;
SET LOCAL app.system='true';
SET LOCAL "app.current_role"='system';
SET LOCAL app.current_tier='system';
SET LOCAL synchronous_commit=on;
SET LOCAL statement_timeout=0;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle='ISO, MDY';
SET LOCAL extra_float_digits=1;

DO $$
DECLARE observed_phase text;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'whole-source reconciliation database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase FROM _giq_history_merge.run WHERE id=1;
  IF observed_phase NOT IN ('canonical_merged','delta_applied','verified') THEN
    RAISE EXCEPTION 'whole-source reconciliation requires a merged candidate, observed %',observed_phase;
  END IF;
END
$$;

LOCK TABLE
  public."Track",public."Trainer",public."Dog",public."Meeting",public."Race",
  public."Runner",public."Result",public."FormEntry",public."DogProfileForm",
  public."RaceVideo",public."DogProfileArchive",public."RaceDayArchive",
  public."PedigreeImportRun",public."DogSourceIdentity",public."PedigreeAssertion",
  public."PedigreeMergeLedger"
IN SHARE MODE;

CREATE TEMP TABLE whole_source_reconciliation (
  source_domain text NOT NULL,
  source_entity text NOT NULL,
  source_rows bigint NOT NULL,
  imported_rows bigint NOT NULL,
  merged_rows bigint NOT NULL,
  quarantined_rows bigint NOT NULL,
  unaccounted_rows bigint NOT NULL,
  duplicate_source_keys bigint NOT NULL,
  payload_mismatches bigint NOT NULL,
  provenance_mismatches bigint NOT NULL,
  verification_mismatches bigint NOT NULL,
  mapping_conflicts bigint NOT NULL,
  orphan_rows bigint NOT NULL,
  placeholder_rows bigint NOT NULL,
  details jsonb NOT NULL,
  PRIMARY KEY(source_domain,source_entity)
) ON COMMIT DROP;

CREATE TEMP TABLE whole_source_integrity (
  check_name text PRIMARY KEY,
  failure_rows bigint NOT NULL,
  details jsonb NOT NULL
) ON COMMIT DROP;

-- Recompute the staged r2 payload manifests from the rows, not from pinned counts.
CREATE TEMP TABLE whole_r2_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_md5 text NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE source_table record; observed_rows bigint; observed_md5 text;
BEGIN
  FOR source_table IN
    SELECT table_name FROM _giq_history_merge.r2_stage_table_manifest ORDER BY table_name
  LOOP
    IF to_regclass(format('_giq_history_stage.%I','r2_'||source_table.table_name)) IS NULL THEN
      RAISE EXCEPTION 'r2 staged relation % is absent',source_table.table_name;
    END IF;
    EXECUTE format(
      'SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(row_value)::text),'''' ORDER BY id),'''')) '
      'FROM _giq_history_stage.%I row_value',
      'r2_'||source_table.table_name
    ) INTO observed_rows,observed_md5;
    INSERT INTO whole_r2_manifest VALUES(source_table.table_name,observed_rows,observed_md5);
  END LOOP;
END
$$;

-- Recompute every normalized GCS stage count and bind it to the loaded artifact metadata.
CREATE TEMP TABLE whole_export_manifest (
  dataset text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE source_dataset record; observed_rows bigint;
BEGIN
  FOR source_dataset IN
    SELECT dataset FROM _giq_history_merge.export_dataset_manifest ORDER BY dataset
  LOOP
    IF to_regclass(format('_giq_history_stage.%I','export_'||source_dataset.dataset)) IS NULL THEN
      RAISE EXCEPTION 'normalized export relation % is absent',source_dataset.dataset;
    END IF;
    EXECUTE format('SELECT count(*) FROM _giq_history_stage.%I','export_'||source_dataset.dataset)
      INTO observed_rows;
    INSERT INTO whole_export_manifest VALUES(source_dataset.dataset,observed_rows);
  END LOOP;
END
$$;

-- Recompute the protected non-racing baseline with the real primary-key order.
CREATE TEMP TABLE whole_protected_manifest (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL,
  row_md5 text NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE relation record; primary_key_order text; observed_rows bigint; observed_md5 text;
BEGIN
  FOR relation IN
    SELECT baseline.table_name,c.oid
    FROM _giq_history_merge.protected_table_manifest baseline
    JOIN pg_class c ON c.relname=baseline.table_name
    JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
    ORDER BY baseline.table_name
  LOOP
    SELECT 'jsonb_build_array('||string_agg(format('row_value.%I',a.attname),', ' ORDER BY key.ord)||')::text'
    INTO primary_key_order
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(attnum,ord)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum
    WHERE i.indrelid=relation.oid AND i.indisprimary;
    IF primary_key_order IS NULL THEN
      RAISE EXCEPTION 'protected relation % has no primary key',relation.table_name;
    END IF;
    EXECUTE format(
      'SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(row_value)::text),'''' ORDER BY %s),'''')) '
      'FROM public.%I row_value',primary_key_order,relation.table_name
    ) INTO observed_rows,observed_md5;
    INSERT INTO whole_protected_manifest VALUES(relation.table_name,observed_rows,observed_md5);
  END LOOP;
END
$$;

-- Production snapshot membership is explicit for all historical core rows.
CREATE TEMP TABLE whole_current_core_key (
  table_name text NOT NULL,
  primary_key_text text NOT NULL,
  PRIMARY KEY(table_name,primary_key_text)
) ON COMMIT DROP;

DO $$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT table_name FROM _giq_history_merge.snapshot_table_manifest
    WHERE historical_core ORDER BY table_name
  LOOP
    EXECUTE format(
      'INSERT INTO whole_current_core_key SELECT %L,id::text FROM public.%I',
      relation.table_name,relation.table_name
    );
  END LOOP;
END
$$;

INSERT INTO whole_source_reconciliation
SELECT
  'production-snapshot',source.table_name,count(*),0,
  count(*) FILTER(WHERE current.primary_key_text IS NOT NULL OR alias.source_alias_id IS NOT NULL),
  0,
  count(*) FILTER(WHERE current.primary_key_text IS NULL AND alias.source_alias_id IS NULL),
  count(*)-count(DISTINCT source.primary_key_text),
  count(*) FILTER(WHERE source.table_name='RaceVideo' AND video_proof.id IS NULL),
  0,0,
  count(*) FILTER(WHERE alias.source_alias_id IS NOT NULL AND alias_target.primary_key_text IS NULL),
  0,0,
  jsonb_build_object(
    'mappingBasis','snapshot-primary-key',
    'directMembership',count(*) FILTER(WHERE current.primary_key_text IS NOT NULL),
    'reviewedAliasMembership',count(*) FILTER(WHERE alias.source_alias_id IS NOT NULL),
    'snapshotTableDigest',(SELECT row_digest FROM _giq_history_merge.snapshot_table_manifest
      WHERE table_name=source.table_name)
  )
FROM _giq_history_merge.snapshot_core_key source
LEFT JOIN whole_current_core_key current USING(table_name,primary_key_text)
LEFT JOIN _giq_history_merge.track_alias_map alias
  ON source.table_name='Track' AND alias.source_alias_id=source.primary_key_text
LEFT JOIN whole_current_core_key alias_target
  ON alias_target.table_name='Track' AND alias_target.primary_key_text=alias.canonical_id
LEFT JOIN LATERAL (
  SELECT proof.id
  FROM _giq_history_merge.snapshot_race_video_proof proof
  JOIN public."RaceVideo" video ON video.id=proof.id
   AND proof.row_sha256=encode(digest(to_jsonb(video)::text,'sha256'),'hex')
  WHERE source.table_name='RaceVideo' AND proof.id=source.primary_key_text
) video_proof ON true
GROUP BY source.table_name;

INSERT INTO whole_source_reconciliation
SELECT 'production-snapshot',manifest.table_name,manifest.row_count,0,0,0,manifest.row_count,
  0,0,0,0,0,0,0,jsonb_build_object('mappingBasis','snapshot-primary-key','partitionMissing',true)
FROM _giq_history_merge.snapshot_table_manifest manifest
WHERE manifest.historical_core
  AND NOT EXISTS(SELECT 1 FROM whole_source_reconciliation audit
    WHERE audit.source_domain='production-snapshot' AND audit.source_entity=manifest.table_name);

-- Every raw r2 row receives one mutually exclusive terminal outcome.
WITH resolution AS (
  SELECT 'Track'::text AS entity,t.id AS source_key,m.target_id,
    canonical.id IS NOT NULL AS target_exists,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Track' AND s.primary_key_text=m.target_id) AS snapshot_target,
    coalesce(n.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','r2','id',t.id)) AS provenance_ok,
    (m.source_id IS NOT NULL)::integer AS resolution_count,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q
      WHERE q.source_name='r2' AND q.entity_type='track' AND q.source_key=t.id) AS quarantined,
    false AS orphaned,
    nullif(btrim(t.name),'') IS NULL OR lower(btrim(t.name))~'^(unknown|n/?a|placeholder|tbd)$' AS placeholder
  FROM _giq_history_stage."r2_Track" t
  LEFT JOIN _giq_history_stage.track_map m ON m.source_name='r2' AND m.source_id=t.id
  LEFT JOIN _giq_history_stage.normalized_track n ON n.natural_key=m.natural_key
  LEFT JOIN public."Track" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'Trainer',t.id,m.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Trainer' AND s.primary_key_text=m.target_id),
    coalesce(n.source_provenance->'sourceIds','[]'::jsonb) ? t.id,
    (m.source_id IS NOT NULL)::integer,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q
      WHERE q.source_name='r2' AND q.entity_type='trainer' AND q.source_key=t.id),
    false,
    nullif(btrim(t.name),'') IS NULL OR lower(btrim(t.name))~'^(unknown|n/?a|placeholder|tbd)$'
  FROM _giq_history_stage."r2_Trainer" t
  LEFT JOIN _giq_history_stage.trainer_map m ON m.source_name='r2' AND m.source_id=t.id
  LEFT JOIN _giq_history_stage.normalized_trainer n ON n.natural_key=m.natural_key
  LEFT JOIN public."Trainer" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'Dog',d.id,m.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Dog' AND s.primary_key_text=m.target_id),
    coalesce(n.source_provenance->'identities','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','r2','key',d.id)),
    (m.source_id IS NOT NULL)::integer,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q
      WHERE q.source_name='r2' AND q.entity_type='dog' AND q.source_key=d.id),
    (d."sireId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Dog" p WHERE p.id=d."sireId"))
      OR (d."damId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Dog" p WHERE p.id=d."damId"))
      OR (d."trainerId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Trainer" p WHERE p.id=d."trainerId")),
    nullif(btrim(d.name),'') IS NULL OR lower(btrim(d.name))~'^(unknown|n/?a|placeholder|tbd)$'
  FROM _giq_history_stage."r2_Dog" d
  LEFT JOIN _giq_history_stage.dog_map m ON m.source_name='r2' AND m.source_id=d.id
  LEFT JOIN _giq_history_stage.normalized_dog n ON n.natural_key=m.natural_key
  LEFT JOIN public."Dog" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'Meeting',row_value.id,m.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Meeting' AND s.primary_key_text=m.target_id),
    coalesce(n.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','r2','id',row_value.id)),
    (m.source_id IS NOT NULL)::integer,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q
      WHERE q.source_name='r2' AND q.entity_type='meeting' AND q.source_key=row_value.id),
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Track" parent WHERE parent.id=row_value."trackId"),false
  FROM _giq_history_stage."r2_Meeting" row_value
  LEFT JOIN _giq_history_stage.meeting_map m ON m.source_name='r2' AND m.source_id=row_value.id
  LEFT JOIN _giq_history_stage.normalized_meeting n ON n.natural_key=m.natural_key
  LEFT JOIN public."Meeting" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'Race',row_value.id,m.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Race' AND s.primary_key_text=m.target_id),
    coalesce(n.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','r2','id',row_value.id)),
    (m.source_id IS NOT NULL)::integer,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q
      WHERE q.source_name='r2' AND q.entity_type='race' AND q.source_key=row_value.id),
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Meeting" parent WHERE parent.id=row_value."meetingId"),false
  FROM _giq_history_stage."r2_Race" row_value
  LEFT JOIN _giq_history_stage.race_map m ON m.source_name='r2' AND m.source_id=row_value.id
  LEFT JOIN _giq_history_stage.normalized_race n ON n.natural_key=m.natural_key
  LEFT JOIN public."Race" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'Runner',row_value.id,m.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Runner' AND s.primary_key_text=m.target_id),
    coalesce(n.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','r2','id',row_value.id)),
    (m.source_id IS NOT NULL)::integer,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q
      WHERE q.source_name='r2' AND q.entity_type='runner' AND q.source_key=row_value.id),
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Race" parent WHERE parent.id=row_value."raceId")
      OR NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Dog" parent WHERE parent.id=row_value."dogId")
      OR (row_value."trainerId" IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM _giq_history_stage."r2_Trainer" parent WHERE parent.id=row_value."trainerId")),false
  FROM _giq_history_stage."r2_Runner" row_value
  LEFT JOIN _giq_history_stage.runner_map m ON m.source_name='r2' AND m.source_id=row_value.id
  LEFT JOIN _giq_history_stage.normalized_runner n ON n.natural_key=m.natural_key
  LEFT JOIN public."Runner" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'Result',row_value.id,m.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Result' AND s.primary_key_text=m.target_id),
    coalesce(n.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','r2','id',row_value.id)),
    (m.source_id IS NOT NULL)::integer,false,
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Runner" parent WHERE parent.id=row_value."runnerId")
      OR NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Race" parent WHERE parent.id=row_value."raceId"),false
  FROM _giq_history_stage."r2_Result" row_value
  LEFT JOIN _giq_history_stage.result_map m ON m.source_name='r2' AND m.source_id=row_value.id
  LEFT JOIN _giq_history_stage.normalized_result n ON n.natural_key=m.natural_key
  LEFT JOIN public."Result" canonical ON canonical.id=m.target_id
  UNION ALL
  SELECT 'FormEntry',row_value.id,n.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='FormEntry' AND s.primary_key_text=n.target_id),
    coalesce(n.source_provenance->'sources','[]'::jsonb) ? ('r2:'||row_value.id),
    (n.target_id IS NOT NULL)::integer,false,
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Dog" parent WHERE parent.id=row_value."dogId")
      OR NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Race" parent WHERE parent.id=row_value."raceId")
      OR (row_value."trackId" IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM _giq_history_stage."r2_Track" parent WHERE parent.id=row_value."trackId")),false
  FROM _giq_history_stage."r2_FormEntry" row_value
  LEFT JOIN _giq_history_stage.dog_map dog_map ON dog_map.source_name='r2' AND dog_map.source_id=row_value."dogId"
  LEFT JOIN _giq_history_stage.race_map race_map ON race_map.source_name='r2' AND race_map.source_id=row_value."raceId"
  LEFT JOIN _giq_history_stage.normalized_form_entry n
    ON n.natural_key='form:'||dog_map.target_id||':'||race_map.target_id
  LEFT JOIN public."FormEntry" canonical ON canonical.id=n.target_id
  UNION ALL
  SELECT 'DogProfileForm',row_value.id,canonical.id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='DogProfileForm' AND s.primary_key_text=canonical.id),
    canonical.id IS NOT NULL AND canonical."sourceRawJson" IS NOT DISTINCT FROM row_value."sourceRawJson",
    (canonical.id IS NOT NULL)::integer,false,
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Dog" parent WHERE parent.id=row_value."dogId"),false
  FROM _giq_history_stage."r2_DogProfileForm" row_value
  LEFT JOIN _giq_history_stage.dog_map dog_map ON dog_map.source_name='r2' AND dog_map.source_id=row_value."dogId"
  LEFT JOIN public."DogProfileForm" canonical ON canonical."dogId"=dog_map.target_id
    AND lower(canonical."sourceProvider")=lower(row_value."sourceProvider")
    AND canonical."sourceId"=row_value."sourceId"
  UNION ALL
  SELECT 'RaceVideo',row_value.id,canonical.id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='RaceVideo' AND s.primary_key_text=canonical.id),
    canonical.id IS NOT NULL AND canonical."sourceRawJson" IS NOT DISTINCT FROM row_value."sourceRawJson",
    (canonical.id IS NOT NULL)::integer,false,
    NOT EXISTS(SELECT 1 FROM _giq_history_stage."r2_Race" parent WHERE parent.id=row_value."raceId"),false
  FROM _giq_history_stage."r2_RaceVideo" row_value
  LEFT JOIN _giq_history_stage.race_map race_map ON race_map.source_name='r2' AND race_map.source_id=row_value."raceId"
  LEFT JOIN public."RaceVideo" canonical ON canonical."raceId"=race_map.target_id
    AND lower(canonical."sourceProvider")=lower(row_value."sourceProvider")
    AND canonical."sourceId"=row_value."sourceId" AND canonical.kind=row_value.kind
  UNION ALL
  SELECT 'DogProfileArchive',row_value.id,n.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='DogProfileArchive' AND s.primary_key_text=n.target_id),
    n.source_id=row_value.id,(n.source_id IS NOT NULL)::integer,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q WHERE q.source_name='r2'
      AND q.entity_type='dog-profile-archive' AND q.source_key=row_value.id),n.dog_id IS NULL,false
  FROM _giq_history_stage."r2_DogProfileArchive" row_value
  LEFT JOIN _giq_history_stage.normalized_dog_profile_archive n ON n.source_id=row_value.id
  LEFT JOIN public."DogProfileArchive" canonical ON canonical.id=n.target_id
  UNION ALL
  SELECT 'RaceDayArchive',row_value.id,n.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='RaceDayArchive' AND s.primary_key_text=n.target_id),
    n.source_id=row_value.id,(n.source_id IS NOT NULL)::integer,false,false,false
  FROM _giq_history_stage."r2_RaceDayArchive" row_value
  LEFT JOIN _giq_history_stage.normalized_race_day_archive n ON n.source_id=row_value.id
  LEFT JOIN public."RaceDayArchive" canonical ON canonical.id=n.target_id
), classified AS (
  SELECT *,target_exists AND provenance_ok IS TRUE AND resolution_count=1 AS accounted_target
  FROM resolution
)
INSERT INTO whole_source_reconciliation
SELECT 'historical-r2',entity,count(*),
  count(*) FILTER(WHERE accounted_target AND NOT snapshot_target),
  count(*) FILTER(WHERE accounted_target AND snapshot_target),
  count(*) FILTER(WHERE NOT accounted_target AND quarantined),
  count(*) FILTER(WHERE NOT accounted_target AND NOT quarantined),
  count(*)-count(DISTINCT source_key),
  CASE WHEN manifest.row_count=count(*) AND manifest.row_md5=stored.row_md5 THEN 0 ELSE count(*) END,
  count(*) FILTER(WHERE target_exists AND provenance_ok IS NOT TRUE),0,
  count(*) FILTER(WHERE resolution_count<>1 AND NOT quarantined),
  count(*) FILTER(WHERE orphaned),count(*) FILTER(WHERE placeholder),
  jsonb_build_object('mappingBasis','stable/provider/natural key','payloadManifest',manifest.row_md5)
FROM classified
LEFT JOIN whole_r2_manifest manifest ON manifest.table_name=entity
LEFT JOIN _giq_history_merge.r2_stage_table_manifest stored ON stored.table_name=entity
GROUP BY entity,manifest.row_count,manifest.row_md5,stored.row_md5;

INSERT INTO whole_source_reconciliation
SELECT 'historical-r2',manifest.table_name,manifest.row_count,0,0,0,manifest.row_count,
  0,CASE WHEN manifest.row_md5=stored.row_md5 AND manifest.row_count=stored.row_count THEN 0
    ELSE manifest.row_count END,
  0,0,0,0,0,jsonb_build_object('mappingBasis','source table empty or resolver missing')
FROM whole_r2_manifest manifest
JOIN _giq_history_merge.r2_stage_table_manifest stored USING(table_name)
WHERE NOT EXISTS(SELECT 1 FROM whole_source_reconciliation audit
  WHERE audit.source_domain='historical-r2' AND audit.source_entity=manifest.table_name);

-- Stable-key normalized GCS content graph.
WITH resolution AS (
  SELECT 'profiles'::text AS entity,row_value.source_file||':'||row_value.line_number AS source_key,
    map.target_id,canonical.id IS NOT NULL AS target_exists,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Dog' AND s.primary_key_text=map.target_id) AS snapshot_target,
    coalesce(normalized.source_provenance->'identities','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','profile','key',row_value.payload->>'naturalKey')) AS provenance_ok,
    (map.source_id IS NOT NULL)::integer AS resolution_count,
    nullif(row_value.payload->>'name','') IS NULL OR lower(btrim(row_value.payload->>'name'))~'^(unknown|n/?a|placeholder|tbd)$' AS placeholder
  FROM _giq_history_stage.export_profiles row_value
  LEFT JOIN _giq_history_stage.dog_map map ON map.source_name='profile' AND map.source_id=row_value.payload->>'naturalKey'
  LEFT JOIN _giq_history_stage.normalized_dog normalized ON normalized.natural_key=map.natural_key
  LEFT JOIN public."Dog" canonical ON canonical.id=map.target_id
    AND lower(canonical."sourceProvider")='thedogs'
    AND canonical."sourceId"=row_value.payload->>'sourceId'
  UNION ALL
  SELECT 'meetings',row_value.source_file||':'||row_value.line_number,map.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Meeting' AND s.primary_key_text=map.target_id),
    coalesce(normalized.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','export','id',row_value.payload->>'naturalKey')),
    (map.source_id IS NOT NULL)::integer,false
  FROM _giq_history_stage.export_meetings row_value
  LEFT JOIN _giq_history_stage.meeting_map map ON map.source_name='export' AND map.source_id=row_value.payload->>'naturalKey'
  LEFT JOIN _giq_history_stage.normalized_meeting normalized ON normalized.natural_key=map.natural_key
  LEFT JOIN public."Meeting" canonical ON canonical.id=map.target_id
    AND canonical."trackId"=normalized.track_id AND canonical."meetingDate"=normalized.meeting_date
  UNION ALL
  SELECT 'races',row_value.source_file||':'||row_value.line_number,map.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Race' AND s.primary_key_text=map.target_id),
    coalesce(normalized.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','export','id',row_value.payload->>'naturalKey')),
    (map.source_id IS NOT NULL)::integer,false
  FROM _giq_history_stage.export_races row_value
  LEFT JOIN _giq_history_stage.race_map map ON map.source_name='export' AND map.source_id=row_value.payload->>'naturalKey'
  LEFT JOIN _giq_history_stage.normalized_race normalized ON normalized.natural_key=map.natural_key
  LEFT JOIN public."Race" canonical ON canonical.id=map.target_id
    AND canonical."meetingId"=normalized.meeting_id AND canonical."raceNumber"=normalized.race_number
  UNION ALL
  SELECT 'runners',row_value.source_file||':'||row_value.line_number,map.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Runner' AND s.primary_key_text=map.target_id),
    coalesce(normalized.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','export','id',row_value.payload->>'naturalKey')),
    (map.source_id IS NOT NULL)::integer,false
  FROM _giq_history_stage.export_runners row_value
  LEFT JOIN _giq_history_stage.runner_map map ON map.source_name='export' AND map.source_id=row_value.payload->>'naturalKey'
  LEFT JOIN _giq_history_stage.normalized_runner normalized ON normalized.natural_key=map.natural_key
  LEFT JOIN public."Runner" canonical ON canonical.id=map.target_id
    AND canonical."raceId"=normalized.race_id AND canonical."boxNumber"=normalized.box_number
  UNION ALL
  SELECT 'results',row_value.source_file||':'||row_value.line_number,map.target_id,canonical.id IS NOT NULL,
    EXISTS(SELECT 1 FROM _giq_history_merge.snapshot_core_key s WHERE s.table_name='Result' AND s.primary_key_text=map.target_id),
    coalesce(normalized.source_provenance->'sources','[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('source','export','id',row_value.payload->>'naturalKey')),
    (map.source_id IS NOT NULL)::integer,false
  FROM _giq_history_stage.export_results row_value
  LEFT JOIN _giq_history_stage.result_map map ON map.source_name='export' AND map.source_id=row_value.payload->>'naturalKey'
  LEFT JOIN _giq_history_stage.normalized_result normalized ON normalized.natural_key=map.natural_key
  LEFT JOIN public."Result" canonical ON canonical.id=map.target_id
    AND canonical."runnerId"=normalized.runner_id
)
INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs',entity,count(*),
  count(*) FILTER(WHERE target_exists AND provenance_ok IS TRUE AND resolution_count=1 AND NOT snapshot_target),
  count(*) FILTER(WHERE target_exists AND provenance_ok IS TRUE AND resolution_count=1 AND snapshot_target),0,
  count(*) FILTER(WHERE NOT(target_exists AND provenance_ok IS TRUE AND resolution_count=1)),
  count(*)-count(DISTINCT source_key),
  CASE WHEN export_manifest.row_count=count(*) AND export_manifest.row_count=dataset_manifest.observed_rows
    THEN 0 ELSE count(*) END,
  count(*) FILTER(WHERE target_exists AND provenance_ok IS NOT TRUE),0,
  count(*) FILTER(WHERE resolution_count<>1),0,count(*) FILTER(WHERE placeholder),
  jsonb_build_object('mappingBasis','provider natural key','artifactSha256',dataset_manifest.expected_sha256)
FROM resolution
LEFT JOIN whole_export_manifest export_manifest ON export_manifest.dataset=entity
LEFT JOIN _giq_history_merge.export_dataset_manifest dataset_manifest ON dataset_manifest.dataset=entity
GROUP BY entity,export_manifest.row_count,dataset_manifest.observed_rows,dataset_manifest.expected_sha256;

-- Every TheDogs pedigree source row is retained as exact provenance, even when rejected.
WITH resolution AS (
  SELECT source.source_file||':'||source.line_number AS source_key,normalized.natural_key,
    assertion.id AS target_id,normalized.payload=source.payload AS payload_ok,
    assertion.id IS NOT NULL
      AND assertion."importRunId"=subject.import_run_id
      AND assertion."sourceProvider"='thedogs'
      AND assertion."artifactSha256"=(SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1)
      AND assertion."subjectIdentityId"=subject.identity_id
      AND assertion."parentIdentityId" IS NOT DISTINCT FROM
        CASE WHEN normalized.self_parent THEN NULL ELSE parent.identity_id END
      AND assertion.relationship=normalized.relationship
      AND assertion."assertedParentName"=normalized.parent_name
      AND assertion."assertedParentNormalizedName"=_giq_history_merge.slug(normalized.parent_name)
      AND assertion."sourceAuthority"=200
      AND assertion."artifactOffsetLine"=row_number() OVER(ORDER BY normalized.natural_key)
      AND assertion."evidenceSha256"=encode(digest(source.payload::text,'sha256'),'hex') AS provenance_ok,
    CASE decision.decision WHEN 'no_change' THEN 'verified'
      WHEN 'preserved_higher_authority' THEN 'conflict'
      WHEN 'rejected_ambiguous' THEN 'rejected' ELSE 'parsed' END AS expected_status,
    assertion."verificationStatus" AS actual_status,
    nullif(btrim(source.payload->>'parentName'),'') IS NULL
      OR lower(btrim(source.payload->>'parentName'))~'^(unknown|n/?a|placeholder|tbd)$' AS placeholder
  FROM _giq_history_stage.export_pedigree_edges source
  LEFT JOIN _giq_history_stage.normalized_pedigree_edge normalized
    ON normalized.natural_key=source.payload->>'naturalKey'
  LEFT JOIN public."PedigreeAssertion" assertion
    ON assertion.id=_giq_history_merge.history_id('pedassert',normalized.natural_key)
  LEFT JOIN _giq_history_stage.thedogs_source_identity subject ON subject.target_id=normalized.child_id
  LEFT JOIN _giq_history_stage.thedogs_source_identity parent ON parent.target_id=normalized.parent_id
  LEFT JOIN _giq_history_stage.pedigree_merge_decision decision ON decision.natural_key=normalized.natural_key
)
INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs','pedigree_edges',count(*),count(*) FILTER(WHERE target_id IS NOT NULL),0,0,
  count(*) FILTER(WHERE target_id IS NULL),count(*)-count(DISTINCT source_key),
  count(*) FILTER(WHERE payload_ok IS NOT TRUE),count(*) FILTER(WHERE provenance_ok IS NOT TRUE),
  count(*) FILTER(WHERE actual_status IS DISTINCT FROM expected_status),
  count(*) FILTER(WHERE natural_key IS NULL),0,count(*) FILTER(WHERE placeholder),
  jsonb_build_object('mappingBasis','provider child-parent relationship','authority','parsed-until-corroborated')
FROM resolution;

-- Profile-form rows either become canonical history/FormEntry evidence or have one exact quarantine.
WITH resolution AS (
  SELECT source.source_file||':'||source.line_number AS source_key,resolution.*,
    profile_target.target_id AS profile_target_id,recovery_target.target_id AS recovery_target_id,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q WHERE q.source_name='normalized-export'
      AND q.entity_type='profile-form' AND q.source_key=source.source_file||':'||source.line_number) AS has_quarantine,
    resolution.payload=source.payload AS payload_ok
  FROM _giq_history_stage.export_profile_forms source
  LEFT JOIN _giq_history_stage.profile_form_resolution resolution
    USING(source_file,line_number)
  LEFT JOIN LATERAL (
    SELECT canonical.id AS target_id
    FROM _giq_history_stage.normalized_profile_form target
    JOIN public."DogProfileForm" canonical ON canonical.id=target.target_id
      AND canonical."dogId"=target.dog_id
      AND lower(canonical."sourceProvider")=lower(target.source_provider)
      AND canonical."sourceId"=target.source_id AND canonical."raceUrl"=target.race_url
    WHERE target.dog_id=resolution.dog_id AND target.source_provider='thedogs'
      AND target.source_id=source.payload->>'sourceId' LIMIT 1
  ) profile_target ON true
  LEFT JOIN LATERAL (
    SELECT canonical.id AS target_id
    FROM _giq_history_stage.normalized_form_entry target
    JOIN public."FormEntry" canonical ON canonical.id=target.target_id
      AND canonical."dogId"=target.dog_id AND canonical."raceId"=target.race_id
    WHERE coalesce(target.source_provenance->'sources','[]'::jsonb) ?
      ('export-dog-url-recovery:'||source.source_file||':'||source.line_number) LIMIT 1
  ) recovery_target ON true
), classified AS (
  SELECT *,coalesce(profile_target_id,recovery_target_id) AS target_id,
    CASE WHEN profile_target_id IS NOT NULL THEN 'DogProfileForm'
         WHEN recovery_target_id IS NOT NULL THEN 'FormEntry' END AS target_table,
    CASE WHEN profile_target_id IS NOT NULL THEN EXISTS(
           SELECT 1 FROM _giq_history_merge.snapshot_core_key s
           WHERE s.table_name='DogProfileForm' AND s.primary_key_text=profile_target_id)
         WHEN recovery_target_id IS NOT NULL THEN EXISTS(
           SELECT 1 FROM _giq_history_merge.snapshot_core_key s
           WHERE s.table_name='FormEntry' AND s.primary_key_text=recovery_target_id)
         ELSE false END AS snapshot_target
  FROM resolution
)
INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs','profile_forms',count(*),
  count(*) FILTER(WHERE target_id IS NOT NULL AND NOT snapshot_target),
  count(*) FILTER(WHERE target_id IS NOT NULL AND snapshot_target),
  count(*) FILTER(WHERE target_id IS NULL AND has_quarantine),
  count(*) FILTER(WHERE target_id IS NULL AND NOT has_quarantine),
  count(*)-count(DISTINCT source_key),
  count(*) FILTER(WHERE payload_ok IS NOT TRUE),
  count(*) FILTER(WHERE target_id IS NULL AND NOT has_quarantine),
  count(*) FILTER(WHERE disposition IS NULL),
  count(*) FILTER(WHERE target_id IS NOT NULL AND target_table IS NULL),0,0,
  jsonb_build_object('mappingBasis','dog plus provider race URL/evidence','dispositions',
    (SELECT jsonb_object_agg(disposition,rows ORDER BY disposition)
     FROM (SELECT coalesce(disposition,'<missing>') AS disposition,count(*) AS rows
       FROM classified GROUP BY coalesce(disposition,'<missing>')) grouped))
FROM classified;

-- Replay and photo rows are exact payload-backed targets or exact quarantine rows.
WITH resolution AS (
  SELECT source.source_file||':'||source.line_number AS source_key,media.*,
    canonical_video.id AS video_target_id,canonical_race.id AS photo_target_id,
    media.payload=source.payload AND (
      (canonical_video.id IS NULL AND canonical_race.id IS NULL)
      OR (video.source_raw_json::jsonb=source.payload AND canonical_video.id IS NOT NULL)
      OR (photo.source_id=source.payload->>'sourceId' AND canonical_race.id IS NOT NULL
        AND canonical_race."photoFinishUrl"=photo.photo_finish_url)
    ) AS payload_ok,
    EXISTS(SELECT 1 FROM _giq_history_merge.quarantine q WHERE q.source_name='normalized-export'
      AND q.entity_type='race-media' AND q.source_key=source.source_file||':'||source.line_number) AS has_quarantine
  FROM _giq_history_stage.export_race_media source
  LEFT JOIN _giq_history_stage.media_resolution media USING(source_file,line_number)
  LEFT JOIN _giq_history_stage.normalized_race_video video
    ON media.disposition='eligible-race-replay' AND video.race_id=media.race_id
      AND video.source_id=media.provider_media_id
  LEFT JOIN public."RaceVideo" canonical_video ON canonical_video.id=video.target_id
    AND canonical_video."raceId"=video.race_id
    AND lower(canonical_video."sourceProvider")=lower(video.source_provider)
    AND canonical_video."sourceId"=video.source_id AND canonical_video.kind=video.kind
    AND canonical_video."pageUrl"=video.page_url
  LEFT JOIN _giq_history_stage.normalized_photo_finish photo
    ON media.disposition='eligible-photo-finish' AND photo.race_id=media.race_id
      AND photo.source_id=source.payload->>'sourceId'
  LEFT JOIN public."Race" canonical_race ON canonical_race.id=photo.race_id
), classified AS (
  SELECT *,coalesce(video_target_id,photo_target_id) AS target_id,
    CASE WHEN video_target_id IS NOT NULL THEN 'RaceVideo'
         WHEN photo_target_id IS NOT NULL THEN 'Race' END AS target_table,
    CASE WHEN video_target_id IS NOT NULL THEN EXISTS(
           SELECT 1 FROM _giq_history_merge.snapshot_core_key s
           WHERE s.table_name='RaceVideo' AND s.primary_key_text=video_target_id)
         WHEN photo_target_id IS NOT NULL THEN EXISTS(
           SELECT 1 FROM _giq_history_merge.snapshot_core_key s
           WHERE s.table_name='Race' AND s.primary_key_text=photo_target_id)
         ELSE false END AS snapshot_target
  FROM resolution
)
INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs','race_media',count(*),
  count(*) FILTER(WHERE target_id IS NOT NULL AND payload_ok AND NOT snapshot_target),
  count(*) FILTER(WHERE target_id IS NOT NULL AND payload_ok AND snapshot_target),
  count(*) FILTER(WHERE (target_id IS NULL OR payload_ok IS NOT TRUE) AND has_quarantine),
  count(*) FILTER(WHERE (target_id IS NULL OR payload_ok IS NOT TRUE) AND NOT has_quarantine),
  count(*)-count(DISTINCT source_key),
  count(*) FILTER(WHERE payload_ok IS NOT TRUE),
  count(*) FILTER(WHERE target_id IS NULL AND NOT has_quarantine),
  count(*) FILTER(WHERE disposition IS NULL),
  count(*) FILTER(WHERE target_id IS NOT NULL AND target_table IS NULL),0,0,
  jsonb_build_object('mappingBasis','race natural key plus recognized provider media ID','dispositions',
    (SELECT jsonb_object_agg(disposition,rows ORDER BY disposition)
     FROM (SELECT coalesce(disposition,'<missing>') AS disposition,count(*) AS rows
       FROM classified GROUP BY coalesce(disposition,'<missing>')) grouped))
FROM classified;

-- Export archive metadata and every source issue row have exact durable dispositions.
WITH archive_resolution AS (
  SELECT source.source_file||':'||source.line_number AS source_key,source.payload,
    disposition.source_key AS disposition_key,
    disposition.evidence=source.payload
      AND disposition.canonical_natural_key=source.payload->>'naturalKey'
      AND disposition.canonical_entity_type IN ('DogProfileArchive','RaceDayArchive') AS payload_ok
  FROM _giq_history_stage.export_archives source
  LEFT JOIN _giq_history_merge.disposition disposition
    ON disposition.source_name='normalized-export' AND disposition.issue_type='archive-metadata'
   AND disposition.source_key=source.payload->>'naturalKey'
)
INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs','archives',count(*),0,
  count(*) FILTER(WHERE disposition_key IS NOT NULL AND payload_ok),0,
  count(*) FILTER(WHERE disposition_key IS NULL OR payload_ok IS NOT TRUE),
  count(*)-count(DISTINCT source_key),count(*) FILTER(WHERE payload_ok IS NOT TRUE),
  count(*) FILTER(WHERE disposition_key IS NULL),0,0,0,0,
  jsonb_build_object('mappingBasis','archive natural-key metadata disposition')
FROM archive_resolution;

WITH source_rows AS (
  SELECT 'duplicates'::text AS entity,source_file,line_number,payload
    FROM _giq_history_stage.export_duplicates
  UNION ALL SELECT 'orphans',source_file,line_number,payload
    FROM _giq_history_stage.export_orphans
  UNION ALL SELECT 'quarantine',source_file,line_number,payload
    FROM _giq_history_stage.export_quarantine
), issue_resolution AS (
  SELECT source.entity,source.source_file||':'||source.line_number AS source_key,
    outcome.outcome,disposition.disposition_code,
    outcome.payload=source.payload
      AND (disposition.evidence-'originalIssueType')=source.payload
      AND disposition.evidence->>'originalIssueType'=source.payload->>'issueType' AS payload_ok,
    coalesce(outcome.outcome LIKE 'unaccounted-%',true) AS unaccounted,
    coalesce(outcome.outcome LIKE '%quarantined%',false) AS quarantined
  FROM source_rows source
  LEFT JOIN _giq_history_stage.export_issue_outcome outcome
    ON outcome.source_dataset=source.entity AND outcome.source_file=source.source_file
   AND outcome.line_number=source.line_number
  LEFT JOIN _giq_history_merge.disposition disposition
    ON disposition.source_name='normalized-export' AND disposition.issue_type=source.entity
   AND disposition.source_key=source.source_file||':'||source.line_number
)
INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs',entity,count(*),
  count(*) FILTER(WHERE disposition_code IS NOT NULL AND payload_ok AND NOT quarantined AND NOT unaccounted),0,
  count(*) FILTER(WHERE disposition_code IS NOT NULL AND payload_ok AND quarantined),
  count(*) FILTER(WHERE disposition_code IS NULL OR payload_ok IS NOT TRUE OR unaccounted),
  count(*)-count(DISTINCT source_key),count(*) FILTER(WHERE payload_ok IS NOT TRUE),
  count(*) FILTER(WHERE disposition_code IS NULL),
  count(*) FILTER(WHERE unaccounted),0,0,0,
  jsonb_build_object('mappingBasis','exact source issue disposition','outcomes',
    (SELECT jsonb_object_agg(outcome,rows ORDER BY outcome)
     FROM (SELECT coalesce(nested.outcome,'<missing>') AS outcome,count(*) AS rows
       FROM issue_resolution nested WHERE nested.entity=issue_resolution.entity
       GROUP BY coalesce(nested.outcome,'<missing>')) outcome_rows))
FROM issue_resolution
GROUP BY entity;

INSERT INTO whole_source_reconciliation
SELECT 'normalized-gcs',manifest.dataset,manifest.row_count,0,0,0,manifest.row_count,
  0,CASE WHEN manifest.row_count=stored.observed_rows THEN 0 ELSE manifest.row_count END,
  0,0,0,0,0,jsonb_build_object('mappingBasis','source dataset empty or resolver missing')
FROM whole_export_manifest manifest
JOIN _giq_history_merge.export_dataset_manifest stored USING(dataset)
WHERE NOT EXISTS(SELECT 1 FROM whole_source_reconciliation audit
  WHERE audit.source_domain='normalized-gcs' AND audit.source_entity=manifest.dataset);

-- GALTD observations and assertions are imported with exact source provenance and status.
WITH observations AS (
  SELECT source.line_number::text AS source_key,identity.identity_id,
    identity.payload=source.payload AS payload_ok,
    canonical.id IS NOT NULL
      AND canonical."dogId" IS NOT DISTINCT FROM identity.dog_id
      AND canonical."importRunId"=identity.import_run_id
      AND canonical."sourceProvider"='galtd'
      AND canonical."artifactSha256"=source.payload->>'artifactSha256'
      AND canonical."sourceId"=source.payload->>'sourceId'
      AND canonical."sourceName"=source.payload->>'sourceName'
      AND canonical."normalizedName"=source.payload->>'normalizedName'
      AND canonical."registryToken" IS NOT DISTINCT FROM source.payload->>'registryToken'
      AND canonical.imported=identity.crosswalk_eligible
      AND canonical."observedSex" IS NOT DISTINCT FROM source.payload->>'sex'
      AND canonical."observedColour" IS NOT DISTINCT FROM source.payload->>'colour'
      AND canonical."observedWhelpDate" IS NOT DISTINCT FROM (source.payload->>'whelpDate')::timestamptz
      AND canonical."sourceAuthority"=100
      AND canonical."evidenceSha256"=source.payload->>'evidenceSha256'
      AND canonical."sourcePage"=(source.payload->>'sourcePage')::integer
      AND canonical."sourceLine"=(source.payload->>'sourceLine')::integer
      AND canonical."artifactOffsetLine"=(source.payload->>'artifactOffsetLine')::integer AS provenance_ok,
    CASE WHEN source.payload ? 'conflictGroup' THEN 'conflict'
      WHEN identity.crosswalk_eligible THEN 'verified' ELSE 'parsed' END AS expected_status,
    canonical."verificationStatus" AS actual_status,
    nullif(btrim(source.payload->>'sourceName'),'') IS NULL
      OR lower(btrim(source.payload->>'sourceName'))~'^(unknown|n/?a|placeholder|tbd)$' AS placeholder
  FROM _giq_history_stage.galtd_observation source
  LEFT JOIN _giq_history_stage.galtd_source_identity identity ON identity.payload->>'sourceId'=source.payload->>'sourceId'
  LEFT JOIN public."DogSourceIdentity" canonical ON canonical.id=identity.identity_id
)
INSERT INTO whole_source_reconciliation
SELECT 'galtd','observations',count(*),count(*) FILTER(WHERE identity_id IS NOT NULL),0,0,
  count(*) FILTER(WHERE identity_id IS NULL),count(*)-count(DISTINCT source_key),
  count(*) FILTER(WHERE payload_ok IS NOT TRUE),count(*) FILTER(WHERE provenance_ok IS NOT TRUE),
  count(*) FILTER(WHERE actual_status IS DISTINCT FROM expected_status),0,0,
  count(*) FILTER(WHERE placeholder),
  jsonb_build_object('mappingBasis','artifact source ID','verificationStatuses',
    (SELECT jsonb_object_agg(actual_status,rows ORDER BY actual_status)
     FROM (SELECT coalesce(actual_status,'<missing>') AS actual_status,count(*) AS rows
       FROM observations GROUP BY coalesce(actual_status,'<missing>')) grouped),
    'artifacts',(SELECT jsonb_object_agg(artifact_sha,rows ORDER BY artifact_sha)
      FROM (SELECT payload->>'artifactSha256' AS artifact_sha,count(*) AS rows
        FROM _giq_history_stage.galtd_observation GROUP BY payload->>'artifactSha256') artifacts))
FROM observations;

WITH assertions AS (
  SELECT source.line_number::text AS source_key,canonical.id AS target_id,
    canonical.id IS NOT NULL
      AND canonical."importRunId"=subject.import_run_id
      AND canonical."sourceProvider"='galtd'
      AND canonical."artifactSha256"=source.payload->>'artifactSha256'
      AND canonical."subjectIdentityId"=subject.identity_id
      AND canonical."parentIdentityId" IS NOT DISTINCT FROM parent.identity_id
      AND canonical."evidenceSha256"=source.payload->>'evidenceSha256'
      AND canonical.relationship=source.payload->>'relationship'
      AND canonical."assertedParentName"=source.payload->>'assertedParentName'
      AND canonical."assertedParentNormalizedName"=source.payload->>'assertedParentNormalizedName'
      AND canonical."sourceAuthority"=100
      AND canonical."sourcePage"=(source.payload->>'sourcePage')::integer
      AND canonical."sourceLine"=(source.payload->>'sourceLine')::integer
      AND canonical."artifactOffsetLine"=(source.payload->>'artifactOffsetLine')::integer AS provenance_ok,
    CASE WHEN source.payload ? 'conflictGroup' THEN 'conflict'
      WHEN crosswalk.canonical_eligible THEN 'verified' ELSE 'parsed' END AS expected_status,
    canonical."verificationStatus" AS actual_status,
    subject.identity_id IS NULL AS orphaned,
    nullif(btrim(source.payload->>'assertedParentName'),'') IS NULL
      OR lower(btrim(source.payload->>'assertedParentName'))~'^(unknown|n/?a|placeholder|tbd)$' AS placeholder
  FROM _giq_history_stage.galtd_assertion source
  LEFT JOIN _giq_history_stage.galtd_source_identity subject
    ON subject.payload->>'sourceId'=source.payload->>'subjectSourceId'
  LEFT JOIN _giq_history_stage.galtd_exact_crosswalk crosswalk
    ON crosswalk.galtd_source_id=source.payload->>'subjectSourceId' AND crosswalk.canonical_eligible
  LEFT JOIN _giq_history_stage.thedogs_source_identity parent
    ON parent.target_id=CASE source.payload->>'relationship'
      WHEN 'sire' THEN crosswalk.sire_id ELSE crosswalk.dam_id END
  LEFT JOIN public."PedigreeAssertion" canonical
    ON canonical.id=_giq_history_merge.history_id('pedassert','galtd:'||(source.payload->>'sourceId'))
)
INSERT INTO whole_source_reconciliation
SELECT 'galtd','assertions',count(*),count(*) FILTER(WHERE target_id IS NOT NULL),0,0,
  count(*) FILTER(WHERE target_id IS NULL),count(*)-count(DISTINCT source_key),0,
  count(*) FILTER(WHERE provenance_ok IS NOT TRUE),
  count(*) FILTER(WHERE actual_status IS DISTINCT FROM expected_status),0,
  count(*) FILTER(WHERE orphaned),count(*) FILTER(WHERE placeholder),
  jsonb_build_object('mappingBasis','subject source ID plus relationship','verificationStatuses',
    (SELECT jsonb_object_agg(actual_status,rows ORDER BY actual_status)
     FROM (SELECT coalesce(actual_status,'<missing>') AS actual_status,count(*) AS rows
       FROM assertions GROUP BY coalesce(actual_status,'<missing>')) grouped),
    'artifacts',(SELECT jsonb_object_agg(artifact_sha,rows ORDER BY artifact_sha)
      FROM (SELECT payload->>'artifactSha256' AS artifact_sha,count(*) AS rows
        FROM _giq_history_stage.galtd_assertion GROUP BY payload->>'artifactSha256') artifacts))
FROM assertions;

-- Standalone replay evidence is never promoted by itself: existing membership or quarantine only.
WITH resolution AS (
  SELECT source.provider_video_id,source.last_evidence_status,source.contract_sha256,
    disposition.disposition,disposition.snapshot_rows,
    EXISTS(SELECT 1 FROM public."RaceVideo" video WHERE lower(video."sourceProvider")='thedogs'
      AND video.kind='replay' AND video."sourceId"=source.provider_video_id) AS target_exists
  FROM _giq_history_stage.replay_standalone_only_provider_id source
  LEFT JOIN _giq_history_merge.replay_standalone_membership_disposition disposition
    USING(provider_video_id)
)
INSERT INTO whole_source_reconciliation
SELECT 'replay-evidence','standalone-provider-id',count(*),0,
  count(*) FILTER(WHERE disposition='present_in_cloned_race_video' AND target_exists),
  count(*) FILTER(WHERE disposition IN ('explicitly_missing','quarantined')),
  count(*) FILTER(WHERE disposition IS NULL OR
    (disposition='present_in_cloned_race_video' AND NOT target_exists)),
  count(*)-count(DISTINCT provider_video_id),0,
  count(*) FILTER(WHERE contract_sha256<>(SELECT replay_evidence_contract_sha256
    FROM _giq_history_merge.run WHERE id=1)),
  count(*) FILTER(WHERE disposition NOT IN ('present_in_cloned_race_video','explicitly_missing','quarantined')),
  count(*) FILTER(WHERE snapshot_rows NOT IN (0,1)),0,0,
  jsonb_build_object('mappingBasis','provider video ID','importedFromStandaloneEvidence',false)
FROM resolution;

-- Manifest, identity, relationship and content-integrity checks are all data-derived.
INSERT INTO whole_source_integrity
SELECT 'source_partition_equation',count(*),jsonb_build_object('checkedPartitions',
  (SELECT count(*) FROM whole_source_reconciliation))
FROM whole_source_reconciliation
WHERE source_rows<>imported_rows+merged_rows+quarantined_rows
UNION ALL
SELECT 'source_unaccounted_rows',coalesce(sum(unaccounted_rows),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_duplicate_keys',coalesce(sum(duplicate_source_keys),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_payload_mismatches',coalesce(sum(payload_mismatches),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_provenance_mismatches',coalesce(sum(provenance_mismatches),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_verification_mismatches',coalesce(sum(verification_mismatches),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_mapping_conflicts',coalesce(sum(mapping_conflicts),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_orphans',coalesce(sum(orphan_rows),0),'{}'::jsonb
FROM whole_source_reconciliation
UNION ALL
SELECT 'source_placeholders',coalesce(sum(placeholder_rows),0),'{}'::jsonb
FROM whole_source_reconciliation;

INSERT INTO whole_source_integrity
SELECT 'r2_payload_manifest',count(*),jsonb_build_object('tablesCompared',
  (SELECT count(*) FROM whole_r2_manifest),'manifest',
  (SELECT jsonb_object_agg(table_name,jsonb_build_object('rows',row_count,'rowMd5',row_md5)
    ORDER BY table_name) FROM whole_r2_manifest))
FROM whole_r2_manifest actual
FULL JOIN _giq_history_merge.r2_stage_table_manifest expected USING(table_name)
WHERE actual.table_name IS NULL OR expected.table_name IS NULL
   OR (actual.row_count,actual.row_md5) IS DISTINCT FROM (expected.row_count,expected.row_md5)
UNION ALL
SELECT 'normalized_gcs_manifest_binding',count(*),jsonb_build_object('datasetsCompared',
  (SELECT count(*) FROM whole_export_manifest),'manifest',
  (SELECT jsonb_object_agg(actual.dataset,jsonb_build_object(
      'rows',actual.row_count,'artifactSha256',expected.expected_sha256) ORDER BY actual.dataset)
    FROM whole_export_manifest actual
    JOIN _giq_history_merge.export_dataset_manifest expected USING(dataset)))
FROM whole_export_manifest actual
FULL JOIN _giq_history_merge.export_dataset_manifest expected USING(dataset)
WHERE actual.dataset IS NULL OR expected.dataset IS NULL
   OR actual.row_count IS DISTINCT FROM expected.observed_rows
   OR actual.row_count IS DISTINCT FROM expected.expected_rows
   OR expected.expected_sha256 !~ '^[0-9a-f]{64}$'
   OR (SELECT export_stage_manifest#>>ARRAY['datasets',expected.dataset,'sha256']
       FROM _giq_history_merge.run WHERE id=1) IS DISTINCT FROM expected.expected_sha256
UNION ALL
SELECT 'source_snapshot_manifest_binding',count(*),jsonb_build_object('tablesCompared',
  (SELECT count(*) FROM _giq_history_merge.source_snapshot_manifest),'manifest',
  (SELECT jsonb_object_agg(table_name,jsonb_build_object('rows',row_count,'rowDigest',row_digest)
    ORDER BY table_name) FROM _giq_history_merge.source_snapshot_manifest))
FROM _giq_history_merge.source_snapshot_manifest source
FULL JOIN _giq_history_merge.snapshot_table_manifest restored USING(table_name)
WHERE source.table_name IS NULL OR restored.table_name IS NULL
   OR (source.row_count,source.row_digest) IS DISTINCT FROM (restored.row_count,restored.row_digest)
UNION ALL
SELECT 'snapshot_core_key_coverage',count(*),jsonb_build_object('tablesCompared',
  (SELECT count(*) FROM _giq_history_merge.snapshot_table_manifest WHERE historical_core))
FROM _giq_history_merge.snapshot_table_manifest manifest
LEFT JOIN (
  SELECT table_name,count(*) AS key_rows FROM _giq_history_merge.snapshot_core_key GROUP BY table_name
) keys USING(table_name)
WHERE manifest.historical_core AND manifest.row_count<>coalesce(keys.key_rows,0)
UNION ALL
SELECT 'protected_production_payloads',count(*),jsonb_build_object('tablesCompared',
  (SELECT count(*) FROM whole_protected_manifest),'manifest',
  (SELECT jsonb_object_agg(table_name,jsonb_build_object('rows',row_count,'rowMd5',row_md5)
    ORDER BY table_name) FROM whole_protected_manifest))
FROM whole_protected_manifest actual
FULL JOIN _giq_history_merge.protected_table_manifest expected USING(table_name)
WHERE actual.table_name IS NULL OR expected.table_name IS NULL
   OR (actual.row_count,actual.row_md5) IS DISTINCT FROM (expected.row_count,expected.row_md5);

INSERT INTO whole_source_integrity
WITH mapping AS (
  SELECT 'Track' AS entity,natural_key,target_id FROM _giq_history_stage.track_map
  UNION ALL SELECT 'Trainer',natural_key,target_id FROM _giq_history_stage.trainer_map
  UNION ALL SELECT 'Dog',natural_key,target_id FROM _giq_history_stage.dog_map
  UNION ALL SELECT 'Meeting',natural_key,target_id FROM _giq_history_stage.meeting_map
  UNION ALL SELECT 'Race',natural_key,target_id FROM _giq_history_stage.race_map
  UNION ALL SELECT 'Runner',natural_key,target_id FROM _giq_history_stage.runner_map
  UNION ALL SELECT 'Result',natural_key,target_id FROM _giq_history_stage.result_map
), conflicts AS (
  SELECT entity,natural_key FROM mapping GROUP BY entity,natural_key HAVING count(DISTINCT target_id)<>1
  UNION ALL
  SELECT entity,target_id FROM mapping GROUP BY entity,target_id HAVING count(DISTINCT natural_key)<>1
)
SELECT 'stable_natural_key_mapping',count(*),'{}'::jsonb FROM conflicts
UNION ALL
SELECT 'provider_key_mapping',count(*),'{}'::jsonb FROM (
  SELECT entity,provider_key FROM (
    SELECT 'Dog' AS entity,payload->>'sourceId' AS provider_key,payload->>'naturalKey' AS natural_key
      FROM _giq_history_stage.export_profiles
    UNION ALL SELECT 'Meeting',payload->>'sourceId',payload->>'naturalKey'
      FROM _giq_history_stage.export_meetings
    UNION ALL SELECT 'Race',payload->>'sourceId',payload->>'naturalKey'
      FROM _giq_history_stage.export_races
    UNION ALL SELECT 'Runner',payload->>'sourceId',payload->>'naturalKey'
      FROM _giq_history_stage.export_runners
    UNION ALL SELECT 'Result',payload->>'sourceId',payload->>'naturalKey'
      FROM _giq_history_stage.export_results
    UNION ALL SELECT 'Trainer',payload->>'trainerSourceId',
      'thedogs:trainer:'||(payload->>'trainerSourceId')
      FROM _giq_history_stage.export_runners
      WHERE nullif(payload->>'trainerSourceId','') IS NOT NULL
  ) source
  WHERE nullif(provider_key,'') IS NOT NULL
  GROUP BY entity,provider_key
  HAVING count(DISTINCT natural_key)<>1 OR (entity<>'Trainer' AND count(*)<>1)
) conflicts
UNION ALL
SELECT 'galtd_provider_key_duplicates',count(*),'{}'::jsonb FROM (
  SELECT payload->>'sourceId' AS source_id FROM _giq_history_stage.galtd_observation
    GROUP BY payload->>'sourceId' HAVING count(*)<>1
  UNION ALL
  SELECT payload->>'sourceId' FROM _giq_history_stage.galtd_assertion
    GROUP BY payload->>'sourceId' HAVING count(*)<>1
) duplicate
UNION ALL
SELECT 'media_provider_key_mapping',count(*),'{}'::jsonb FROM (
  SELECT payload->>'kind' AS kind,payload->>'sourceId' AS provider_key
  FROM _giq_history_stage.media_resolution
  WHERE nullif(payload->>'sourceId','') IS NOT NULL
  GROUP BY payload->>'kind',payload->>'sourceId'
  HAVING count(DISTINCT race_id)>1
    AND bool_or(disposition<>'quarantined-provider-id-race-conflict')
) conflicts
UNION ALL
SELECT 'canonical_provider_duplicates',count(*),'{}'::jsonb FROM (
  SELECT 1 FROM public."Dog" WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
    GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."Trainer" trainer
    JOIN public."Runner" runner ON runner."trainerId"=trainer.id
    WHERE runner."sourceRawJson" IS NOT NULL
      AND nullif(_giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId','') IS NOT NULL
    GROUP BY lower(coalesce(runner."sourceProvider",'')),
      _giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId'
    HAVING count(DISTINCT trainer.id)>1
  UNION ALL SELECT 1 FROM public."DogProfileForm"
    GROUP BY "dogId",lower("sourceProvider"),"sourceId" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."RaceVideo"
    GROUP BY "raceId",lower("sourceProvider"),kind HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."RaceVideo" WHERE "sourceId" IS NOT NULL
    GROUP BY lower("sourceProvider"),kind,"sourceId" HAVING count(DISTINCT "raceId")>1
  UNION ALL SELECT 1 FROM public."DogProfileArchive"
    GROUP BY lower("sourceProvider"),"sourceId" HAVING count(*)>1
) duplicate
UNION ALL
SELECT 'canonical_natural_key_duplicates',count(*),'{}'::jsonb FROM (
  SELECT 1 FROM public."Track"
    GROUP BY _giq_history_merge.track_key(name,state) HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."Meeting" GROUP BY "trackId","meetingDate" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."Race" GROUP BY "meetingId","raceNumber" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."Runner" GROUP BY "raceId","boxNumber" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."Result" GROUP BY "runnerId" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."FormEntry" WHERE "raceId" IS NOT NULL
    GROUP BY "dogId","raceId" HAVING count(*)>1
  UNION ALL SELECT 1 FROM public."RaceDayArchive"
    GROUP BY lower("sourceProvider"),date HAVING count(*)>1
) duplicate
UNION ALL
SELECT 'provider_identity_shape',count(*),'{}'::jsonb FROM (
  SELECT id FROM public."Dog" WHERE lower("sourceProvider")='thedogs'
    AND ("sourceId" IS NULL OR "sourceId"!~'^[0-9]+$')
  UNION ALL SELECT id FROM public."RaceVideo" WHERE lower("sourceProvider")='thedogs'
    AND kind='replay' AND ("sourceId" IS NULL OR "sourceId"!~'^[0-9]+$')
  UNION ALL SELECT id FROM public."DogSourceIdentity" WHERE "sourceProvider"='galtd'
    AND ("sourceId" IS NULL OR "sourceId"!~'^galtd:' OR "evidenceSha256" IS NULL
      OR "evidenceSha256"!~'^[0-9a-f]{64}$')
) invalid
UNION ALL
SELECT 'provider_stub_integrity',count(*),'{}'::jsonb
FROM _giq_history_stage.normalized_dog
WHERE verification_class='provider-stub'
  AND (source_provider IS DISTINCT FROM 'thedogs' OR source_id IS NULL OR source_id!~'^[0-9]+$'
    OR nullif(btrim(name),'') IS NULL OR lower(btrim(name))~'^(unknown|n/?a|placeholder|tbd)$')
UNION ALL
SELECT 'synthetic_identifier_cleanup',count(*),'{}'::jsonb
FROM public."Dog" WHERE "earBrand"~'^thedogs:[0-9]+$'
UNION ALL
SELECT 'production_update_audit_integrity',count(*),jsonb_build_object('auditedRows',
  (SELECT count(*) FROM _giq_history_merge.production_row_update_audit))
FROM _giq_history_merge.production_row_update_audit
WHERE table_name NOT IN (
    'Track','Trainer','Dog','Meeting','Race','Runner','Result','FormEntry',
    'DogProfileForm','RaceVideo','DogProfileArchive','RaceDayArchive'
  ) OR cardinality(changed_fields)=0
  OR before_sha256!~'^[0-9a-f]{64}$' OR after_sha256!~'^[0-9a-f]{64}$'
  OR before_sha256=after_sha256;

INSERT INTO whole_source_integrity
WITH conflicts AS (
  SELECT n.target_id FROM _giq_history_stage.normalized_track n
  LEFT JOIN public."Track" target ON target.id=n.target_id
  WHERE target.id IS NULL OR _giq_history_merge.track_key(target.name,target.state)<>n.natural_key
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_dog n
  LEFT JOIN public."Dog" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (n.source_provider IS NOT NULL AND n.source_id IS NOT NULL
    AND (lower(target."sourceProvider") IS DISTINCT FROM lower(n.source_provider)
      OR target."sourceId" IS DISTINCT FROM n.source_id))
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_trainer n
  LEFT JOIN public."Trainer" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (
    n.source_id IS NULL AND n.target_id LIKE 'hist_%' AND target.name IS DISTINCT FROM n.name
  ) OR (
    n.source_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public."Runner" runner
      WHERE runner."trainerId"=n.target_id
        AND _giq_history_merge.try_jsonb(runner."sourceRawJson")->>'trainerId'=n.source_id
    )
  )
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_meeting n
  LEFT JOIN public."Meeting" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (target."trackId",target."meetingDate")
    IS DISTINCT FROM (n.track_id,n.meeting_date)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_race n
  LEFT JOIN public."Race" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (target."meetingId",target."raceNumber")
    IS DISTINCT FROM (n.meeting_id,n.race_number)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_runner n
  LEFT JOIN public."Runner" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (target."raceId",target."boxNumber")
    IS DISTINCT FROM (n.race_id,n.box_number)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_result n
  LEFT JOIN public."Result" target ON target.id=n.target_id
  WHERE target.id IS NULL OR target."runnerId" IS DISTINCT FROM n.runner_id
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_form_entry n
  LEFT JOIN public."FormEntry" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (target."dogId",target."raceId")
    IS DISTINCT FROM (n.dog_id,n.race_id)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_profile_form n
  LEFT JOIN public."DogProfileForm" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (target."dogId",lower(target."sourceProvider"),target."sourceId")
    IS DISTINCT FROM (n.dog_id,lower(n.source_provider),n.source_id)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_race_video n
  LEFT JOIN public."RaceVideo" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (target."raceId",lower(target."sourceProvider"),target.kind)
    IS DISTINCT FROM (n.race_id,lower(n.source_provider),n.kind)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_dog_profile_archive n
  LEFT JOIN public."DogProfileArchive" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (lower(target."sourceProvider"),target."sourceId")
    IS DISTINCT FROM (lower(n.source_provider),n.provider_source_id)
  UNION ALL
  SELECT n.target_id FROM _giq_history_stage.normalized_race_day_archive n
  LEFT JOIN public."RaceDayArchive" target ON target.id=n.target_id
  WHERE target.id IS NULL OR (lower(target."sourceProvider"),target.date)
    IS DISTINCT FROM (lower(n.source_provider),n.date)
)
SELECT 'canonical_target_identity',count(*),'{}'::jsonb FROM conflicts;

INSERT INTO whole_source_integrity
WITH expected AS (
  SELECT 'thedogs'::text AS source_provider,run.normalized_manifest_sha256 AS artifact_sha256,
    (SELECT count(*) FROM _giq_history_stage.thedogs_source_identity) AS records_observed,
    (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge) AS assertions_observed,
    (SELECT count(*) FROM _giq_history_stage.normalized_pedigree_edge WHERE NOT canonical_eligible) AS issues_observed,
    200::integer AS source_authority,'parsed'::text AS verification_status
  FROM _giq_history_merge.run run WHERE run.id=1
  UNION ALL
  SELECT 'galtd',observation.payload->>'artifactSha256',count(*),
    (SELECT count(*) FROM _giq_history_stage.galtd_assertion assertion
      WHERE assertion.payload->>'artifactSha256'=observation.payload->>'artifactSha256'),
    count(*) FILTER(WHERE observation.payload ? 'conflictGroup'),100,
    CASE WHEN count(*) FILTER(WHERE observation.payload ? 'conflictGroup')>0
      THEN 'conflict' ELSE 'parsed' END
  FROM _giq_history_stage.galtd_observation observation
  GROUP BY observation.payload->>'artifactSha256'
), compared AS (
  SELECT expected.source_provider
  FROM expected
  LEFT JOIN public."PedigreeImportRun" actual
    ON actual."sourceProvider"=expected.source_provider
   AND actual."artifactSha256"=expected.artifact_sha256
  WHERE actual.id IS NULL
    OR actual."recordsObserved" IS DISTINCT FROM expected.records_observed
    OR actual."assertionsObserved" IS DISTINCT FROM expected.assertions_observed
    OR actual."issuesObserved" IS DISTINCT FROM expected.issues_observed
    OR actual."sourceAuthority" IS DISTINCT FROM expected.source_authority
    OR actual."verificationStatus" IS DISTINCT FROM expected.verification_status
    OR actual.status<>'parsed'
)
SELECT 'pedigree_import_run_provenance',count(*),jsonb_build_object(
  'expectedRuns',(SELECT count(*) FROM expected)) FROM compared;

INSERT INTO whole_source_integrity
SELECT 'thedogs_identity_provenance',count(*),jsonb_build_object('identitiesChecked',
  (SELECT count(*) FROM _giq_history_stage.thedogs_source_identity))
FROM _giq_history_stage.thedogs_source_identity source
LEFT JOIN public."DogSourceIdentity" actual ON actual.id=source.identity_id
WHERE actual.id IS NULL OR actual."dogId" IS DISTINCT FROM source.target_id
   OR actual."importRunId" IS DISTINCT FROM source.import_run_id
   OR actual."sourceProvider"<>'thedogs'
   OR actual."artifactSha256" IS DISTINCT FROM
      (SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1)
   OR actual."sourceId" IS DISTINCT FROM source.source_id
   OR actual."sourceName" IS DISTINCT FROM source.name
   OR actual."normalizedName" IS DISTINCT FROM _giq_history_merge.slug(source.name)
   OR actual."sourceAuthority"<>200 OR actual."verificationStatus"<>'parsed'
   OR actual."evidenceSha256" IS DISTINCT FROM
      encode(digest(source.source_provenance::text,'sha256'),'hex');

CREATE TEMP TABLE whole_foreign_key_check (
  child_schema text NOT NULL,
  child_table text NOT NULL,
  constraint_name text NOT NULL,
  parent_schema text NOT NULL,
  parent_table text NOT NULL,
  child_columns text[] NOT NULL,
  parent_columns text[] NOT NULL,
  match_type "char" NOT NULL,
  constraint_valid boolean NOT NULL,
  orphan_rows bigint NOT NULL,
  PRIMARY KEY(child_schema,child_table,constraint_name)
) ON COMMIT DROP;

INSERT INTO whole_foreign_key_check(
  child_schema,child_table,constraint_name,parent_schema,parent_table,
  child_columns,parent_columns,match_type,constraint_valid,orphan_rows
)
SELECT
  child_namespace.nspname,child_relation.relname,constraint_row.conname,
  parent_namespace.nspname,parent_relation.relname,
  key_columns.child_columns,key_columns.parent_columns,
  constraint_row.confmatchtype,constraint_row.convalidated,0
FROM pg_constraint constraint_row
JOIN pg_class child_relation ON child_relation.oid=constraint_row.conrelid
JOIN pg_namespace child_namespace ON child_namespace.oid=child_relation.relnamespace
JOIN pg_class parent_relation ON parent_relation.oid=constraint_row.confrelid
JOIN pg_namespace parent_namespace ON parent_namespace.oid=parent_relation.relnamespace
CROSS JOIN LATERAL (
  SELECT
    array_agg(child_attribute.attname ORDER BY paired.ordinality)::text[] AS child_columns,
    array_agg(parent_attribute.attname ORDER BY paired.ordinality)::text[] AS parent_columns
  FROM unnest(constraint_row.conkey,constraint_row.confkey) WITH ORDINALITY
    AS paired(child_attnum,parent_attnum,ordinality)
  JOIN pg_attribute child_attribute
    ON child_attribute.attrelid=constraint_row.conrelid
   AND child_attribute.attnum=paired.child_attnum
  JOIN pg_attribute parent_attribute
    ON parent_attribute.attrelid=constraint_row.confrelid
   AND parent_attribute.attnum=paired.parent_attnum
) key_columns
WHERE constraint_row.contype='f' AND child_namespace.nspname='public';

DO $$
DECLARE
  fk record;
  join_predicate text;
  all_nonnull_predicate text;
  any_nonnull_predicate text;
  enforcement_predicate text;
  observed_orphans bigint;
BEGIN
  FOR fk IN SELECT * FROM whole_foreign_key_check
    ORDER BY child_schema,child_table,constraint_name
  LOOP
    SELECT
      string_agg(format('child.%I IS NOT DISTINCT FROM parent.%I',child_column,parent_column),
        ' AND ' ORDER BY ordinality),
      string_agg(format('child.%I IS NOT NULL',child_column),' AND ' ORDER BY ordinality),
      string_agg(format('child.%I IS NOT NULL',child_column),' OR ' ORDER BY ordinality)
    INTO join_predicate,all_nonnull_predicate,any_nonnull_predicate
    FROM unnest(fk.child_columns,fk.parent_columns) WITH ORDINALITY
      AS paired(child_column,parent_column,ordinality);
    enforcement_predicate:=CASE fk.match_type
      WHEN 'f' THEN '('||any_nonnull_predicate||')'
      ELSE '('||all_nonnull_predicate||')'
    END;
    EXECUTE format('SELECT count(*) FROM %I.%I child WHERE %s AND NOT EXISTS('
      'SELECT 1 FROM %I.%I parent WHERE %s)',
      fk.child_schema,fk.child_table,enforcement_predicate,
      fk.parent_schema,fk.parent_table,join_predicate)
      INTO observed_orphans;
    UPDATE whole_foreign_key_check SET orphan_rows=observed_orphans
    WHERE child_schema=fk.child_schema AND child_table=fk.child_table
      AND constraint_name=fk.constraint_name;
  END LOOP;
END
$$;

INSERT INTO whole_source_integrity
SELECT 'canonical_foreign_key_orphans',
  coalesce(sum(orphan_rows),0)+count(*) FILTER(WHERE NOT constraint_valid),
  jsonb_build_object('constraintsChecked',count(*),
    'unvalidatedConstraints',count(*) FILTER(WHERE NOT constraint_valid),
    'orphanRows',coalesce(sum(orphan_rows),0)) FROM whole_foreign_key_check
UNION ALL
SELECT 'canonical_placeholders',count(*),'{}'::jsonb FROM (
  SELECT id FROM public."Dog"
    WHERE nullif(btrim(name),'') IS NULL OR lower(btrim(name))~'^(unknown|n/?a|placeholder|tbd)$'
  UNION ALL SELECT id FROM public."Track"
    WHERE nullif(btrim(name),'') IS NULL OR lower(btrim(name))~'^(unknown|n/?a|placeholder|tbd)$'
  UNION ALL SELECT id FROM public."Trainer"
    WHERE nullif(btrim(name),'') IS NULL OR lower(btrim(name))~'^(unknown|n/?a|placeholder|tbd)$'
  UNION ALL SELECT id FROM public."Race" WHERE name IS NOT NULL
    AND (nullif(btrim(name),'') IS NULL OR lower(btrim(name))~'^(unknown|n/?a|placeholder|tbd)$')
  UNION ALL SELECT id FROM public."DogSourceIdentity"
    WHERE nullif(btrim("sourceName"),'') IS NULL
       OR lower(btrim("sourceName"))~'^(unknown|n/?a|placeholder|tbd)$'
       OR nullif(btrim("normalizedName"),'') IS NULL
  UNION ALL SELECT id FROM public."PedigreeAssertion"
    WHERE nullif(btrim("assertedParentName"),'') IS NULL
       OR lower(btrim("assertedParentName"))~'^(unknown|n/?a|placeholder|tbd)$'
       OR nullif(btrim("assertedParentNormalizedName"),'') IS NULL
) placeholder
UNION ALL
SELECT 'canonical_self_parent',count(*),'{}'::jsonb FROM public."Dog" WHERE id="sireId" OR id="damId"
UNION ALL
SELECT 'canonical_duplicate_parents',count(*),'{}'::jsonb FROM public."Dog"
WHERE "sireId" IS NOT NULL AND "sireId"="damId"
UNION ALL
SELECT 'pedigree_decision_consistency',count(*),'{}'::jsonb FROM (
  SELECT decision.natural_key
  FROM _giq_history_stage.pedigree_merge_decision decision
  JOIN public."Dog" dog ON dog.id=decision.child_id
  WHERE CASE decision.decision
    WHEN 'no_change' THEN (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
      IS DISTINCT FROM decision.parent_id
    WHEN 'pending_authoritative_verification' THEN
      (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NOT NULL
    WHEN 'preserved_higher_authority' THEN
      (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END) IS NULL
      OR (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)=decision.parent_id
    ELSE false END
  UNION ALL
  SELECT decision.payload->>'sourceId'
  FROM _giq_history_stage.galtd_merge_decision decision
  JOIN public."Dog" dog ON dog.id=decision.child_id
  WHERE decision.decision IN ('accepted','no_change')
    AND (CASE decision.relationship WHEN 'sire' THEN dog."sireId" ELSE dog."damId" END)
      IS DISTINCT FROM decision.proposed_parent_id
) inconsistent
UNION ALL
SELECT 'blocking_quarantine',count(*),'{}'::jsonb FROM _giq_history_merge.quarantine WHERE blocking
UNION ALL
SELECT 'pending_authoritative_pedigree',count(*),jsonb_build_object('status','blocked-until-authoritatively-verified')
FROM _giq_history_stage.pedigree_merge_decision WHERE decision='pending_authoritative_verification'
UNION ALL
SELECT 'invalid_pedigree_status',count(*),'{}'::jsonb FROM public."PedigreeAssertion"
WHERE "verificationStatus" NOT IN ('parsed','verified','conflict','rejected');

CREATE TEMP TABLE whole_pedigree_edge (
  child_id text NOT NULL,
  parent_id text NOT NULL,
  PRIMARY KEY(child_id,parent_id)
) ON COMMIT DROP;
INSERT INTO whole_pedigree_edge
SELECT id,"sireId" FROM public."Dog" WHERE "sireId" IS NOT NULL
UNION
SELECT id,"damId" FROM public."Dog" WHERE "damId" IS NOT NULL;
CREATE INDEX whole_pedigree_edge_parent_idx ON whole_pedigree_edge(parent_id);

CREATE TEMP TABLE whole_pedigree_cycle_result (
  initial_edges bigint NOT NULL,
  pruned_edges bigint NOT NULL,
  remaining_edges bigint NOT NULL,
  pruning_rounds integer NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  initial_count bigint;
  remaining_count bigint;
  removed_count bigint;
  total_removed bigint:=0;
  rounds integer:=0;
BEGIN
  SELECT count(*) INTO initial_count FROM whole_pedigree_edge;
  LOOP
    DELETE FROM whole_pedigree_edge edge
    WHERE NOT EXISTS(SELECT 1 FROM whole_pedigree_edge parent_edge
      WHERE parent_edge.child_id=edge.parent_id);
    GET DIAGNOSTICS removed_count=ROW_COUNT;
    EXIT WHEN removed_count=0;
    total_removed:=total_removed+removed_count;
    rounds:=rounds+1;
  END LOOP;
  SELECT count(*) INTO remaining_count FROM whole_pedigree_edge;
  INSERT INTO whole_pedigree_cycle_result
  VALUES(initial_count,total_removed,remaining_count,rounds);
END
$$;

INSERT INTO whole_source_integrity
SELECT 'canonical_pedigree_cycles',remaining_edges,
  jsonb_build_object('initialEdges',initial_edges,'prunedEdges',pruned_edges,
    'remainingCycleBoundEdges',remaining_edges,'pruningRounds',pruning_rounds,
    'algorithm','indexed-root-pruning')
FROM whole_pedigree_cycle_result;

SELECT EXISTS(
  SELECT 1 FROM whole_source_reconciliation
  WHERE source_rows<>imported_rows+merged_rows+quarantined_rows
     OR unaccounted_rows<>0 OR duplicate_source_keys<>0 OR payload_mismatches<>0
     OR provenance_mismatches<>0 OR verification_mismatches<>0
     OR mapping_conflicts<>0 OR orphan_rows<>0 OR placeholder_rows<>0
  UNION ALL
  SELECT 1 FROM whole_source_integrity WHERE failure_rows<>0
) AS whole_source_blocked \gset

INSERT INTO _giq_history_merge.verification_check(check_name,metrics)
SELECT 'whole_source_reconciliation',jsonb_build_object(
  'complete',NOT :'whole_source_blocked'::boolean,
  'countSource','recomputed-from-staged-and-canonical-data',
  'partitions',(SELECT jsonb_object_agg(
      source_domain||':'||source_entity,
      to_jsonb(partition)-'source_domain'-'source_entity' ORDER BY source_domain,source_entity)
    FROM whole_source_reconciliation partition),
  'integrity',(SELECT jsonb_object_agg(check_name,
      jsonb_build_object('failureRows',failure_rows,'details',details) ORDER BY check_name)
    FROM whole_source_integrity),
  'blockers',(SELECT coalesce(jsonb_agg(check_name ORDER BY check_name),'[]'::jsonb)
    FROM whole_source_integrity WHERE failure_rows<>0)
)
ON CONFLICT(check_name) DO UPDATE
SET metrics=EXCLUDED.metrics,verified_at=clock_timestamp();

COMMIT;

SELECT jsonb_build_object(
  'event','WHOLE_SOURCE_RECONCILIATION_EVALUATED',
  'complete',NOT :'whole_source_blocked'::boolean,
  'sourceCountsRecomputed',true,
  'check',(SELECT metrics FROM _giq_history_merge.verification_check
    WHERE check_name='whole_source_reconciliation')
);

\if :whole_source_blocked
\echo 'OPERATOR_ATTENTION: whole-source reconciliation is incomplete; inspect aggregate blocker counts before promotion.'
\quit 3
\endif
