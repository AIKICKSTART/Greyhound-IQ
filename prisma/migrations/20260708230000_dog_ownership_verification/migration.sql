-- Dog ownership verification workflow. Forward-only.
-- Users REQUEST ownership (status pending, verified false); a moderator/admin
-- approves (status approved + verified true) or rejects (status rejected). Users
-- can never flip their own status: the UPDATE/DELETE policies stay system/moderator
-- only, and the INSERT policy pins new user rows to pending + verified false.

-- === Columns ===

ALTER TABLE "DogOwnership" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "DogOwnership" ADD COLUMN "evidence" TEXT;
ALTER TABLE "DogOwnership" ADD COLUMN "reviewedByProfileId" TEXT;
ALTER TABLE "DogOwnership" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "DogOwnership" ADD COLUMN "rejectionReason" TEXT;

ALTER TABLE "DogOwnership"
  ADD CONSTRAINT "DogOwnership_reviewedByProfileId_fkey"
  FOREIGN KEY ("reviewedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DogOwnership_status_idx" ON "DogOwnership"("status");

-- Backfill existing rows: verified links become approved, everything else pending.
UPDATE "DogOwnership" SET "status" = CASE WHEN "verified" THEN 'approved' ELSE 'pending' END;

-- === RLS policies ===
-- Replace the old public-read + system/moderator-write policies. Public now only
-- sees approved rows; a claimant always sees their own row (any status) so they can
-- watch a pending/rejected claim. Users may INSERT only their own pending claim;
-- flips to approved/verified stay moderator/system only.

DROP POLICY IF EXISTS giq_dog_ownership_select ON "DogOwnership";
DROP POLICY IF EXISTS giq_dog_ownership_write ON "DogOwnership";

CREATE POLICY giq_dog_ownership_select ON "DogOwnership" FOR SELECT USING (
  "status" = 'approved'
  OR public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_dog_ownership_insert ON "DogOwnership" FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "profileId" = public.giq_current_profile_id()
    AND "status" = 'pending'
    AND "verified" = false
  )
);

CREATE POLICY giq_dog_ownership_update ON "DogOwnership" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

CREATE POLICY giq_dog_ownership_delete ON "DogOwnership" FOR DELETE USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
