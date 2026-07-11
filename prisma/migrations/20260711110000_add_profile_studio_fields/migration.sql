ALTER TABLE "Profile"
ADD COLUMN "isFounder" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SocialActor"
ADD COLUMN "avatarZoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "avatarRotation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "coverZoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "coverRotation" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SocialActor"
ADD CONSTRAINT "SocialActor_avatar_zoom"
CHECK ("avatarZoom" BETWEEN 1 AND 3) NOT VALID,
ADD CONSTRAINT "SocialActor_cover_zoom"
CHECK ("coverZoom" BETWEEN 1 AND 3) NOT VALID,
ADD CONSTRAINT "SocialActor_avatar_rotation"
CHECK ("avatarRotation" IN (0, 90, 180, 270)) NOT VALID,
ADD CONSTRAINT "SocialActor_cover_rotation"
CHECK ("coverRotation" IN (0, 90, 180, 270)) NOT VALID;

ALTER TABLE "SocialActor" VALIDATE CONSTRAINT "SocialActor_avatar_zoom";
ALTER TABLE "SocialActor" VALIDATE CONSTRAINT "SocialActor_cover_zoom";
ALTER TABLE "SocialActor" VALIDATE CONSTRAINT "SocialActor_avatar_rotation";
ALTER TABLE "SocialActor" VALIDATE CONSTRAINT "SocialActor_cover_rotation";

CREATE OR REPLACE VIEW public.giq_public_social_actor_profiles
WITH (security_barrier = true)
AS
SELECT
  actor.id,
  actor.kind,
  actor.handle,
  actor."displayName",
  actor."avatarUrl",
  actor."coverUrl",
  actor."coverFocalX",
  actor."coverFocalY",
  actor."profileId",
  actor."pageId",
  profile.bio,
  profile.state,
  profile."kennelName",
  profile.verified,
  page."pageType",
  page.tagline,
  page.about,
  page."businessCategory",
  page."accentColor",
  CASE
    WHEN actor."contactVisibility" = 'public' THEN page."contactEmail"
    ELSE NULL
  END AS "contactEmail",
  CASE
    WHEN actor."contactVisibility" = 'public' THEN COALESCE(page."contactPhone", profile.phone)
    ELSE NULL
  END AS "contactPhone",
  CASE
    WHEN actor."contactVisibility" = 'public' THEN COALESCE(page.website, profile.website)
    ELSE NULL
  END AS website,
  actor."createdAt",
  actor."updatedAt",
  actor."avatarFocalX",
  actor."avatarFocalY",
  actor."avatarZoom",
  actor."avatarRotation",
  actor."coverZoom",
  actor."coverRotation",
  profile."isFounder"
FROM public."SocialActor" actor
LEFT JOIN public."Profile" profile ON profile.id = actor."profileId"
LEFT JOIN public."User" account ON account.id = profile."userId"
LEFT JOIN public."CustomPage" page ON page.id = actor."pageId"
WHERE actor.published
  AND actor."profileVisibility" = 'public'
  AND (
    (
      actor.kind = 'personal'
      AND profile.id IS NOT NULL
      AND account."isBanned" = false
      AND account."deletionRequestedAt" IS NULL
    )
    OR (
      actor.kind = 'page'
      AND page.id IS NOT NULL
      AND page.published
      AND page."moderationStatus" <> 'removed'
    )
  );
