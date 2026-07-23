\set ON_ERROR_STOP on

BEGIN;
SET LOCAL synchronous_commit=on;
SET LOCAL giq.replay_contract TO :'replay_contract';

DO $$
DECLARE
  observed_phase text;
  contract jsonb:=current_setting('giq.replay_contract')::jsonb;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'replay evidence stage database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id=1 FOR UPDATE;
  IF observed_phase<>'galtd_staged' THEN
    RAISE EXCEPTION 'replay evidence requires galtd_staged, observed %',observed_phase;
  END IF;
  IF contract->>'contractId'<>'thedogs-race-video-offline-evidence-20260716'
     OR contract->>'auditMode'<>'read-only'
     OR (contract#>>'{providerVideoIdComparison,standaloneOnly,count}')::integer<>145
     OR contract#>>'{providerVideoIdComparison,standaloneOnly,setSha256}'<>
        '32fe4a2b4d6b17dbde2c741b825ac22bd2fd7cc8df7f4f63ac096430f1d2dd41'
     OR (contract#>>'{trueProviderIdCollisions,count}')::integer<>11
     OR (contract#>>'{trueProviderIdCollisions,rows}')::integer<>22
     OR (contract#>>'{normalizedRaceMedia,exactRaceReplay,raceNaturalKeysWithMultipleProviderVideoIds}')::integer<>0
     OR (contract#>>'{candidateReconciliation,importFromStandaloneLogAllowed}')::boolean THEN
    RAISE EXCEPTION 'replay evidence contract changed or permits unsafe import';
  END IF;
END
$$;

DROP TABLE IF EXISTS _giq_history_stage.replay_standalone_only_provider_id;
CREATE TABLE _giq_history_stage.replay_standalone_only_provider_id (
  provider_video_id text PRIMARY KEY,
  last_evidence_status integer NOT NULL CHECK(last_evidence_status IN (200,500)),
  contract_sha256 text NOT NULL
);

INSERT INTO _giq_history_stage.replay_standalone_only_provider_id
  (provider_video_id,last_evidence_status,contract_sha256)
SELECT value,200,:'contract_sha256'
FROM jsonb_array_elements_text(
  (:'replay_contract'::jsonb)#>'{standaloneOnlyProviderIdsByLastEvidenceStatus,200,providerVideoIds}'
)
UNION ALL
SELECT value,500,:'contract_sha256'
FROM jsonb_array_elements_text(
  (:'replay_contract'::jsonb)#>'{standaloneOnlyProviderIdsByLastEvidenceStatus,500,providerVideoIds}'
);

DO $$
DECLARE
  total bigint;
  playable bigint;
  failed bigint;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE last_evidence_status=200),
         count(*) FILTER(WHERE last_evidence_status=500)
  INTO total,playable,failed
  FROM _giq_history_stage.replay_standalone_only_provider_id;
  IF (total,playable,failed)<>(145::bigint,57::bigint,88::bigint) THEN
    RAISE EXCEPTION 'standalone-only replay evidence partition changed: total %, 200 %, 500 %',
      total,playable,failed;
  END IF;
END
$$;

UPDATE _giq_history_merge.run
SET replay_evidence_contract_sha256=:'contract_sha256',
    replay_evidence_staged_at=clock_timestamp()
WHERE id=1;

REVOKE ALL ON _giq_history_stage.replay_standalone_only_provider_id FROM PUBLIC;
COMMIT;
