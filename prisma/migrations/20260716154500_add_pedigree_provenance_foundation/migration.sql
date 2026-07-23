-- Append-only pedigree evidence foundation. This migration creates no source
-- records and does not alter the existing Dog pedigree graph.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "PedigreeImportRun" (
  "id" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceAuthority" INTEGER NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'parsed',
  "status" TEXT NOT NULL DEFAULT 'parsing',
  "artifactUri" TEXT NOT NULL,
  "artifactSha256" TEXT NOT NULL,
  "artifactBytes" BIGINT NOT NULL,
  "sourceVolume" TEXT,
  "parserVersion" TEXT NOT NULL,
  "recordsObserved" INTEGER NOT NULL DEFAULT 0,
  "assertionsObserved" INTEGER NOT NULL DEFAULT 0,
  "issuesObserved" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PedigreeImportRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PedigreeImportRun_sourceProvider_check" CHECK (
    char_length(btrim("sourceProvider")) BETWEEN 1 AND 64
  ),
  CONSTRAINT "PedigreeImportRun_sourceAuthority_check" CHECK (
    "sourceAuthority" BETWEEN 1 AND 1000
  ),
  CONSTRAINT "PedigreeImportRun_verificationStatus_check" CHECK (
    "verificationStatus" IN ('parsed', 'verified', 'conflict', 'rejected')
  ),
  CONSTRAINT "PedigreeImportRun_status_check" CHECK (
    "status" IN ('parsing', 'parsed', 'merged', 'failed', 'rejected')
  ),
  CONSTRAINT "PedigreeImportRun_artifactUri_check" CHECK (
    char_length("artifactUri") BETWEEN 1 AND 2048
  ),
  CONSTRAINT "PedigreeImportRun_artifactSha256_check" CHECK (
    "artifactSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "PedigreeImportRun_artifactBytes_check" CHECK (
    "artifactBytes" >= 0
  ),
  CONSTRAINT "PedigreeImportRun_sourceVolume_check" CHECK (
    "sourceVolume" IS NULL OR char_length(btrim("sourceVolume")) BETWEEN 1 AND 64
  ),
  CONSTRAINT "PedigreeImportRun_parserVersion_check" CHECK (
    char_length(btrim("parserVersion")) BETWEEN 1 AND 64
  ),
  CONSTRAINT "PedigreeImportRun_counts_check" CHECK (
    "recordsObserved" >= 0 AND "assertionsObserved" >= 0 AND "issuesObserved" >= 0
  ),
  CONSTRAINT "PedigreeImportRun_completedAt_check" CHECK (
    "completedAt" IS NULL OR "completedAt" >= "startedAt"
  )
);

CREATE TABLE "DogSourceIdentity" (
  "id" TEXT NOT NULL,
  "dogId" TEXT,
  "importRunId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "artifactSha256" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "registryToken" TEXT,
  "imported" BOOLEAN NOT NULL DEFAULT false,
  "observedSex" TEXT,
  "observedColour" TEXT,
  "observedWhelpDate" TIMESTAMP(3),
  "sourceAuthority" INTEGER NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'parsed',
  "sourcePage" INTEGER,
  "sourceLine" INTEGER,
  "artifactOffsetLine" INTEGER NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DogSourceIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DogSourceIdentity_sourceProvider_check" CHECK (
    char_length(btrim("sourceProvider")) BETWEEN 1 AND 64
  ),
  CONSTRAINT "DogSourceIdentity_sourceId_check" CHECK (
    char_length(btrim("sourceId")) BETWEEN 1 AND 256
  ),
  CONSTRAINT "DogSourceIdentity_sourceName_check" CHECK (
    char_length(btrim("sourceName")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "DogSourceIdentity_normalizedName_check" CHECK (
    char_length(btrim("normalizedName")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "DogSourceIdentity_registryToken_check" CHECK (
    "registryToken" IS NULL OR char_length(btrim("registryToken")) BETWEEN 1 AND 100
  ),
  CONSTRAINT "DogSourceIdentity_observedSex_check" CHECK (
    "observedSex" IS NULL OR "observedSex" IN ('M', 'F')
  ),
  CONSTRAINT "DogSourceIdentity_observedColour_check" CHECK (
    "observedColour" IS NULL OR char_length(btrim("observedColour")) BETWEEN 1 AND 100
  ),
  CONSTRAINT "DogSourceIdentity_sourceAuthority_check" CHECK (
    "sourceAuthority" BETWEEN 1 AND 1000
  ),
  CONSTRAINT "DogSourceIdentity_verificationStatus_check" CHECK (
    "verificationStatus" IN ('parsed', 'verified', 'conflict', 'rejected')
  ),
  CONSTRAINT "DogSourceIdentity_sourcePage_check" CHECK (
    "sourcePage" IS NULL OR "sourcePage" > 0
  ),
  CONSTRAINT "DogSourceIdentity_sourceLine_check" CHECK (
    "sourceLine" IS NULL OR "sourceLine" > 0
  ),
  CONSTRAINT "DogSourceIdentity_artifactOffsetLine_check" CHECK (
    "artifactOffsetLine" > 0
  ),
  CONSTRAINT "DogSourceIdentity_artifactSha256_check" CHECK (
    "artifactSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "DogSourceIdentity_evidenceSha256_check" CHECK (
    "evidenceSha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "PedigreeAssertion" (
  "id" TEXT NOT NULL,
  "importRunId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "artifactSha256" TEXT NOT NULL,
  "subjectIdentityId" TEXT NOT NULL,
  "parentIdentityId" TEXT,
  "relationship" TEXT NOT NULL,
  "assertedParentName" TEXT NOT NULL,
  "assertedParentNormalizedName" TEXT NOT NULL,
  "assertedParentRegistryToken" TEXT,
  "sourceAuthority" INTEGER NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'parsed',
  "sourcePage" INTEGER,
  "sourceLine" INTEGER,
  "artifactOffsetLine" INTEGER NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PedigreeAssertion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PedigreeAssertion_parent_not_subject_check" CHECK (
    "parentIdentityId" IS NULL OR "parentIdentityId" <> "subjectIdentityId"
  ),
  CONSTRAINT "PedigreeAssertion_relationship_check" CHECK (
    "relationship" IN ('sire', 'dam')
  ),
  CONSTRAINT "PedigreeAssertion_parentName_check" CHECK (
    char_length(btrim("assertedParentName")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "PedigreeAssertion_parentNormalizedName_check" CHECK (
    char_length(btrim("assertedParentNormalizedName")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "PedigreeAssertion_parentRegistryToken_check" CHECK (
    "assertedParentRegistryToken" IS NULL
    OR char_length(btrim("assertedParentRegistryToken")) BETWEEN 1 AND 100
  ),
  CONSTRAINT "PedigreeAssertion_sourceAuthority_check" CHECK (
    "sourceAuthority" BETWEEN 1 AND 1000
  ),
  CONSTRAINT "PedigreeAssertion_verificationStatus_check" CHECK (
    "verificationStatus" IN ('parsed', 'verified', 'conflict', 'rejected')
  ),
  CONSTRAINT "PedigreeAssertion_sourcePage_check" CHECK (
    "sourcePage" IS NULL OR "sourcePage" > 0
  ),
  CONSTRAINT "PedigreeAssertion_sourceLine_check" CHECK (
    "sourceLine" IS NULL OR "sourceLine" > 0
  ),
  CONSTRAINT "PedigreeAssertion_artifactOffsetLine_check" CHECK (
    "artifactOffsetLine" > 0
  ),
  CONSTRAINT "PedigreeAssertion_artifactSha256_check" CHECK (
    "artifactSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "PedigreeAssertion_evidenceSha256_check" CHECK (
    "evidenceSha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "PedigreeMergeLedger" (
  "id" TEXT NOT NULL,
  "importRunId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "artifactSha256" TEXT NOT NULL,
  "assertionId" TEXT NOT NULL,
  "winningAssertionId" TEXT,
  "dogId" TEXT NOT NULL,
  "existingParentDogId" TEXT,
  "proposedParentDogId" TEXT,
  "relationship" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "sourceAuthority" INTEGER NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PedigreeMergeLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PedigreeMergeLedger_relationship_check" CHECK (
    "relationship" IN ('sire', 'dam')
  ),
  CONSTRAINT "PedigreeMergeLedger_decision_check" CHECK (
    "decision" IN (
      'accepted',
      'no_change',
      'preserved_higher_authority',
      'quarantined_conflict',
      'rejected_ambiguous'
    )
  ),
  CONSTRAINT "PedigreeMergeLedger_reasonCode_check" CHECK (
    char_length(btrim("reasonCode")) BETWEEN 1 AND 100
  ),
  CONSTRAINT "PedigreeMergeLedger_sourceAuthority_check" CHECK (
    "sourceAuthority" BETWEEN 1 AND 1000
  ),
  CONSTRAINT "PedigreeMergeLedger_verificationStatus_check" CHECK (
    "verificationStatus" IN ('parsed', 'verified', 'conflict', 'rejected')
  ),
  CONSTRAINT "PedigreeMergeLedger_existingParent_check" CHECK (
    "existingParentDogId" IS NULL OR "existingParentDogId" <> "dogId"
  ),
  CONSTRAINT "PedigreeMergeLedger_proposedParent_check" CHECK (
    "proposedParentDogId" IS NULL OR "proposedParentDogId" <> "dogId"
  ),
  CONSTRAINT "PedigreeMergeLedger_artifactSha256_check" CHECK (
    "artifactSha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX "PedigreeImportRun_sourceProvider_artifactSha256_idx"
  ON "PedigreeImportRun"("sourceProvider", "artifactSha256");
CREATE UNIQUE INDEX "PedigreeImportRun_id_sourceProvider_artifactSha256_key"
  ON "PedigreeImportRun"("id", "sourceProvider", "artifactSha256");
CREATE INDEX "PedigreeImportRun_sourceProvider_sourceAuthority_idx"
  ON "PedigreeImportRun"("sourceProvider", "sourceAuthority");
CREATE INDEX "PedigreeImportRun_status_createdAt_idx"
  ON "PedigreeImportRun"("status", "createdAt");
CREATE INDEX "PedigreeImportRun_verificationStatus_completedAt_idx"
  ON "PedigreeImportRun"("verificationStatus", "completedAt");

CREATE INDEX "DogSourceIdentity_sourceProvider_sourceId_artifactSha256_idx"
  ON "DogSourceIdentity"("sourceProvider", "sourceId", "artifactSha256");
CREATE UNIQUE INDEX "DogSourceIdentity_id_importRunId_sourceProvider_artifactSha256_key"
  ON "DogSourceIdentity"("id", "importRunId", "sourceProvider", "artifactSha256");
CREATE INDEX "DogSourceIdentity_importRunId_artifactOffsetLine_idx"
  ON "DogSourceIdentity"("importRunId", "artifactOffsetLine");
CREATE INDEX "DogSourceIdentity_sourceProvider_sourceId_idx"
  ON "DogSourceIdentity"("sourceProvider", "sourceId");
CREATE INDEX "DogSourceIdentity_dogId_verificationStatus_idx"
  ON "DogSourceIdentity"("dogId", "verificationStatus");
CREATE INDEX "DogSourceIdentity_normalizedName_observedWhelpDate_idx"
  ON "DogSourceIdentity"("normalizedName", "observedWhelpDate");
CREATE INDEX "DogSourceIdentity_importRunId_sourcePage_sourceLine_idx"
  ON "DogSourceIdentity"("importRunId", "sourcePage", "sourceLine");

CREATE INDEX "PedigreeAssertion_subjectIdentityId_relationship_idx"
  ON "PedigreeAssertion"("subjectIdentityId", "relationship");
CREATE UNIQUE INDEX "PedigreeAssertion_id_importRunId_sourceProvider_artifactSha256_key"
  ON "PedigreeAssertion"("id", "importRunId", "sourceProvider", "artifactSha256");
CREATE INDEX "PedigreeAssertion_importRunId_artifactOffsetLine_relationship_idx"
  ON "PedigreeAssertion"("importRunId", "artifactOffsetLine", "relationship");
CREATE INDEX "PedigreeAssertion_parentIdentityId_verificationStatus_idx"
  ON "PedigreeAssertion"("parentIdentityId", "verificationStatus");
CREATE INDEX "PedigreeAssertion_assertedParentNormalizedName_idx"
  ON "PedigreeAssertion"("assertedParentNormalizedName");
CREATE INDEX "PedigreeAssertion_importRunId_sourcePage_sourceLine_idx"
  ON "PedigreeAssertion"("importRunId", "sourcePage", "sourceLine");

CREATE INDEX "PedigreeMergeLedger_assertionId_dogId_decision_createdAt_idx"
  ON "PedigreeMergeLedger"("assertionId", "dogId", "decision", "createdAt");
CREATE INDEX "PedigreeMergeLedger_importRunId_createdAt_idx"
  ON "PedigreeMergeLedger"("importRunId", "createdAt");
CREATE INDEX "PedigreeMergeLedger_dogId_relationship_createdAt_idx"
  ON "PedigreeMergeLedger"("dogId", "relationship", "createdAt");
CREATE INDEX "PedigreeMergeLedger_decision_verificationStatus_createdAt_idx"
  ON "PedigreeMergeLedger"("decision", "verificationStatus", "createdAt");
CREATE INDEX "PedigreeMergeLedger_winningAssertionId_idx"
  ON "PedigreeMergeLedger"("winningAssertionId");

ALTER TABLE "DogSourceIdentity"
  ADD CONSTRAINT "DogSourceIdentity_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DogSourceIdentity"
  ADD CONSTRAINT "DogSourceIdentity_importRun_evidence_fkey"
  FOREIGN KEY ("importRunId", "sourceProvider", "artifactSha256")
  REFERENCES "PedigreeImportRun"("id", "sourceProvider", "artifactSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "PedigreeAssertion"
  ADD CONSTRAINT "PedigreeAssertion_importRun_evidence_fkey"
  FOREIGN KEY ("importRunId", "sourceProvider", "artifactSha256")
  REFERENCES "PedigreeImportRun"("id", "sourceProvider", "artifactSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeAssertion"
  ADD CONSTRAINT "PedigreeAssertion_subject_evidence_fkey"
  FOREIGN KEY ("subjectIdentityId", "importRunId", "sourceProvider", "artifactSha256")
  REFERENCES "DogSourceIdentity"("id", "importRunId", "sourceProvider", "artifactSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeAssertion"
  ADD CONSTRAINT "PedigreeAssertion_parentIdentityId_fkey"
  FOREIGN KEY ("parentIdentityId") REFERENCES "DogSourceIdentity"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "PedigreeMergeLedger"
  ADD CONSTRAINT "PedigreeMergeLedger_importRun_evidence_fkey"
  FOREIGN KEY ("importRunId", "sourceProvider", "artifactSha256")
  REFERENCES "PedigreeImportRun"("id", "sourceProvider", "artifactSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeMergeLedger"
  ADD CONSTRAINT "PedigreeMergeLedger_assertion_evidence_fkey"
  FOREIGN KEY ("assertionId", "importRunId", "sourceProvider", "artifactSha256")
  REFERENCES "PedigreeAssertion"("id", "importRunId", "sourceProvider", "artifactSha256")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeMergeLedger"
  ADD CONSTRAINT "PedigreeMergeLedger_winningAssertionId_fkey"
  FOREIGN KEY ("winningAssertionId") REFERENCES "PedigreeAssertion"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeMergeLedger"
  ADD CONSTRAINT "PedigreeMergeLedger_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeMergeLedger"
  ADD CONSTRAINT "PedigreeMergeLedger_existingParentDogId_fkey"
  FOREIGN KEY ("existingParentDogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PedigreeMergeLedger"
  ADD CONSTRAINT "PedigreeMergeLedger_proposedParentDogId_fkey"
  FOREIGN KEY ("proposedParentDogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Import-run counters/status may advance as the run completes. Identity and
-- assertion observations are immutable: status advances are new observations,
-- never in-place rewrites of source evidence.
CREATE OR REPLACE FUNCTION public.giq_guard_pedigree_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pedigree evidence is append-only';
  END IF;

  IF TG_TABLE_NAME = 'PedigreeImportRun' THEN
    IF (to_jsonb(NEW) - ARRAY[
      'status', 'verificationStatus', 'recordsObserved', 'assertionsObserved',
      'issuesObserved', 'completedAt', 'updatedAt'
    ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
      'status', 'verificationStatus', 'recordsObserved', 'assertionsObserved',
      'issuesObserved', 'completedAt', 'updatedAt'
    ]) THEN
      RAISE EXCEPTION 'pedigree import artifact evidence is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'DogSourceIdentity' THEN
    IF NEW."dogId" IS DISTINCT FROM OLD."dogId" THEN
      RAISE EXCEPTION
        'canonical dog binding is immutable; record a new run-specific identity observation';
    END IF;
    RAISE EXCEPTION
      'dog source identity evidence is immutable; record a new run-specific observation';
  ELSIF TG_TABLE_NAME = 'PedigreeAssertion' THEN
    IF NEW."parentIdentityId" IS DISTINCT FROM OLD."parentIdentityId" THEN
      RAISE EXCEPTION
        'parent identity binding is immutable; record a new run-specific assertion observation';
    END IF;
    RAISE EXCEPTION
      'pedigree assertion evidence is immutable; record a new run-specific observation';
  ELSE
    RAISE EXCEPTION 'pedigree merge ledger is append-only';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.giq_guard_pedigree_evidence() FROM PUBLIC;

CREATE TRIGGER giq_pedigree_import_run_evidence_guard
  BEFORE UPDATE OR DELETE ON "PedigreeImportRun"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_pedigree_evidence();
CREATE TRIGGER giq_dog_source_identity_evidence_guard
  BEFORE UPDATE OR DELETE ON "DogSourceIdentity"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_pedigree_evidence();
CREATE TRIGGER giq_pedigree_assertion_evidence_guard
  BEFORE UPDATE OR DELETE ON "PedigreeAssertion"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_pedigree_evidence();
CREATE TRIGGER giq_pedigree_merge_ledger_evidence_guard
  BEFORE UPDATE OR DELETE ON "PedigreeMergeLedger"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_pedigree_evidence();

ALTER TABLE "PedigreeImportRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedigreeImportRun" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DogSourceIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogSourceIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PedigreeAssertion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedigreeAssertion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PedigreeMergeLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedigreeMergeLedger" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_pedigree_import_run_read
  ON "PedigreeImportRun" FOR SELECT
  USING (public.giq_is_admin());
CREATE POLICY giq_pedigree_import_run_system_write
  ON "PedigreeImportRun" FOR ALL
  USING (public.giq_is_system())
  WITH CHECK (public.giq_is_system());

CREATE POLICY giq_dog_source_identity_verified_read
  ON "DogSourceIdentity" FOR SELECT
  USING (
    public.giq_is_admin()
    OR ("verificationStatus" = 'verified' AND "dogId" IS NOT NULL)
  );
CREATE POLICY giq_dog_source_identity_system_insert
  ON "DogSourceIdentity" FOR INSERT
  WITH CHECK (public.giq_is_system());

CREATE POLICY giq_pedigree_assertion_verified_read
  ON "PedigreeAssertion" FOR SELECT
  USING (
    public.giq_is_admin()
    OR (
      "verificationStatus" = 'verified'
      AND "parentIdentityId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "DogSourceIdentity" subject_identity
        WHERE subject_identity."id" = "subjectIdentityId"
          AND subject_identity."verificationStatus" = 'verified'
          AND subject_identity."dogId" IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM "DogSourceIdentity" parent_identity
        WHERE parent_identity."id" = "parentIdentityId"
          AND parent_identity."verificationStatus" = 'verified'
          AND parent_identity."dogId" IS NOT NULL
      )
    )
  );
CREATE POLICY giq_pedigree_assertion_system_insert
  ON "PedigreeAssertion" FOR INSERT
  WITH CHECK (public.giq_is_system());

CREATE POLICY giq_pedigree_merge_ledger_read
  ON "PedigreeMergeLedger" FOR SELECT
  USING (public.giq_is_admin());
CREATE POLICY giq_pedigree_merge_ledger_system_insert
  ON "PedigreeMergeLedger" FOR INSERT
  WITH CHECK (public.giq_is_system());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON "PedigreeImportRun" TO greyhoundiq_runtime;
    GRANT SELECT, INSERT ON "DogSourceIdentity", "PedigreeAssertion"
      TO greyhoundiq_runtime;
    GRANT SELECT, INSERT ON "PedigreeMergeLedger" TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "PedigreeImportRun" TO greyhoundiq_app;
    GRANT SELECT, INSERT ON "DogSourceIdentity", "PedigreeAssertion"
      TO greyhoundiq_app;
    GRANT SELECT, INSERT ON "PedigreeMergeLedger" TO greyhoundiq_app;
  END IF;
END
$$;

COMMIT;
