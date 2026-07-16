\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE giq_portable_json_line (value text NOT NULL) ON COMMIT DROP;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Track.copy.gz'
INSERT INTO giq_portable."Track" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Track", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Trainer.copy.gz'
INSERT INTO giq_portable."Trainer" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Trainer", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/TrainerIdentityCrosswalk.copy.gz'
INSERT INTO giq_portable."TrainerIdentityCrosswalk" ("candidateTrainerId", "identityKind", "identityValue")
SELECT
  line.value::jsonb->>'candidateTrainerId',
  line.value::jsonb->>'identityKind',
  line.value::jsonb->>'identityValue'
FROM giq_portable_json_line line;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Dog.copy.gz'
INSERT INTO giq_portable."Dog" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Dog", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Meeting.copy.gz'
INSERT INTO giq_portable."Meeting" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Meeting", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Race.copy.gz'
INSERT INTO giq_portable."Race" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Race", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/RaceVideo.copy.gz'
INSERT INTO giq_portable."RaceVideo" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."RaceVideo", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Runner.copy.gz'
INSERT INTO giq_portable."Runner" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Runner", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/Result.copy.gz'
INSERT INTO giq_portable."Result" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."Result", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/FormEntry.copy.gz'
INSERT INTO giq_portable."FormEntry" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."FormEntry", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/DogProfileForm.copy.gz'
INSERT INTO giq_portable."DogProfileForm" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."DogProfileForm", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/DogProfileArchive.copy.gz'
INSERT INTO giq_portable."DogProfileArchive" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."DogProfileArchive", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/RaceDayArchive.copy.gz'
INSERT INTO giq_portable."RaceDayArchive" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."RaceDayArchive", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/PedigreeImportRun.copy.gz'
INSERT INTO giq_portable."PedigreeImportRun" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."PedigreeImportRun", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/DogSourceIdentity.copy.gz'
INSERT INTO giq_portable."DogSourceIdentity" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."DogSourceIdentity", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/PedigreeAssertion.copy.gz'
INSERT INTO giq_portable."PedigreeAssertion" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."PedigreeAssertion", line.value::jsonb) populated;
TRUNCATE giq_portable_json_line;

\copy giq_portable_json_line(value) FROM PROGRAM 'gzip -dc /tmp/giq-normalized-local-copy/restore/data/PedigreeMergeLedger.copy.gz'
INSERT INTO giq_portable."PedigreeMergeLedger" SELECT populated.* FROM giq_portable_json_line line CROSS JOIN LATERAL jsonb_populate_record(NULL::giq_portable."PedigreeMergeLedger", line.value::jsonb) populated;

COMMIT;
