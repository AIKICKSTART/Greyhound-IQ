\set ON_ERROR_STOP on

BEGIN;
SET LOCAL giq.normalized_manifest_sha256 TO :'manifest_sha256';

DO $$
DECLARE
  observed_phase text;
BEGIN
  IF current_database() <> 'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'export stage database mismatch';
  END IF;
  SELECT phase INTO STRICT observed_phase
  FROM _giq_history_merge.run WHERE id = 1 FOR UPDATE;
  IF observed_phase NOT IN ('r2_staged', 'export_staged') THEN
    RAISE EXCEPTION 'export stage requires r2_staged, observed %', observed_phase;
  END IF;
  IF (SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id = 1)
     <> current_setting('giq.normalized_manifest_sha256') THEN
    RAISE EXCEPTION 'export manifest does not match candidate marker';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS _giq_history_stage.ingest_line (
  line_number bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line text NOT NULL
);

CREATE TABLE IF NOT EXISTS _giq_history_merge.export_dataset_manifest (
  dataset text PRIMARY KEY,
  expected_rows bigint NOT NULL,
  expected_bytes bigint NOT NULL,
  expected_sha256 text NOT NULL,
  observed_rows bigint,
  staged_at timestamptz
);

INSERT INTO _giq_history_merge.export_dataset_manifest
  (dataset, expected_rows, expected_bytes, expected_sha256)
VALUES
  ('profiles', 200211, 569294683, '4851af04b4de4eb160f5ff7f349049bc9d7184006c127f1b8ebcca7d53972be2'),
  ('pedigree_edges', 384568, 131970236, '092313971c5277deb74f5f05ed06d3b872b4e69cc8e9baf3a336854a7de89f2f'),
  ('profile_forms', 6474962, 6310539529, 'ea6b5d13e1e300a1ca5df77935e00e4d76be2d5eae1a7e5f884093922583e488'),
  ('meetings', 76620, 34341380, 'eab1c54db2a9e09c1d1c54d9c9ac1db1975770e7fdea304e91441651134887d4'),
  ('races', 838526, 608103659, '0ac28a9cd75bea90f51788c5cd9f364a7fa24f2f54455a0b31e829626767803b'),
  ('runners', 6434145, 4481555075, '6eff1714d34208a363110c0c4dc902ee5d7fb1a308aee2bc4ffe774a3c273b2a'),
  ('results', 5660837, 3162128000, 'b8fa047aee0b7f815c61900e2df898037b316d78edf5b423678985f2211b67d6'),
  ('archives', 207486, 126828012, '69357987a34c4f974a08ddde1a39dc296ec268e8f632403f73fcd32343ac6d92'),
  ('race_media', 538849, 323029819, '89b90198d3197238a2476381c0917108f21d2e209c02ca066e8ec90c1e8385b1'),
  ('duplicates', 1940, 502193, '5a9fae9f90ce4c28b8f1567cfd894f066e963405140237d215ceab3e5c556327'),
  ('orphans', 952809, 243437502, '5ef8d5126ac0f9ff4631592b0bca46afc758bec4482e179daadf9d1db37b2450'),
  ('quarantine', 197, 40965, '0c152f3d6d9710d041ce40cd50ddd7e309b18672565aceec57c0fbb1e5ba470c')
ON CONFLICT (dataset) DO UPDATE
SET expected_rows = EXCLUDED.expected_rows,
    expected_bytes = EXCLUDED.expected_bytes,
    expected_sha256 = EXCLUDED.expected_sha256;

DO $$
DECLARE
  dataset text;
BEGIN
  FOREACH dataset IN ARRAY ARRAY[
    'profiles','pedigree_edges','profile_forms','meetings','races','runners',
    'results','archives','race_media','duplicates','orphans','quarantine'
  ]
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS _giq_history_stage.%I (
         source_file text NOT NULL,
         line_number bigint NOT NULL,
         payload jsonb NOT NULL,
         PRIMARY KEY (source_file, line_number)
       )',
      'export_' || dataset
    );
  END LOOP;
END
$$;

UPDATE _giq_history_merge.run
SET export_load_started_at = COALESCE(export_load_started_at, clock_timestamp())
WHERE id = 1;

REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_stage FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_merge FROM PUBLIC;

COMMIT;

SELECT jsonb_build_object(
  'event', 'EXPORT_STAGE_READY',
  'database', current_database(),
  'phase', phase,
  'manifestSha256', normalized_manifest_sha256
)
FROM _giq_history_merge.run WHERE id = 1;
