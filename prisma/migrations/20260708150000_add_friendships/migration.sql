CREATE TABLE "Friendship" (
  "id" TEXT NOT NULL,
  "profileAId" TEXT NOT NULL,
  "profileBId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'accepted',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friendship_no_self" CHECK ("profileAId" <> "profileBId")
);

CREATE UNIQUE INDEX "Friendship_profileAId_profileBId_key"
  ON "Friendship"("profileAId", "profileBId");

CREATE INDEX "Friendship_profileAId_status_updatedAt_idx"
  ON "Friendship"("profileAId", "status", "updatedAt");

CREATE INDEX "Friendship_profileBId_status_updatedAt_idx"
  ON "Friendship"("profileBId", "status", "updatedAt");

ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_profileAId_fkey"
  FOREIGN KEY ("profileAId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_profileBId_fkey"
  FOREIGN KEY ("profileBId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Friendship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Friendship" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_friendship_select ON "Friendship" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "profileAId" = public.giq_current_profile_id()
  OR "profileBId" = public.giq_current_profile_id()
);

CREATE POLICY giq_friendship_write ON "Friendship" FOR ALL USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
);

INSERT INTO "Friendship" (
  "id",
  "profileAId",
  "profileBId",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'friendship-daniel-lachie-20260708',
  LEAST(daniel_profile.id, lachie_profile.id),
  GREATEST(daniel_profile.id, lachie_profile.id),
  'accepted',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" daniel_user
JOIN "Profile" daniel_profile ON daniel_profile."userId" = daniel_user.id
JOIN "User" lachie_user ON lachie_user.email = 'lachieroo4@gmail.com'
JOIN "Profile" lachie_profile ON lachie_profile."userId" = lachie_user.id
WHERE daniel_user.email = 'daniel.fleuren@aikickstart.com.au'
ON CONFLICT ("profileAId", "profileBId") DO UPDATE SET
  "status" = 'accepted',
  "updatedAt" = CURRENT_TIMESTAMP;
