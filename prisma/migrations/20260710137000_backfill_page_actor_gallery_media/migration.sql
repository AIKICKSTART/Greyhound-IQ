-- Backfill legacy managed-page media into the actor-owned relation used by
-- protected delivery. Invalid JSON and media not uploaded by the page owner
-- are ignored. Existing actor media is preserved, making this safe to re-run.
CREATE OR REPLACE FUNCTION pg_temp.giq_safe_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN COALESCE(value, '{}')::jsonb;
EXCEPTION WHEN others THEN
  RETURN '{}'::jsonb;
END;
$$;

WITH page_actors AS (
  SELECT
    actor.id AS actor_id,
    owner_profile."userId" AS owner_user_id,
    page."heroMediaId" AS hero_media_id,
    pg_temp.giq_safe_jsonb(page."contentJson") AS content
  FROM "CustomPage" page
  JOIN "SocialActor" actor
    ON actor."pageId" = page.id
   AND actor.kind = 'page'
   AND actor."ownerProfileId" = page."ownerProfileId"
  JOIN "Profile" owner_profile
    ON owner_profile.id = page."ownerProfileId"
), candidate_media AS (
  SELECT
    page_actor.actor_id,
    page_actor.owner_user_id,
    fixed.media_id,
    fixed.position
  FROM page_actors page_actor
  CROSS JOIN LATERAL (
    VALUES
      (page_actor.content ->> 'avatarMediaId', 0),
      (page_actor.content ->> 'bannerMediaId', 1),
      (page_actor.content ->> 'logoMediaId', 2),
      (page_actor.hero_media_id, 3),
      (page_actor.content ->> 'cardMediaId', 4)
  ) AS fixed(media_id, position)

  UNION ALL

  SELECT
    page_actor.actor_id,
    page_actor.owner_user_id,
    gallery.media_id,
    4 + gallery.ordinality::integer
  FROM page_actors page_actor
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(page_actor.content -> 'galleryMediaIds') = 'array'
        THEN page_actor.content -> 'galleryMediaIds'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS gallery(media_id, ordinality)
), owned_media AS (
  SELECT DISTINCT ON (candidate.actor_id, candidate.media_id)
    candidate.actor_id,
    candidate.media_id,
    candidate.position,
    media."altText"
  FROM candidate_media candidate
  JOIN "MediaAsset" media
    ON media.id = candidate.media_id
   AND media."uploaderId" = candidate.owner_user_id
   AND media."deletedAt" IS NULL
  WHERE candidate.media_id IS NOT NULL
    AND btrim(candidate.media_id) <> ''
  ORDER BY candidate.actor_id, candidate.media_id, candidate.position
), missing_media AS (
  SELECT
    owned.actor_id,
    owned.media_id,
    owned."altText",
    COALESCE(existing.max_position, -1)
      + row_number() OVER (
          PARTITION BY owned.actor_id
          ORDER BY owned.position, owned.media_id
        )::integer AS position
  FROM owned_media owned
  LEFT JOIN LATERAL (
    SELECT max(gallery.position) AS max_position
    FROM "ActorGalleryMedia" gallery
    WHERE gallery."actorId" = owned.actor_id
  ) existing ON true
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ActorGalleryMedia" gallery
    WHERE gallery."actorId" = owned.actor_id
      AND gallery."mediaId" = owned.media_id
  )
)
INSERT INTO "ActorGalleryMedia" (
  "actorId",
  "mediaId",
  position,
  "altText",
  "createdAt"
)
SELECT
  missing.actor_id,
  missing.media_id,
  missing.position,
  missing."altText",
  CURRENT_TIMESTAMP
FROM missing_media missing
ON CONFLICT DO NOTHING;
