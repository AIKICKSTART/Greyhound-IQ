-- Complete exact provider identities, relational race links, replay verification,
-- append-only quarantine resolutions and merge evidence. Forward-only/additive.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30min';

REVOKE EXECUTE ON FUNCTION public.giq_is_admin() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_is_admin() TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_is_admin() TO greyhoundiq_app;
  END IF;
END
$$;

ALTER TABLE "Result"
  ADD CONSTRAINT "Result_raceId_fkey"
  FOREIGN KEY ("raceId") REFERENCES "Race"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "FormEntry"
  ADD CONSTRAINT "FormEntry_raceId_fkey"
  FOREIGN KEY ("raceId") REFERENCES "Race"("id")
  ON DELETE SET NULL ON UPDATE RESTRICT NOT VALID;

ALTER TABLE "Result" VALIDATE CONSTRAINT "Result_raceId_fkey";
ALTER TABLE "FormEntry" VALIDATE CONSTRAINT "FormEntry_raceId_fkey";

CREATE TABLE "TrackProviderIdentity" (
  "id" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'observed',
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrackProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrackProviderIdentity_status_check"
    CHECK ("verificationStatus" IN ('observed', 'verified', 'conflict', 'rejected')),
  CONSTRAINT "TrackProviderIdentity_provider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "TrackProviderIdentity_source_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "TrackProviderIdentity_evidence_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "MeetingProviderIdentity" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'observed',
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeetingProviderIdentity_status_check"
    CHECK ("verificationStatus" IN ('observed', 'verified', 'conflict', 'rejected')),
  CONSTRAINT "MeetingProviderIdentity_provider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "MeetingProviderIdentity_source_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "MeetingProviderIdentity_evidence_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "RaceProviderIdentity" (
  "id" TEXT NOT NULL,
  "raceId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'observed',
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaceProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaceProviderIdentity_status_check"
    CHECK ("verificationStatus" IN ('observed', 'verified', 'conflict', 'rejected')),
  CONSTRAINT "RaceProviderIdentity_provider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "RaceProviderIdentity_source_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "RaceProviderIdentity_evidence_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "Owner" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Owner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Owner_displayName_check"
    CHECK (char_length(btrim("displayName")) BETWEEN 1 AND 200)
);

CREATE TABLE "OwnerProviderIdentity" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "profileUrl" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'observed',
  "evidenceSha256" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerProviderIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OwnerProviderIdentity_status_check"
    CHECK ("verificationStatus" IN ('observed', 'verified', 'conflict', 'rejected')),
  CONSTRAINT "OwnerProviderIdentity_provider_check"
    CHECK ("sourceProvider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT "OwnerProviderIdentity_source_check"
    CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 256),
  CONSTRAINT "OwnerProviderIdentity_profile_check"
    CHECK ("profileUrl" IS NULL OR char_length("profileUrl") BETWEEN 1 AND 2048),
  CONSTRAINT "OwnerProviderIdentity_evidence_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "DogOwnerRelationship" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogOwnerRelationship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DogOwnerRelationship_dates_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "DogOwnerRelationship_evidence_check"
    CHECK ("evidenceSha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "LiveFeedQuarantineResolution" (
  "id" TEXT NOT NULL,
  "summaryId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "resolutionReason" TEXT NOT NULL,
  "resolvedEntityKind" TEXT,
  "resolvedEntityId" TEXT,
  "beforeSha256" TEXT NOT NULL,
  "afterSha256" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "actorOrJob" TEXT NOT NULL,
  "affectedIdsJson" TEXT NOT NULL,
  "reviewedByProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveFeedQuarantineResolution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveFeedQuarantineResolution_outcome_check"
    CHECK ("outcome" IN ('linked', 'merged', 'superseded', 'invalid', 'duplicate', 'not_linkable')),
  CONSTRAINT "LiveFeedQuarantineResolution_reason_check"
    CHECK (char_length(btrim("resolutionReason")) BETWEEN 3 AND 500),
  CONSTRAINT "LiveFeedQuarantineResolution_actor_check"
    CHECK (char_length(btrim("actorOrJob")) BETWEEN 3 AND 200),
  CONSTRAINT "LiveFeedQuarantineResolution_affected_ids_check"
    CHECK (jsonb_typeof("affectedIdsJson"::jsonb) = 'array'),
  CONSTRAINT "LiveFeedQuarantineResolution_hashes_check"
    CHECK (
      "beforeSha256" ~ '^[0-9a-f]{64}$'
      AND "afterSha256" ~ '^[0-9a-f]{64}$'
      AND "evidenceSha256" ~ '^[0-9a-f]{64}$'
    )
);

CREATE TABLE "CanonicalEntityMerge" (
  "id" TEXT NOT NULL,
  "entityKind" TEXT NOT NULL,
  "survivingEntityId" TEXT NOT NULL,
  "retiredEntityId" TEXT NOT NULL,
  "sourceProvider" TEXT,
  "sourceId" TEXT,
  "reasonCode" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "beforeSha256" TEXT NOT NULL,
  "afterSha256" TEXT NOT NULL,
  "approvedByProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanonicalEntityMerge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CanonicalEntityMerge_ids_check"
    CHECK ("survivingEntityId" <> "retiredEntityId"),
  CONSTRAINT "CanonicalEntityMerge_hashes_check"
    CHECK (
      "beforeSha256" ~ '^[0-9a-f]{64}$'
      AND "afterSha256" ~ '^[0-9a-f]{64}$'
      AND "evidenceSha256" ~ '^[0-9a-f]{64}$'
    )
);

ALTER TABLE "RaceVideo"
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationEvidenceSha256" TEXT,
  ADD COLUMN "verificationScreenshotRef" TEXT,
  ADD CONSTRAINT "RaceVideo_verificationStatus_check"
    CHECK ("verificationStatus" IN ('pending', 'verified', 'external', 'failed')) NOT VALID,
  ADD CONSTRAINT "RaceVideo_verificationEvidence_check"
    CHECK (
      "verificationEvidenceSha256" IS NULL
      OR "verificationEvidenceSha256" ~ '^[0-9a-f]{64}$'
    ) NOT VALID;

ALTER TABLE "RaceVideo"
  VALIDATE CONSTRAINT "RaceVideo_verificationStatus_check";
ALTER TABLE "RaceVideo"
  VALIDATE CONSTRAINT "RaceVideo_verificationEvidence_check";

CREATE TABLE "RaceVideoVerification" (
  "id" TEXT NOT NULL,
  "raceVideoId" TEXT NOT NULL,
  "playbackState" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "mediaContentType" TEXT,
  "firstFrameSha256" TEXT,
  "evidenceSha256" TEXT NOT NULL,
  "screenshotRef" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaceVideoVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaceVideoVerification_playback_check"
    CHECK ("playbackState" IN ('embedded', 'external', 'pending', 'failed')),
  CONSTRAINT "RaceVideoVerification_outcome_check"
    CHECK ("outcome" IN ('verified', 'external', 'pending', 'failed', 'mismatch')),
  CONSTRAINT "RaceVideoVerification_status_check"
    CHECK ("httpStatus" IS NULL OR "httpStatus" BETWEEN 100 AND 599),
  CONSTRAINT "RaceVideoVerification_hashes_check"
    CHECK (
      "evidenceSha256" ~ '^[0-9a-f]{64}$'
      AND ("firstFrameSha256" IS NULL OR "firstFrameSha256" ~ '^[0-9a-f]{64}$')
    )
);

CREATE UNIQUE INDEX "TrackProviderIdentity_sourceProvider_sourceId_key"
  ON "TrackProviderIdentity"("sourceProvider", "sourceId");
CREATE INDEX "TrackProviderIdentity_trackId_sourceProvider_idx"
  ON "TrackProviderIdentity"("trackId", "sourceProvider");
CREATE INDEX "TrackProviderIdentity_verificationStatus_lastSeenAt_idx"
  ON "TrackProviderIdentity"("verificationStatus", "lastSeenAt");
CREATE INDEX "TrackProviderIdentity_evidenceSha256_idx"
  ON "TrackProviderIdentity"("evidenceSha256");

CREATE UNIQUE INDEX "MeetingProviderIdentity_sourceProvider_sourceId_key"
  ON "MeetingProviderIdentity"("sourceProvider", "sourceId");
CREATE INDEX "MeetingProviderIdentity_meetingId_sourceProvider_idx"
  ON "MeetingProviderIdentity"("meetingId", "sourceProvider");
CREATE INDEX "MeetingProviderIdentity_verificationStatus_lastSeenAt_idx"
  ON "MeetingProviderIdentity"("verificationStatus", "lastSeenAt");
CREATE INDEX "MeetingProviderIdentity_evidenceSha256_idx"
  ON "MeetingProviderIdentity"("evidenceSha256");

CREATE UNIQUE INDEX "RaceProviderIdentity_sourceProvider_sourceId_key"
  ON "RaceProviderIdentity"("sourceProvider", "sourceId");
CREATE INDEX "RaceProviderIdentity_raceId_sourceProvider_idx"
  ON "RaceProviderIdentity"("raceId", "sourceProvider");
CREATE INDEX "RaceProviderIdentity_verificationStatus_lastSeenAt_idx"
  ON "RaceProviderIdentity"("verificationStatus", "lastSeenAt");
CREATE INDEX "RaceProviderIdentity_evidenceSha256_idx"
  ON "RaceProviderIdentity"("evidenceSha256");

CREATE INDEX "Owner_displayName_idx" ON "Owner"("displayName");
CREATE UNIQUE INDEX "OwnerProviderIdentity_sourceProvider_sourceId_key"
  ON "OwnerProviderIdentity"("sourceProvider", "sourceId");
CREATE INDEX "OwnerProviderIdentity_ownerId_sourceProvider_idx"
  ON "OwnerProviderIdentity"("ownerId", "sourceProvider");
CREATE INDEX "OwnerProviderIdentity_verificationStatus_lastSeenAt_idx"
  ON "OwnerProviderIdentity"("verificationStatus", "lastSeenAt");
CREATE INDEX "OwnerProviderIdentity_evidenceSha256_idx"
  ON "OwnerProviderIdentity"("evidenceSha256");
CREATE UNIQUE INDEX "DogOwnerRelationship_identity_key"
  ON "DogOwnerRelationship"("dogId", "ownerId", "sourceProvider", "sourceId");
CREATE INDEX "DogOwnerRelationship_dogId_effectiveTo_idx"
  ON "DogOwnerRelationship"("dogId", "effectiveTo");
CREATE INDEX "DogOwnerRelationship_ownerId_effectiveTo_idx"
  ON "DogOwnerRelationship"("ownerId", "effectiveTo");
CREATE INDEX "DogOwnerRelationship_evidenceSha256_idx"
  ON "DogOwnerRelationship"("evidenceSha256");

CREATE INDEX "LiveFeedQuarantineResolution_summaryId_createdAt_idx"
  ON "LiveFeedQuarantineResolution"("summaryId", "createdAt");
CREATE INDEX "LiveFeedQuarantineResolution_outcome_createdAt_idx"
  ON "LiveFeedQuarantineResolution"("outcome", "createdAt");
CREATE INDEX "LiveFeedQuarantineResolution_resolvedEntityKind_resolvedEntityId_idx"
  ON "LiveFeedQuarantineResolution"("resolvedEntityKind", "resolvedEntityId");
CREATE INDEX "LiveFeedQuarantineResolution_reviewedByProfileId_idx"
  ON "LiveFeedQuarantineResolution"("reviewedByProfileId");
CREATE INDEX "LiveFeedQuarantineResolution_evidenceSha256_idx"
  ON "LiveFeedQuarantineResolution"("evidenceSha256");

CREATE UNIQUE INDEX "CanonicalEntityMerge_entityKind_retiredEntityId_key"
  ON "CanonicalEntityMerge"("entityKind", "retiredEntityId");
CREATE INDEX "CanonicalEntityMerge_entityKind_survivingEntityId_idx"
  ON "CanonicalEntityMerge"("entityKind", "survivingEntityId");
CREATE INDEX "CanonicalEntityMerge_approvedByProfileId_idx"
  ON "CanonicalEntityMerge"("approvedByProfileId");
CREATE INDEX "CanonicalEntityMerge_evidenceSha256_idx"
  ON "CanonicalEntityMerge"("evidenceSha256");

CREATE INDEX "RaceVideoVerification_raceVideoId_checkedAt_idx"
  ON "RaceVideoVerification"("raceVideoId", "checkedAt");
CREATE INDEX "RaceVideoVerification_outcome_checkedAt_idx"
  ON "RaceVideoVerification"("outcome", "checkedAt");
CREATE INDEX "RaceVideoVerification_evidenceSha256_idx"
  ON "RaceVideoVerification"("evidenceSha256");
CREATE UNIQUE INDEX "RaceVideoVerification_raceVideoId_evidenceSha256_key"
  ON "RaceVideoVerification"("raceVideoId", "evidenceSha256");

ALTER TABLE "TrackProviderIdentity"
  ADD CONSTRAINT "TrackProviderIdentity_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "MeetingProviderIdentity"
  ADD CONSTRAINT "MeetingProviderIdentity_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "RaceProviderIdentity"
  ADD CONSTRAINT "RaceProviderIdentity_raceId_fkey"
  FOREIGN KEY ("raceId") REFERENCES "Race"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "OwnerProviderIdentity"
  ADD CONSTRAINT "OwnerProviderIdentity_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DogOwnerRelationship"
  ADD CONSTRAINT "DogOwnerRelationship_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "DogOwnerRelationship"
  ADD CONSTRAINT "DogOwnerRelationship_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "LiveFeedQuarantineResolution"
  ADD CONSTRAINT "LiveFeedQuarantineResolution_summaryId_fkey"
  FOREIGN KEY ("summaryId") REFERENCES "LiveFeedQuarantineSummary"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "LiveFeedQuarantineResolution"
  ADD CONSTRAINT "LiveFeedQuarantineResolution_reviewedByProfileId_fkey"
  FOREIGN KEY ("reviewedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "CanonicalEntityMerge"
  ADD CONSTRAINT "CanonicalEntityMerge_approvedByProfileId_fkey"
  FOREIGN KEY ("approvedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "RaceVideoVerification"
  ADD CONSTRAINT "RaceVideoVerification_raceVideoId_fkey"
  FOREIGN KEY ("raceVideoId") REFERENCES "RaceVideo"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TrackProviderIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackProviderIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MeetingProviderIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingProviderIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RaceProviderIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RaceProviderIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Owner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Owner" FORCE ROW LEVEL SECURITY;
ALTER TABLE "OwnerProviderIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OwnerProviderIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DogOwnerRelationship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogOwnerRelationship" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LiveFeedQuarantineResolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveFeedQuarantineResolution" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CanonicalEntityMerge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanonicalEntityMerge" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RaceVideoVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RaceVideoVerification" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_racing_identity_read ON "TrackProviderIdentity"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_racing_identity_insert ON "TrackProviderIdentity"
  FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_racing_identity_update ON "TrackProviderIdentity"
  FOR UPDATE USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_meeting_identity_read ON "MeetingProviderIdentity"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_meeting_identity_insert ON "MeetingProviderIdentity"
  FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_meeting_identity_update ON "MeetingProviderIdentity"
  FOR UPDATE USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_race_identity_read ON "RaceProviderIdentity"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_race_identity_insert ON "RaceProviderIdentity"
  FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_race_identity_update ON "RaceProviderIdentity"
  FOR UPDATE USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());

CREATE POLICY giq_owner_read ON "Owner"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_owner_insert ON "Owner"
  FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_owner_update ON "Owner"
  FOR UPDATE USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_owner_identity_read ON "OwnerProviderIdentity"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_owner_identity_insert ON "OwnerProviderIdentity"
  FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_owner_identity_update ON "OwnerProviderIdentity"
  FOR UPDATE USING (public.giq_is_system()) WITH CHECK (public.giq_is_system());
CREATE POLICY giq_dog_owner_read ON "DogOwnerRelationship"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_dog_owner_insert ON "DogOwnerRelationship"
  FOR INSERT WITH CHECK (public.giq_is_system());

CREATE POLICY giq_quarantine_resolution_read ON "LiveFeedQuarantineResolution"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_quarantine_resolution_insert ON "LiveFeedQuarantineResolution"
  FOR INSERT WITH CHECK (public.giq_is_system() OR public.giq_is_moderator());
CREATE POLICY giq_merge_ledger_read ON "CanonicalEntityMerge"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_merge_ledger_insert ON "CanonicalEntityMerge"
  FOR INSERT WITH CHECK (public.giq_is_system());
CREATE POLICY giq_replay_verification_read ON "RaceVideoVerification"
  FOR SELECT USING (public.giq_is_system() OR public.giq_is_admin());
CREATE POLICY giq_replay_verification_insert ON "RaceVideoVerification"
  FOR INSERT WITH CHECK (public.giq_is_system());

REVOKE ALL ON TABLE
  "TrackProviderIdentity",
  "MeetingProviderIdentity",
  "RaceProviderIdentity",
  "Owner",
  "OwnerProviderIdentity",
  "DogOwnerRelationship",
  "LiveFeedQuarantineResolution",
  "CanonicalEntityMerge",
  "RaceVideoVerification"
FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON
      "TrackProviderIdentity", "MeetingProviderIdentity", "RaceProviderIdentity",
      "Owner", "OwnerProviderIdentity"
    TO greyhoundiq_runtime;
    GRANT SELECT, INSERT ON
      "DogOwnerRelationship", "LiveFeedQuarantineResolution",
      "CanonicalEntityMerge", "RaceVideoVerification"
    TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT, UPDATE ON
      "TrackProviderIdentity", "MeetingProviderIdentity", "RaceProviderIdentity",
      "Owner", "OwnerProviderIdentity"
    TO greyhoundiq_app;
    GRANT SELECT, INSERT ON
      "DogOwnerRelationship", "LiveFeedQuarantineResolution",
      "CanonicalEntityMerge", "RaceVideoVerification"
    TO greyhoundiq_app;
  END IF;
END
$$;

COMMIT;
