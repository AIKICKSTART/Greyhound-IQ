-- Stable provider identities, private trainer claims, resumable linkage backfill,
-- and aggregated live-feed quarantine evidence. Forward-only and additive.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE "DogProviderIdentity" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "profileUrl" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'observed',
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DogProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DogProviderIdentity_sourceProvider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "DogProviderIdentity_sourceId_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "DogProviderIdentity_profileUrl_check"
    CHECK ("profileUrl" IS NULL OR char_length("profileUrl") BETWEEN 1 AND 2048),
  CONSTRAINT "DogProviderIdentity_verificationStatus_check"
    CHECK ("verificationStatus" IN ('observed', 'verified', 'conflict', 'rejected')),
  CONSTRAINT "DogProviderIdentity_evidenceSha256_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "DogProviderIdentity_sourceProvider_sourceId_key"
  ON "DogProviderIdentity"("sourceProvider", "sourceId");
CREATE INDEX "DogProviderIdentity_dogId_sourceProvider_idx"
  ON "DogProviderIdentity"("dogId", "sourceProvider");
CREATE INDEX "DogProviderIdentity_verificationStatus_lastSeenAt_idx"
  ON "DogProviderIdentity"("verificationStatus", "lastSeenAt");
CREATE INDEX "DogProviderIdentity_evidenceSha256_idx"
  ON "DogProviderIdentity"("evidenceSha256");

ALTER TABLE "DogProviderIdentity"
  ADD CONSTRAINT "DogProviderIdentity_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "TrainerProviderIdentity" (
  "id" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "profileUrl" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'observed',
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainerProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainerProviderIdentity_sourceProvider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "TrainerProviderIdentity_sourceId_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "TrainerProviderIdentity_profileUrl_check"
    CHECK ("profileUrl" IS NULL OR char_length("profileUrl") BETWEEN 1 AND 2048),
  CONSTRAINT "TrainerProviderIdentity_verificationStatus_check"
    CHECK ("verificationStatus" IN ('observed', 'verified', 'conflict', 'rejected')),
  CONSTRAINT "TrainerProviderIdentity_evidenceSha256_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "TrainerProviderIdentity_sourceProvider_sourceId_key"
  ON "TrainerProviderIdentity"("sourceProvider", "sourceId");
CREATE INDEX "TrainerProviderIdentity_trainerId_sourceProvider_idx"
  ON "TrainerProviderIdentity"("trainerId", "sourceProvider");
CREATE INDEX "TrainerProviderIdentity_verificationStatus_lastSeenAt_idx"
  ON "TrainerProviderIdentity"("verificationStatus", "lastSeenAt");
CREATE INDEX "TrainerProviderIdentity_evidenceSha256_idx"
  ON "TrainerProviderIdentity"("evidenceSha256");

ALTER TABLE "TrainerProviderIdentity"
  ADD CONSTRAINT "TrainerProviderIdentity_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "TrainerClaim" (
  "id" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "officialProfileUrl" TEXT,
  "evidence" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewedByProfileId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrainerClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainerClaim_sourceProvider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "TrainerClaim_sourceId_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "TrainerClaim_profileUrl_check"
    CHECK ("officialProfileUrl" IS NULL OR char_length("officialProfileUrl") BETWEEN 1 AND 2048),
  CONSTRAINT "TrainerClaim_evidence_check"
    CHECK (char_length(btrim("evidence")) BETWEEN 10 AND 1000),
  CONSTRAINT "TrainerClaim_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "TrainerClaim_review_state_check"
    CHECK (
      ("status" = 'pending' AND "verified" = false AND "reviewedAt" IS NULL)
      OR ("status" = 'approved' AND "verified" = true AND "reviewedAt" IS NOT NULL)
      OR ("status" = 'rejected' AND "verified" = false AND "reviewedAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "TrainerClaim_trainerId_profileId_key"
  ON "TrainerClaim"("trainerId", "profileId");
CREATE INDEX "TrainerClaim_profileId_status_createdAt_idx"
  ON "TrainerClaim"("profileId", "status", "createdAt");
CREATE INDEX "TrainerClaim_reviewedByProfileId_idx"
  ON "TrainerClaim"("reviewedByProfileId");
CREATE INDEX "TrainerClaim_status_createdAt_idx"
  ON "TrainerClaim"("status", "createdAt");
CREATE INDEX "TrainerClaim_sourceProvider_sourceId_idx"
  ON "TrainerClaim"("sourceProvider", "sourceId");

ALTER TABLE "TrainerClaim"
  ADD CONSTRAINT "TrainerClaim_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TrainerClaim"
  ADD CONSTRAINT "TrainerClaim_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TrainerClaim"
  ADD CONSTRAINT "TrainerClaim_reviewedByProfileId_fkey"
  FOREIGN KEY ("reviewedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LiveFeedQuarantineSummary" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "entityKind" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "naturalIdentity" TEXT,
  "reasonCode" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "occurrenceCount" BIGINT NOT NULL DEFAULT 1,
  "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  "resolvedEntityId" TEXT,
  "resolutionReason" TEXT,
  "reviewedByProfileId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LiveFeedQuarantineSummary_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveFeedQuarantineSummary_provider_check"
    CHECK ("provider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "LiveFeedQuarantineSummary_entityKind_check"
    CHECK ("entityKind" ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT "LiveFeedQuarantineSummary_sourceKey_check"
    CHECK (char_length("sourceKey") <= 256),
  CONSTRAINT "LiveFeedQuarantineSummary_reasonCode_check"
    CHECK ("reasonCode" ~ '^[a-z][a-z0-9._-]{0,99}$'),
  CONSTRAINT "LiveFeedQuarantineSummary_classification_check"
    CHECK ("classification" IN ('invalid', 'incomplete', 'conflict')),
  CONSTRAINT "LiveFeedQuarantineSummary_evidenceSha256_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "LiveFeedQuarantineSummary_occurrenceCount_check"
    CHECK ("occurrenceCount" > 0),
  CONSTRAINT "LiveFeedQuarantineSummary_reviewStatus_check"
    CHECK ("reviewStatus" IN ('pending', 'resolved', 'ignored'))
);

CREATE UNIQUE INDEX "LiveFeedQuarantineSummary_identity_key"
  ON "LiveFeedQuarantineSummary"(
    "provider", "entityKind", "sourceKey", "reasonCode", "evidenceSha256"
  );
CREATE INDEX "LiveFeedQuarantineSummary_reviewStatus_classification_lastSeenAt_idx"
  ON "LiveFeedQuarantineSummary"("reviewStatus", "classification", "lastSeenAt");
CREATE INDEX "LiveFeedQuarantineSummary_provider_entityKind_lastSeenAt_idx"
  ON "LiveFeedQuarantineSummary"("provider", "entityKind", "lastSeenAt");
CREATE INDEX "LiveFeedQuarantineSummary_reviewedByProfileId_idx"
  ON "LiveFeedQuarantineSummary"("reviewedByProfileId");

ALTER TABLE "LiveFeedQuarantineSummary"
  ADD CONSTRAINT "LiveFeedQuarantineSummary_reviewedByProfileId_fkey"
  FOREIGN KEY ("reviewedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RacingDataBackfillRun" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "cursor" TEXT,
  "scannedCount" BIGINT NOT NULL DEFAULT 0,
  "linkedDogCount" BIGINT NOT NULL DEFAULT 0,
  "linkedTrainerCount" BIGINT NOT NULL DEFAULT 0,
  "repairedWeightCount" BIGINT NOT NULL DEFAULT 0,
  "unresolvedCount" BIGINT NOT NULL DEFAULT 0,
  "ambiguousCount" BIGINT NOT NULL DEFAULT 0,
  "lackingEvidenceCount" BIGINT NOT NULL DEFAULT 0,
  "lastBatchEvidenceSha256" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RacingDataBackfillRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RacingDataBackfillRun_jobKey_check"
    CHECK (char_length(btrim("jobKey")) BETWEEN 1 AND 100),
  CONSTRAINT "RacingDataBackfillRun_status_check"
    CHECK ("status" IN ('pending', 'running', 'completed', 'failed')),
  CONSTRAINT "RacingDataBackfillRun_counts_check"
    CHECK (
      "scannedCount" >= 0 AND "linkedDogCount" >= 0
      AND "linkedTrainerCount" >= 0 AND "repairedWeightCount" >= 0
      AND "unresolvedCount" >= 0 AND "ambiguousCount" >= 0
      AND "lackingEvidenceCount" >= 0
    ),
  CONSTRAINT "RacingDataBackfillRun_evidence_check"
    CHECK (
      "lastBatchEvidenceSha256" IS NULL
      OR "lastBatchEvidenceSha256" ~ '^[0-9a-f]{64}$'
    )
);

CREATE UNIQUE INDEX "RacingDataBackfillRun_jobKey_key"
  ON "RacingDataBackfillRun"("jobKey");
CREATE INDEX "RacingDataBackfillRun_status_updatedAt_idx"
  ON "RacingDataBackfillRun"("status", "updatedAt");

ALTER TABLE "DogProviderIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogProviderIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TrainerProviderIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainerProviderIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TrainerClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainerClaim" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LiveFeedQuarantineSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveFeedQuarantineSummary" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RacingDataBackfillRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RacingDataBackfillRun" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_dog_provider_identity_read
  ON "DogProviderIdentity" FOR SELECT
  USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_dog_provider_identity_insert
  ON "DogProviderIdentity" FOR INSERT
  WITH CHECK (public.giq_is_system());
CREATE POLICY giq_dog_provider_identity_update
  ON "DogProviderIdentity" FOR UPDATE
  USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());

CREATE POLICY giq_trainer_provider_identity_read
  ON "TrainerProviderIdentity" FOR SELECT
  USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_trainer_provider_identity_insert
  ON "TrainerProviderIdentity" FOR INSERT
  WITH CHECK (public.giq_is_system());
CREATE POLICY giq_trainer_provider_identity_update
  ON "TrainerProviderIdentity" FOR UPDATE
  USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());

CREATE POLICY giq_trainer_claim_read
  ON "TrainerClaim" FOR SELECT
  USING (
    public.giq_is_system()
    OR public.giq_is_moderator()
    OR "profileId" = public.giq_current_profile_id()
  );
CREATE POLICY giq_trainer_claim_insert
  ON "TrainerClaim" FOR INSERT
  WITH CHECK (
    public.giq_is_system()
    OR public.giq_is_moderator()
    OR (
      "profileId" = public.giq_current_profile_id()
      AND "status" = 'pending'
      AND "verified" = false
      AND "reviewedAt" IS NULL
    )
  );
CREATE POLICY giq_trainer_claim_update
  ON "TrainerClaim" FOR UPDATE
  USING (public.giq_is_system() OR public.giq_is_moderator())
  WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_trainer_claim_delete
  ON "TrainerClaim" FOR DELETE
  USING (public.giq_is_system() OR public.giq_is_moderator());

CREATE POLICY giq_live_feed_quarantine_summary_read
  ON "LiveFeedQuarantineSummary" FOR SELECT
  USING (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_live_feed_quarantine_summary_insert
  ON "LiveFeedQuarantineSummary" FOR INSERT
  WITH CHECK (public.giq_is_system());
CREATE POLICY giq_live_feed_quarantine_summary_update
  ON "LiveFeedQuarantineSummary" FOR UPDATE
  USING (public.giq_is_system() OR public.giq_is_moderator())
  WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());

CREATE POLICY giq_racing_data_backfill_run_read
  ON "RacingDataBackfillRun" FOR SELECT
  USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_racing_data_backfill_run_insert
  ON "RacingDataBackfillRun" FOR INSERT
  WITH CHECK (public.giq_is_system());
CREATE POLICY giq_racing_data_backfill_run_update
  ON "RacingDataBackfillRun" FOR UPDATE
  USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());

REVOKE ALL ON TABLE
  "DogProviderIdentity",
  "TrainerProviderIdentity",
  "TrainerClaim",
  "LiveFeedQuarantineSummary",
  "RacingDataBackfillRun"
FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON
      "DogProviderIdentity",
      "TrainerProviderIdentity",
      "LiveFeedQuarantineSummary",
      "RacingDataBackfillRun"
    TO greyhoundiq_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "TrainerClaim"
      TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT, UPDATE ON
      "DogProviderIdentity",
      "TrainerProviderIdentity",
      "LiveFeedQuarantineSummary",
      "RacingDataBackfillRun"
    TO greyhoundiq_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "TrainerClaim"
      TO greyhoundiq_app;
  END IF;
END
$$;

COMMIT;
