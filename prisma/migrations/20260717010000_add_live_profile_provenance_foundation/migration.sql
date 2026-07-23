-- Append-only occurrence evidence for live dog-profile enrichment. This
-- migration does not enable the live sync route or mutate canonical records.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "DogProfileObservation" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "requestUrl" TEXT NOT NULL,
  "requestSha256" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "evidenceJson" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DogProfileObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DogProfileObservation_id_check" CHECK (
    "id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT "DogProfileObservation_sourceProvider_check" CHECK (
    char_length(btrim("sourceProvider")) BETWEEN 1 AND 64
  ),
  CONSTRAINT "DogProfileObservation_sourceId_check" CHECK (
    char_length(btrim("sourceId")) BETWEEN 1 AND 256
  ),
  CONSTRAINT "DogProfileObservation_thedogs_sourceId_check" CHECK (
    "sourceProvider" <> 'thedogs' OR "sourceId" ~ '^[0-9]{1,32}$'
  ),
  CONSTRAINT "DogProfileObservation_requestUrl_check" CHECK (
    char_length("requestUrl") BETWEEN 1 AND 2048
  ),
  CONSTRAINT "DogProfileObservation_requestSha256_check" CHECK (
    "requestSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "DogProfileObservation_observedAt_check" CHECK (
    "observedAt" >= TIMESTAMP '2000-01-01 00:00:00'
    AND "observedAt" <= CURRENT_TIMESTAMP + INTERVAL '2 days'
  ),
  CONSTRAINT "DogProfileObservation_evidenceSha256_check" CHECK (
    "evidenceSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "DogProfileObservation_evidenceJson_size_check" CHECK (
    octet_length("evidenceJson") BETWEEN 2 AND 5242880
  ),
  CONSTRAINT "DogProfileObservation_evidenceJson_object_check" CHECK (
    jsonb_typeof("evidenceJson"::jsonb) = 'object'
  ),
  CONSTRAINT "DogProfileObservation_verificationStatus_check" CHECK (
    "verificationStatus" IN ('verified', 'conflict', 'rejected')
  )
);

CREATE UNIQUE INDEX "DogProfileObservation_id_dogId_sourceProvider_sourceId_requestSha256_evidenceSha256_key"
  ON "DogProfileObservation"(
    "id", "dogId", "sourceProvider", "sourceId", "requestSha256", "evidenceSha256"
  );
CREATE INDEX "DogProfileObservation_dogId_observedAt_idx"
  ON "DogProfileObservation"("dogId", "observedAt");
CREATE INDEX "DogProfileObservation_sourceProvider_sourceId_observedAt_idx"
  ON "DogProfileObservation"("sourceProvider", "sourceId", "observedAt");
CREATE INDEX "DogProfileObservation_evidenceSha256_idx"
  ON "DogProfileObservation"("evidenceSha256");

CREATE TABLE "DogProfileMergeLedger" (
  "id" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "requestSha256" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "fieldDecisionsJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DogProfileMergeLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DogProfileMergeLedger_sourceProvider_check" CHECK (
    char_length(btrim("sourceProvider")) BETWEEN 1 AND 64
  ),
  CONSTRAINT "DogProfileMergeLedger_sourceId_check" CHECK (
    char_length(btrim("sourceId")) BETWEEN 1 AND 256
  ),
  CONSTRAINT "DogProfileMergeLedger_requestSha256_check" CHECK (
    "requestSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "DogProfileMergeLedger_evidenceSha256_check" CHECK (
    "evidenceSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "DogProfileMergeLedger_decision_check" CHECK (
    "decision" IN ('accepted', 'no_change', 'preserved')
  ),
  CONSTRAINT "DogProfileMergeLedger_reasonCode_check" CHECK (
    char_length(btrim("reasonCode")) BETWEEN 1 AND 100
  ),
  CONSTRAINT "DogProfileMergeLedger_verificationStatus_check" CHECK (
    "verificationStatus" IN ('verified', 'conflict', 'rejected')
  ),
  CONSTRAINT "DogProfileMergeLedger_fieldDecisionsJson_size_check" CHECK (
    octet_length("fieldDecisionsJson") BETWEEN 2 AND 5242880
  ),
  CONSTRAINT "DogProfileMergeLedger_fieldDecisionsJson_array_check" CHECK (
    jsonb_typeof("fieldDecisionsJson"::jsonb) = 'array'
  )
);

CREATE UNIQUE INDEX "DogProfileMergeLedger_observationId_key"
  ON "DogProfileMergeLedger"("observationId");
CREATE UNIQUE INDEX "DogProfileMergeLedger_observationId_dogId_sourceProvider_sourceId_requestSha256_evidenceSha256_key"
  ON "DogProfileMergeLedger"(
    "observationId", "dogId", "sourceProvider", "sourceId", "requestSha256", "evidenceSha256"
  );
CREATE INDEX "DogProfileMergeLedger_dogId_createdAt_idx"
  ON "DogProfileMergeLedger"("dogId", "createdAt");
CREATE INDEX "DogProfileMergeLedger_sourceProvider_sourceId_createdAt_idx"
  ON "DogProfileMergeLedger"("sourceProvider", "sourceId", "createdAt");
CREATE INDEX "DogProfileMergeLedger_decision_verificationStatus_createdAt_idx"
  ON "DogProfileMergeLedger"("decision", "verificationStatus", "createdAt");
CREATE INDEX "DogProfileMergeLedger_evidenceSha256_idx"
  ON "DogProfileMergeLedger"("evidenceSha256");

ALTER TABLE "DogProfileObservation"
  ADD CONSTRAINT "DogProfileObservation_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "DogProfileMergeLedger"
  ADD CONSTRAINT "DogProfileMergeLedger_observation_evidence_fkey"
  FOREIGN KEY (
    "observationId", "dogId", "sourceProvider", "sourceId", "requestSha256", "evidenceSha256"
  ) REFERENCES "DogProfileObservation"(
    "id", "dogId", "sourceProvider", "sourceId", "requestSha256", "evidenceSha256"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DogProfileMergeLedger"
  ADD CONSTRAINT "DogProfileMergeLedger_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION public.giq_guard_live_profile_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'DogProfileObservation' THEN
    RAISE EXCEPTION 'dog profile observations are append-only';
  END IF;
  RAISE EXCEPTION 'dog profile merge decisions are append-only';
END;
$$;

REVOKE ALL ON FUNCTION public.giq_guard_live_profile_provenance() FROM PUBLIC;

CREATE TRIGGER giq_dog_profile_observation_append_only
  BEFORE UPDATE OR DELETE ON "DogProfileObservation"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_live_profile_provenance();
CREATE TRIGGER giq_dog_profile_merge_ledger_append_only
  BEFORE UPDATE OR DELETE ON "DogProfileMergeLedger"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_live_profile_provenance();

ALTER TABLE "DogProfileObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogProfileObservation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DogProfileMergeLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogProfileMergeLedger" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_dog_profile_observation_admin_read
  ON "DogProfileObservation" FOR SELECT
  USING (public.giq_is_admin());
CREATE POLICY giq_dog_profile_observation_system_insert
  ON "DogProfileObservation" FOR INSERT
  WITH CHECK (public.giq_is_system());
CREATE POLICY giq_dog_profile_merge_ledger_admin_read
  ON "DogProfileMergeLedger" FOR SELECT
  USING (public.giq_is_admin());
CREATE POLICY giq_dog_profile_merge_ledger_system_insert
  ON "DogProfileMergeLedger" FOR INSERT
  WITH CHECK (public.giq_is_system());

REVOKE ALL ON TABLE "DogProfileObservation", "DogProfileMergeLedger" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT ON "DogProfileObservation", "DogProfileMergeLedger"
      TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT ON "DogProfileObservation", "DogProfileMergeLedger"
      TO greyhoundiq_app;
  END IF;
END
$$;

COMMIT;
