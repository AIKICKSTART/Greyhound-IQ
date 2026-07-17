\set ON_ERROR_STOP on

BEGIN;

DROP SCHEMA IF EXISTS giq_portable CASCADE;
CREATE SCHEMA giq_portable;
REVOKE ALL ON SCHEMA giq_portable FROM PUBLIC;

CREATE TABLE giq_portable."Track" AS TABLE public."Track" WITH NO DATA;
CREATE TABLE giq_portable."Trainer" AS TABLE public."Trainer" WITH NO DATA;
CREATE TABLE giq_portable."TrainerIdentityCrosswalk" (
  "candidateTrainerId" text NOT NULL,
  "identityKind" text NOT NULL CHECK ("identityKind" IN ('r2-source-trainer-id', 'thedogs-provider-id')),
  "identityValue" text NOT NULL,
  PRIMARY KEY ("identityKind", "identityValue")
);
CREATE INDEX "TrainerIdentityCrosswalk_candidate_idx"
  ON giq_portable."TrainerIdentityCrosswalk" ("candidateTrainerId");
CREATE TABLE giq_portable."Dog" AS TABLE public."Dog" WITH NO DATA;
CREATE TABLE giq_portable."Meeting" AS TABLE public."Meeting" WITH NO DATA;
CREATE TABLE giq_portable."Race" AS TABLE public."Race" WITH NO DATA;
CREATE TABLE giq_portable."RaceVideo" AS TABLE public."RaceVideo" WITH NO DATA;
CREATE TABLE giq_portable."Runner" AS TABLE public."Runner" WITH NO DATA;
CREATE TABLE giq_portable."Result" AS TABLE public."Result" WITH NO DATA;
CREATE TABLE giq_portable."FormEntry" AS TABLE public."FormEntry" WITH NO DATA;
CREATE TABLE giq_portable."DogProfileForm" AS TABLE public."DogProfileForm" WITH NO DATA;
CREATE TABLE giq_portable."DogProfileArchive" AS TABLE public."DogProfileArchive" WITH NO DATA;
CREATE TABLE giq_portable."RaceDayArchive" AS TABLE public."RaceDayArchive" WITH NO DATA;
CREATE TABLE giq_portable."PedigreeImportRun" AS TABLE public."PedigreeImportRun" WITH NO DATA;
CREATE TABLE giq_portable."DogSourceIdentity" AS TABLE public."DogSourceIdentity" WITH NO DATA;
CREATE TABLE giq_portable."PedigreeAssertion" AS TABLE public."PedigreeAssertion" WITH NO DATA;
CREATE TABLE giq_portable."PedigreeMergeLedger" AS TABLE public."PedigreeMergeLedger" WITH NO DATA;

COMMIT;
