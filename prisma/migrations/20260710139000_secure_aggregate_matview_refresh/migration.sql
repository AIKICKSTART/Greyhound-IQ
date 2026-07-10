-- Aggregate refreshes run from the restricted application role, while the
-- materialized views remain owned by the migration role. Expose only this
-- allowlisted maintenance operation instead of transferring view ownership.

CREATE OR REPLACE FUNCTION public.giq_refresh_aggregate_matview(
  requested_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF requested_name IS NULL OR NOT requested_name = ANY (ARRAY[
    'giq_sire_leaderboard',
    'giq_box_bias',
    'giq_trainer_leaderboard',
    'giq_trainer_performance',
    'giq_track_records'
  ]::text[]) THEN
    RAISE EXCEPTION 'aggregate.invalid_view' USING ERRCODE = '42501';
  END IF;

  EXECUTE pg_catalog.format(
    'REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I',
    requested_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.giq_refresh_aggregate_matview(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_refresh_aggregate_matview(text)
      TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_refresh_aggregate_matview(text)
      TO greyhoundiq_app;
  END IF;
END;
$$;
