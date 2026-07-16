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
  ('profiles', 170780, 501047625, 'be033d2fea61eaed8e7d272f52c114567ac1dc38a5135471b4910a91a41a1c4e'),
  ('pedigree_edges', 328069, 112484102, '9425a3434c98d4e6fb02b18a0ce6813ad25c03be6c339fd584d5a1c0b6ae5926'),
  ('profile_forms', 6218839, 6054583900, '76cbb21aa1c1b57e71df212e4e9a5388b81b075a93864166e7987df99d9b000a'),
  ('meetings', 76620, 34341380, 'eab1c54db2a9e09c1d1c54d9c9ac1db1975770e7fdea304e91441651134887d4'),
  ('races', 838526, 608103659, '0ac28a9cd75bea90f51788c5cd9f364a7fa24f2f54455a0b31e829626767803b'),
  ('runners', 6434145, 4481555075, '6eff1714d34208a363110c0c4dc902ee5d7fb1a308aee2bc4ffe774a3c273b2a'),
  ('results', 5660837, 3162128000, 'b8fa047aee0b7f815c61900e2df898037b316d78edf5b423678985f2211b67d6'),
  ('archives', 178055, 109514191, 'd8dcb4ce5a670acc0f7debf61269e144b10d8657c21724259a466128ac54dfb7'),
  ('race_media', 538849, 323029819, '89b90198d3197238a2476381c0917108f21d2e209c02ca066e8ec90c1e8385b1'),
  ('duplicates', 1940, 502193, '5a9fae9f90ce4c28b8f1567cfd894f066e963405140237d215ceab3e5c556327'),
  ('orphans', 1188280, 293531133, '38fcc6eaf92ab971383882c3b062cadd93b67b9878c3b9d36fd4dfdc1132b436'),
  ('quarantine', 82, 15472, '6cfabdde825d5a49cdfad0f264d3a7e1fc5519c3af00e4b6eb76b605802e261e')
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
