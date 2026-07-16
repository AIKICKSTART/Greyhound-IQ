\set ON_ERROR_STOP on

BEGIN READ ONLY;
SET LOCAL giq.migration_manifest TO :'migration_manifest';

DO $$
DECLARE
  observed_phase text;
  failed_rows bigint;
  missing_source_rows bigint;
  checksum_mismatches bigint;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'candidate migration preflight database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase FROM _giq_history_merge.run WHERE id=1;
  IF observed_phase<>'cloned' THEN
    RAISE EXCEPTION 'candidate migration requires cloned, observed %',observed_phase;
  END IF;

  SELECT count(*) INTO failed_rows
  FROM public."_prisma_migrations"
  WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF failed_rows<>0 THEN
    RAISE EXCEPTION 'candidate has % unfinished Prisma migrations',failed_rows;
  END IF;

  WITH source AS (
    SELECT item->>'name' AS name,item->>'sha256' AS sha256
    FROM jsonb_array_elements(current_setting('giq.migration_manifest')::jsonb) item
  )
  SELECT count(*) FILTER(WHERE source.name IS NULL),
         count(*) FILTER(WHERE source.name IS NOT NULL AND source.sha256<>ledger.checksum)
  INTO missing_source_rows,checksum_mismatches
  FROM public."_prisma_migrations" ledger
  LEFT JOIN source ON source.name=ledger.migration_name
  WHERE ledger.finished_at IS NOT NULL AND ledger.rolled_back_at IS NULL;

  IF missing_source_rows<>0 OR checksum_mismatches<>0 THEN
    RAISE EXCEPTION 'candidate migration lineage mismatch: absent source %, checksum mismatch %',
      missing_source_rows,checksum_mismatches;
  END IF;
END
$$;

COMMIT;
