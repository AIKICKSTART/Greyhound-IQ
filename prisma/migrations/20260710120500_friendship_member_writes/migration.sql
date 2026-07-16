-- Member-driven friend requests: pending -> accepted, decline/remove = delete.
-- Existing giq_friendship_write (system/moderator FOR ALL) stays as the override;
-- these permissive policies add the member paths.

ALTER TABLE "Friendship" ADD COLUMN "requestedByProfileId" TEXT;

ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_requestedBy_participant"
  CHECK (
    "requestedByProfileId" IS NULL
    OR "requestedByProfileId" IN ("profileAId", "profileBId")
  );

-- Send a request: only as yourself, only into a pair you belong to, only pending.
CREATE POLICY giq_friendship_insert ON "Friendship" FOR INSERT WITH CHECK (
  "requestedByProfileId" = public.giq_current_profile_id()
  AND public.giq_current_profile_id() IN ("profileAId", "profileBId")
  AND "status" = 'pending'
);

-- Accept: only the recipient (participant who did NOT send it), only pending -> accepted.
CREATE POLICY giq_friendship_accept ON "Friendship" FOR UPDATE USING (
  public.giq_current_profile_id() IN ("profileAId", "profileBId")
  AND "requestedByProfileId" IS NOT NULL
  AND "requestedByProfileId" <> public.giq_current_profile_id()
  AND "status" = 'pending'
) WITH CHECK (
  "status" = 'accepted'
  AND public.giq_current_profile_id() IN ("profileAId", "profileBId")
);

-- Decline / cancel / unfriend: either participant deletes the row.
CREATE POLICY giq_friendship_delete ON "Friendship" FOR DELETE USING (
  public.giq_current_profile_id() IN ("profileAId", "profileBId")
);
