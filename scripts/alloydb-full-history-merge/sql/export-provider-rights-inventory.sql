\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout TO '15min';
SET LOCAL lock_timeout TO '5s';

DO $$
DECLARE
  marker_count bigint;
  marker_sha256 text;
BEGIN
  SELECT count(*), min(normalized_manifest_sha256)
  INTO marker_count, marker_sha256
  FROM _giq_history_merge.run
  WHERE id=1;

  IF marker_count<>1 OR marker_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'provider rights inventory requires one valid normalized source marker';
  END IF;
END
$$;

WITH provider_uses(provider_key,data_scope,jurisdiction,required_permissions,row_count) AS (
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'dog_profiles','AUS',
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."Dog"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'dog_profile_evidence','AUS',
         ARRAY['ingestion','storage','normalization']::text[],
         count(*)::bigint
  FROM public."DogProfileObservation"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'dog_profile_evidence','AUS',
         ARRAY['ingestion','storage','normalization']::text[],
         count(*)::bigint
  FROM public."DogProfileMergeLedger"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'historical_form','AUS',
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."DogProfileForm"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'raw_dog_profiles','AUS',
         ARRAY['ingestion','storage','normalization']::text[],
         count(*)::bigint
  FROM public."DogProfileArchive"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'raw_race_archives','AUS',
         ARRAY['ingestion','storage','normalization']::text[],
         count(*)::bigint
  FROM public."RaceDayArchive"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim(meeting."sourceProvider"),''),'unattributed')),
         'race_cards',
         CASE WHEN upper(btrim(track.state)) IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
              THEN upper(btrim(track.state)) ELSE 'UNATTRIBUTED' END,
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."Meeting" meeting
  JOIN public."Track" track ON track.id=meeting."trackId"
  GROUP BY 1,3

  UNION ALL
  SELECT lower(coalesce(nullif(btrim(race."sourceProvider"),''),'unattributed')),
         'race_cards',
         CASE WHEN upper(btrim(track.state)) IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
              THEN upper(btrim(track.state)) ELSE 'UNATTRIBUTED' END,
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."Race" race
  JOIN public."Meeting" meeting ON meeting.id=race."meetingId"
  JOIN public."Track" track ON track.id=meeting."trackId"
  GROUP BY 1,3

  UNION ALL
  SELECT lower(coalesce(nullif(btrim(runner."sourceProvider"),''),'unattributed')),
         'runners',
         CASE WHEN upper(btrim(track.state)) IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
              THEN upper(btrim(track.state)) ELSE 'UNATTRIBUTED' END,
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."Runner" runner
  JOIN public."Race" race ON race.id=runner."raceId"
  JOIN public."Meeting" meeting ON meeting.id=race."meetingId"
  JOIN public."Track" track ON track.id=meeting."trackId"
  GROUP BY 1,3

  UNION ALL
  SELECT lower(coalesce(nullif(btrim(result."sourceProvider"),''),'unattributed')),
         'race_results',
         CASE WHEN upper(btrim(track.state)) IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
              THEN upper(btrim(track.state)) ELSE 'UNATTRIBUTED' END,
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."Result" result
  JOIN public."Race" race ON race.id=result."raceId"
  JOIN public."Meeting" meeting ON meeting.id=race."meetingId"
  JOIN public."Track" track ON track.id=meeting."trackId"
  GROUP BY 1,3

  UNION ALL
  SELECT lower(coalesce(nullif(btrim(video."sourceProvider"),''),'unattributed')),
         'replay_media',
         CASE WHEN upper(btrim(track.state)) IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
              THEN upper(btrim(track.state)) ELSE 'UNATTRIBUTED' END,
         ARRAY['ingestion','storage','normalization','display','analytics','replayRedistribution']::text[],
         count(*)::bigint
  FROM public."RaceVideo" video
  JOIN public."Race" race ON race.id=video."raceId"
  JOIN public."Meeting" meeting ON meeting.id=race."meetingId"
  JOIN public."Track" track ON track.id=meeting."trackId"
  GROUP BY 1,3

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'pedigree','AUS',
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."PedigreeImportRun"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'pedigree','AUS',
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."DogSourceIdentity"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'pedigree','AUS',
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."PedigreeAssertion"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim("sourceProvider"),''),'unattributed')),
         'pedigree','AUS',
         ARRAY['ingestion','storage','normalization','display','analytics']::text[],
         count(*)::bigint
  FROM public."PedigreeMergeLedger"
  GROUP BY 1

  UNION ALL
  SELECT lower(coalesce(nullif(btrim(provider),''),'unattributed')),
         'quarantine_evidence','AUS',
         ARRAY['ingestion','storage','normalization']::text[],
         count(*)::bigint
  FROM public."LiveFeedQuarantine"
  GROUP BY 1
), aggregated AS (
  SELECT provider_key,data_scope,jurisdiction,required_permissions,
         sum(row_count)::bigint AS row_count
  FROM provider_uses
  GROUP BY provider_key,data_scope,jurisdiction,required_permissions
), source_marker AS (
  SELECT normalized_manifest_sha256
  FROM _giq_history_merge.run
  WHERE id=1
)
SELECT jsonb_build_object(
  'schemaVersion','giq-provider-rights-inventory/v1',
  'sourceManifestSha256',source_marker.normalized_manifest_sha256,
  'generatedAt',to_char(transaction_timestamp() AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'entries',coalesce(
    jsonb_agg(
      jsonb_build_object(
        'providerKey',aggregated.provider_key,
        'dataScope',aggregated.data_scope,
        'jurisdiction',aggregated.jurisdiction,
        'requiredPermissions',to_jsonb(aggregated.required_permissions),
        'rowCount',aggregated.row_count
      )
      ORDER BY aggregated.provider_key,aggregated.data_scope,aggregated.jurisdiction
    ) FILTER (WHERE aggregated.provider_key IS NOT NULL),
    '[]'::jsonb
  )
)::text AS provider_rights_inventory
FROM source_marker
LEFT JOIN aggregated ON true
GROUP BY source_marker.normalized_manifest_sha256;

ROLLBACK;
