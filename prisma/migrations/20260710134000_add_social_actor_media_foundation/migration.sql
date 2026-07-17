-- Additive actor/privacy/media foundation. Legacy profile/page author and
-- participant columns stay in place for dual-write and rollback compatibility.

CREATE TABLE "SocialActor" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "profileId" TEXT,
  "pageId" TEXT,
  "ownerProfileId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "coverUrl" TEXT,
  "coverFocalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "coverFocalY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "profileVisibility" TEXT NOT NULL DEFAULT 'members',
  "contactVisibility" TEXT NOT NULL DEFAULT 'only_me',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialActor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialActor_identity_xor" CHECK (
    (("profileId" IS NOT NULL)::int + ("pageId" IS NOT NULL)::int) = 1
  ),
  CONSTRAINT "SocialActor_kind_identity" CHECK (
    ("kind" = 'personal' AND "profileId" IS NOT NULL AND "pageId" IS NULL)
    OR ("kind" = 'page' AND "profileId" IS NULL AND "pageId" IS NOT NULL)
  ),
  CONSTRAINT "SocialActor_profile_visibility" CHECK (
    "profileVisibility" IN ('public', 'members', 'connections', 'only_me')
  ),
  CONSTRAINT "SocialActor_contact_visibility" CHECK (
    "contactVisibility" IN ('public', 'members', 'connections', 'only_me')
  ),
  CONSTRAINT "SocialActor_cover_focal_x" CHECK ("coverFocalX" BETWEEN 0 AND 1),
  CONSTRAINT "SocialActor_cover_focal_y" CHECK ("coverFocalY" BETWEEN 0 AND 1)
);

CREATE UNIQUE INDEX "SocialActor_profileId_key" ON "SocialActor"("profileId");
CREATE UNIQUE INDEX "SocialActor_pageId_key" ON "SocialActor"("pageId");
CREATE UNIQUE INDEX "SocialActor_handle_key" ON "SocialActor"("handle");
CREATE INDEX "SocialActor_ownerProfileId_kind_idx" ON "SocialActor"("ownerProfileId", "kind");
CREATE INDEX "SocialActor_kind_published_updatedAt_idx" ON "SocialActor"("kind", "published", "updatedAt");
CREATE INDEX "SocialActor_profileVisibility_published_idx" ON "SocialActor"("profileVisibility", "published");
CREATE INDEX "SocialActor_displayName_trgm_idx" ON "SocialActor" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "SocialActor_handle_trgm_idx" ON "SocialActor" USING GIN (handle gin_trgm_ops);

ALTER TABLE "SocialActor"
  ADD CONSTRAINT "SocialActor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SocialActor_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CustomPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SocialActor_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActorFollow" (
  "followerActorId" TEXT NOT NULL,
  "followedActorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActorFollow_pkey" PRIMARY KEY ("followerActorId", "followedActorId"),
  CONSTRAINT "ActorFollow_not_self" CHECK ("followerActorId" <> "followedActorId")
);

CREATE INDEX "ActorFollow_followedActorId_createdAt_idx" ON "ActorFollow"("followedActorId", "createdAt");
ALTER TABLE "ActorFollow"
  ADD CONSTRAINT "ActorFollow_followerActorId_fkey" FOREIGN KEY ("followerActorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActorFollow_followedActorId_fkey" FOREIGN KEY ("followedActorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActorTopicFollow" (
  "actorId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActorTopicFollow_pkey" PRIMARY KEY ("actorId", "topicId")
);

CREATE INDEX "ActorTopicFollow_topicId_createdAt_idx" ON "ActorTopicFollow"("topicId", "createdAt");
ALTER TABLE "ActorTopicFollow"
  ADD CONSTRAINT "ActorTopicFollow_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActorTopicFollow_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "FeedTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActorMute" (
  "muterActorId" TEXT NOT NULL,
  "mutedActorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActorMute_pkey" PRIMARY KEY ("muterActorId", "mutedActorId"),
  CONSTRAINT "ActorMute_not_self" CHECK ("muterActorId" <> "mutedActorId")
);

CREATE INDEX "ActorMute_mutedActorId_createdAt_idx" ON "ActorMute"("mutedActorId", "createdAt");
ALTER TABLE "ActorMute"
  ADD CONSTRAINT "ActorMute_muterActorId_fkey" FOREIGN KEY ("muterActorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActorMute_mutedActorId_fkey" FOREIGN KEY ("mutedActorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActorGalleryMedia" (
  "actorId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "altText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActorGalleryMedia_pkey" PRIMARY KEY ("actorId", "mediaId")
);

CREATE UNIQUE INDEX "ActorGalleryMedia_actorId_position_key" ON "ActorGalleryMedia"("actorId", "position");
CREATE INDEX "ActorGalleryMedia_mediaId_idx" ON "ActorGalleryMedia"("mediaId");
ALTER TABLE "ActorGalleryMedia"
  ADD CONSTRAINT "ActorGalleryMedia_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActorGalleryMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SavedFeedPost" (
  "actorId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedFeedPost_pkey" PRIMARY KEY ("actorId", "postId")
);

CREATE INDEX "SavedFeedPost_postId_createdAt_idx" ON "SavedFeedPost"("postId", "createdAt");
ALTER TABLE "SavedFeedPost"
  ADD CONSTRAINT "SavedFeedPost_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SavedFeedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeedMention" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "accountableProfileId" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedMention_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedMention_target_xor" CHECK (
    (("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1
  )
);

CREATE UNIQUE INDEX "FeedMention_actorId_postId_commentId_key" ON "FeedMention"("actorId", "postId", "commentId");
CREATE UNIQUE INDEX "FeedMention_actorId_postId_key" ON "FeedMention"("actorId", "postId") WHERE "postId" IS NOT NULL;
CREATE UNIQUE INDEX "FeedMention_actorId_commentId_key" ON "FeedMention"("actorId", "commentId") WHERE "commentId" IS NOT NULL;
CREATE INDEX "FeedMention_postId_idx" ON "FeedMention"("postId");
CREATE INDEX "FeedMention_commentId_idx" ON "FeedMention"("commentId");
CREATE INDEX "FeedMention_accountableProfileId_createdAt_idx" ON "FeedMention"("accountableProfileId", "createdAt");
ALTER TABLE "FeedMention"
  ADD CONSTRAINT "FeedMention_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeedMention_accountableProfileId_fkey" FOREIGN KEY ("accountableProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeedMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeedMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "FeedComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeedShare" (
  "id" TEXT NOT NULL,
  "sourcePostId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "accountableProfileId" TEXT NOT NULL,
  "body" TEXT,
  "visibility" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedShare_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedShare_visibility" CHECK ("visibility" IN ('public', 'members', 'connections', 'only_me'))
);

CREATE UNIQUE INDEX "FeedShare_sourcePostId_actorId_key" ON "FeedShare"("sourcePostId", "actorId");
CREATE INDEX "FeedShare_actorId_createdAt_idx" ON "FeedShare"("actorId", "createdAt");
CREATE INDEX "FeedShare_accountableProfileId_createdAt_idx" ON "FeedShare"("accountableProfileId", "createdAt");
ALTER TABLE "FeedShare"
  ADD CONSTRAINT "FeedShare_sourcePostId_fkey" FOREIGN KEY ("sourcePostId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeedShare_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FeedShare_accountableProfileId_fkey" FOREIGN KEY ("accountableProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD COLUMN "actorId" TEXT;
ALTER TABLE "Message" ADD COLUMN "senderActorId" TEXT, ADD COLUMN "recipientActorId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "participantAActorId" TEXT, ADD COLUMN "participantBActorId" TEXT;
ALTER TABLE "ConversationParticipant" ADD COLUMN "actorId" TEXT;
ALTER TABLE "FeedPost"
  ADD COLUMN "authorActorId" TEXT,
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "linkPreviewUrl" TEXT,
  ADD COLUMN "linkPreviewStatus" TEXT,
  ADD COLUMN "linkPreviewJson" TEXT;
ALTER TABLE "FeedComment" ADD COLUMN "authorActorId" TEXT, ADD COLUMN "editedAt" TIMESTAMP(3), ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "FeedReaction" ADD COLUMN "actorId" TEXT;
ALTER TABLE "MediaAsset"
  ADD COLUMN "processingStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "processingError" TEXT,
  ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "processingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "playbackPath" TEXT,
  ADD COLUMN "posterPath" TEXT,
  ADD COLUMN "hlsPath" TEXT,
  ADD COLUMN "waveformJson" TEXT,
  ADD COLUMN "metadataJson" TEXT,
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "captionPath" TEXT;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderActorId_fkey" FOREIGN KEY ("senderActorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Message_recipientActorId_fkey" FOREIGN KEY ("recipientActorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_participantAActorId_fkey" FOREIGN KEY ("participantAActorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Conversation_participantBActorId_fkey" FOREIGN KEY ("participantBActorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_authorActorId_fkey" FOREIGN KEY ("authorActorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_authorActorId_fkey" FOREIGN KEY ("authorActorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedReaction" ADD CONSTRAINT "FeedReaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SocialActor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notification_actorId_createdAt_idx" ON "Notification"("actorId", "createdAt");
CREATE INDEX "Message_senderActorId_createdAt_idx" ON "Message"("senderActorId", "createdAt");
CREATE INDEX "Message_recipientActorId_createdAt_idx" ON "Message"("recipientActorId", "createdAt");
CREATE INDEX "Message_body_trgm_idx" ON "Message" USING GIN (body gin_trgm_ops);
CREATE INDEX "Conversation_participantAActorId_idx" ON "Conversation"("participantAActorId");
CREATE INDEX "Conversation_participantBActorId_idx" ON "Conversation"("participantBActorId");
CREATE INDEX "ConversationParticipant_actorId_archivedAt_updatedAt_idx" ON "ConversationParticipant"("actorId", "archivedAt", "updatedAt");
CREATE INDEX "FeedPost_authorActorId_status_createdAt_idx" ON "FeedPost"("authorActorId", "status", "createdAt");
CREATE INDEX "FeedComment_authorActorId_createdAt_idx" ON "FeedComment"("authorActorId", "createdAt");
CREATE INDEX "FeedReaction_actorId_createdAt_idx" ON "FeedReaction"("actorId", "createdAt");
CREATE INDEX "MediaAsset_processingStatus_createdAt_idx" ON "MediaAsset"("processingStatus", "createdAt");

INSERT INTO "SocialActor" (
  "id", "kind", "profileId", "ownerProfileId", "handle", "displayName",
  "avatarUrl", "profileVisibility", "contactVisibility", "published", "createdAt", "updatedAt"
)
SELECT
  'actor_profile_' || md5(p.id),
  'personal',
  p.id,
  p.id,
  'member-' || md5(p.id),
  p."displayName",
  p."avatarUrl",
  'members',
  'only_me',
  true,
  p."createdAt",
  p."updatedAt"
FROM "Profile" p
ON CONFLICT ("profileId") DO NOTHING;

INSERT INTO "SocialActor" (
  "id", "kind", "pageId", "ownerProfileId", "handle", "displayName",
  "profileVisibility", "contactVisibility", "published", "createdAt", "updatedAt"
)
SELECT
  'actor_page_' || md5(p.id),
  'page',
  p.id,
  p."ownerProfileId",
  p.handle,
  p.title,
  'public',
  'only_me',
  p.published,
  p."createdAt",
  p."updatedAt"
FROM "CustomPage" p
ON CONFLICT ("pageId") DO NOTHING;

-- These actor-only backfills update rows protected by legacy entitlement
-- triggers. Disable only those named triggers inside this migration transaction;
-- PostgreSQL keeps the table locks until they are re-enabled below and committed.
ALTER TABLE "FeedPost" DISABLE TRIGGER giq_feed_post_pro_write;
ALTER TABLE "Message" DISABLE TRIGGER giq_message_pro_write;
ALTER TABLE "Conversation" DISABLE TRIGGER giq_conversation_pro_write;

UPDATE "FeedPost" p
SET "authorActorId" = a.id,
    "publishedAt" = CASE WHEN p.status = 'active' THEN p."createdAt" ELSE NULL END
FROM "SocialActor" a
WHERE p."authorActorId" IS NULL
  AND ((p."authorPageId" IS NOT NULL AND a."pageId" = p."authorPageId")
    OR (p."authorPageId" IS NULL AND a."profileId" = p."authorProfileId"));

UPDATE "FeedComment" c SET "authorActorId" = a.id
FROM "SocialActor" a WHERE c."authorActorId" IS NULL AND a."profileId" = c."authorProfileId";
UPDATE "FeedReaction" r SET "actorId" = a.id
FROM "SocialActor" a WHERE r."actorId" IS NULL AND a."profileId" = r."profileId";
UPDATE "Message" m SET "senderActorId" = a.id
FROM "SocialActor" a WHERE m."senderActorId" IS NULL AND a."profileId" = m."senderId";
UPDATE "Message" m SET "recipientActorId" = a.id
FROM "SocialActor" a WHERE m."recipientActorId" IS NULL AND a."profileId" = m."recipientId";
UPDATE "Conversation" c SET "participantAActorId" = a.id
FROM "SocialActor" a WHERE c."participantAActorId" IS NULL AND a."profileId" = c."participantAId";
UPDATE "Conversation" c SET "participantBActorId" = a.id
FROM "SocialActor" a WHERE c."participantBActorId" IS NULL AND a."profileId" = c."participantBId";

ALTER TABLE "FeedPost" ENABLE TRIGGER giq_feed_post_pro_write;
ALTER TABLE "Message" ENABLE TRIGGER giq_message_pro_write;
ALTER TABLE "Conversation" ENABLE TRIGGER giq_conversation_pro_write;

UPDATE "ConversationParticipant" c SET "actorId" = a.id
FROM "SocialActor" a WHERE c."actorId" IS NULL AND a."profileId" = c."profileId";
UPDATE "Notification" n SET "actorId" = a.id
FROM "SocialActor" a WHERE n."actorId" IS NULL AND a."profileId" = n."actorProfileId";
UPDATE "MediaAsset"
SET "processingStatus" = CASE
  WHEN "scanStatus" = 'clean' THEN 'ready'
  WHEN "scanStatus" IN ('infected', 'error') THEN 'failed'
  ELSE 'pending'
END,
"processingCompletedAt" = CASE WHEN "scanStatus" IN ('clean', 'infected', 'error') THEN "scanCompletedAt" ELSE NULL END;

CREATE OR REPLACE FUNCTION public.giq_current_actor_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT a.id FROM public."SocialActor" a
      WHERE a.id = public.giq_claim('current_actor_id')
        AND a."ownerProfileId" = public.giq_current_profile_id()
      LIMIT 1
    ),
    (
      SELECT a.id FROM public."SocialActor" a
      WHERE a."profileId" = public.giq_current_profile_id()
      LIMIT 1
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.giq_actor_owned(actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public."SocialActor" a
    WHERE a.id = actor_id
      AND a."ownerProfileId" = public.giq_current_profile_id()
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.giq_actor_connected(actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."SocialActor" a
    WHERE a.id = actor_id
      AND (
        (a.kind = 'personal' AND EXISTS (
          SELECT 1 FROM public."Friendship" f
          WHERE f.status = 'accepted'
            AND ((f."profileAId" = public.giq_current_profile_id() AND f."profileBId" = a."profileId")
              OR (f."profileBId" = public.giq_current_profile_id() AND f."profileAId" = a."profileId"))
        ))
        OR (a.kind = 'page' AND EXISTS (
          SELECT 1 FROM public."ActorFollow" af
          WHERE af."followerActorId" = public.giq_current_actor_id()
            AND af."followedActorId" = a.id
        ))
      )
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.giq_actor_visible(actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public."SocialActor" a
    WHERE a.id = actor_id
      AND (
        public.giq_is_system()
        OR public.giq_is_moderator()
        OR a."ownerProfileId" = public.giq_current_profile_id()
        OR (a.published AND a."profileVisibility" = 'public')
        OR (a.published AND a."profileVisibility" = 'members' AND public.giq_current_profile_id() IS NOT NULL)
        OR (a.published AND a."profileVisibility" = 'connections' AND public.giq_actor_connected(a.id))
      )
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.giq_social_actor_identity_valid(
  actor_kind text,
  profile_id text,
  page_id text,
  owner_profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE actor_kind
    WHEN 'personal' THEN profile_id = owner_profile_id AND page_id IS NULL
    WHEN 'page' THEN profile_id IS NULL AND EXISTS (
      SELECT 1
      FROM public."CustomPage" page
      WHERE page.id = page_id
        AND page."ownerProfileId" = owner_profile_id
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.giq_actor_can_act(actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."SocialActor" actor
    WHERE actor.id = actor_id
      AND actor."ownerProfileId" = public.giq_current_profile_id()
      AND (actor.kind = 'personal' OR public.giq_is_pro())
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.giq_social_actor_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.giq_social_actor_identity_valid(
    NEW.kind,
    NEW."profileId",
    NEW."pageId",
    NEW."ownerProfileId"
  ) THEN
    RAISE EXCEPTION 'actor.identity_not_owned' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.kind IS DISTINCT FROM NEW.kind
    OR OLD."profileId" IS DISTINCT FROM NEW."profileId"
    OR OLD."pageId" IS DISTINCT FROM NEW."pageId"
    OR OLD."ownerProfileId" IS DISTINCT FROM NEW."ownerProfileId"
  ) THEN
    RAISE EXCEPTION 'actor.identity_immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER giq_social_actor_identity_guard
BEFORE INSERT OR UPDATE ON "SocialActor"
FOR EACH ROW EXECUTE FUNCTION public.giq_social_actor_identity_guard();

CREATE OR REPLACE FUNCTION public.giq_media_owned_by_actor(
  actor_id text,
  media_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."SocialActor" actor
    JOIN public."Profile" profile ON profile.id = actor."ownerProfileId"
    JOIN public."MediaAsset" media ON media.id = media_id
    WHERE actor.id = actor_id
      AND media."uploaderId" = profile."userId"
      AND media."deletedAt" IS NULL
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.giq_audience_rank(audience text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE audience
    WHEN 'only_me' THEN 1
    WHEN 'connections' THEN 2
    WHEN 'members' THEN 3
    WHEN 'public' THEN 4
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.giq_feed_post_visible(post_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."FeedPost" p
    LEFT JOIN public."SocialActor" a ON a.id = p."authorActorId"
    WHERE p.id = post_id
      AND p."deletedAt" IS NULL
      AND (
        public.giq_is_system()
        OR public.giq_is_moderator()
        OR p."authorProfileId" = public.giq_current_profile_id()
        OR (
          p.status = 'active'
          AND (a.id IS NULL OR a.published)
          AND NOT EXISTS (
            SELECT 1 FROM public."UserBlock" b
            WHERE (b."blockerProfileId" = public.giq_current_profile_id() AND b."blockedProfileId" = p."authorProfileId")
               OR (b."blockedProfileId" = public.giq_current_profile_id() AND b."blockerProfileId" = p."authorProfileId")
          )
          AND NOT EXISTS (
            SELECT 1 FROM public."ActorMute" m
            WHERE m."muterActorId" = public.giq_current_actor_id()
              AND m."mutedActorId" = p."authorActorId"
          )
          AND (
            p.visibility = 'public'
            OR (p.visibility = 'members' AND public.giq_current_profile_id() IS NOT NULL)
            OR (p.visibility = 'connections' AND (
              public.giq_actor_connected(p."authorActorId")
              OR (p."authorActorId" IS NULL AND EXISTS (
                SELECT 1 FROM public."Friendship" f
                WHERE f.status = 'accepted'
                  AND ((f."profileAId" = public.giq_current_profile_id() AND f."profileBId" = p."authorProfileId")
                    OR (f."profileBId" = public.giq_current_profile_id() AND f."profileAId" = p."authorProfileId"))
              ))
            ))
            OR (p.visibility = 'only_me' AND p."authorProfileId" = public.giq_current_profile_id())
          )
        )
      )
  ), false)
$$;

ALTER TABLE "SocialActor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialActor" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ActorFollow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActorFollow" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ActorTopicFollow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActorTopicFollow" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ActorMute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActorMute" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ActorGalleryMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActorGalleryMedia" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SavedFeedPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedFeedPost" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FeedMention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedMention" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FeedShare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedShare" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_social_actor_select ON "SocialActor" FOR SELECT USING (public.giq_actor_visible(id));
CREATE POLICY giq_social_actor_insert ON "SocialActor" FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "ownerProfileId" = public.giq_current_profile_id()
    AND public.giq_social_actor_identity_valid(kind, "profileId", "pageId", "ownerProfileId")
    AND (kind = 'personal' OR public.giq_is_pro())
  )
);
CREATE POLICY giq_social_actor_update ON "SocialActor" FOR UPDATE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR ("ownerProfileId" = public.giq_current_profile_id() AND (kind = 'personal' OR public.giq_is_pro()))
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    "ownerProfileId" = public.giq_current_profile_id()
    AND public.giq_social_actor_identity_valid(kind, "profileId", "pageId", "ownerProfileId")
    AND (kind = 'personal' OR public.giq_is_pro())
  )
);

CREATE POLICY giq_actor_follow_select ON "ActorFollow" FOR SELECT USING (
  public.giq_is_moderator()
  OR public.giq_actor_owned("followerActorId")
  OR (public.giq_actor_visible("followerActorId") AND public.giq_actor_visible("followedActorId"))
);
CREATE POLICY giq_actor_follow_write ON "ActorFollow" FOR ALL USING (
  public.giq_is_moderator() OR public.giq_actor_owned("followerActorId")
) WITH CHECK (
  public.giq_is_moderator() OR (public.giq_actor_can_act("followerActorId") AND "followerActorId" <> "followedActorId")
);
CREATE POLICY giq_actor_topic_follow_access ON "ActorTopicFollow" FOR ALL USING (
  public.giq_is_moderator() OR public.giq_actor_owned("actorId")
) WITH CHECK (public.giq_is_moderator() OR public.giq_actor_can_act("actorId"));
CREATE POLICY giq_actor_mute_access ON "ActorMute" FOR ALL USING (
  public.giq_is_moderator() OR public.giq_actor_owned("muterActorId")
) WITH CHECK (
  public.giq_is_moderator() OR (public.giq_actor_can_act("muterActorId") AND "muterActorId" <> "mutedActorId")
);
CREATE POLICY giq_actor_gallery_select ON "ActorGalleryMedia" FOR SELECT USING (public.giq_actor_visible("actorId"));
CREATE POLICY giq_actor_gallery_write ON "ActorGalleryMedia" FOR ALL USING (
  public.giq_is_moderator() OR public.giq_actor_owned("actorId")
) WITH CHECK (
  public.giq_is_moderator()
  OR (public.giq_actor_can_act("actorId") AND public.giq_media_owned_by_actor("actorId", "mediaId"))
);
CREATE POLICY giq_saved_feed_post_access ON "SavedFeedPost" FOR ALL USING (
  public.giq_is_moderator() OR public.giq_actor_owned("actorId")
) WITH CHECK (
  (public.giq_is_moderator() OR public.giq_actor_can_act("actorId"))
  AND public.giq_feed_post_visible("postId")
);
CREATE POLICY giq_feed_mention_select ON "FeedMention" FOR SELECT USING (
  public.giq_is_moderator() OR public.giq_actor_owned("actorId")
  OR ("postId" IS NOT NULL AND public.giq_feed_post_visible("postId"))
  OR ("commentId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "FeedComment" c WHERE c.id = "commentId" AND public.giq_feed_post_visible(c."postId")
  ))
);
CREATE POLICY giq_feed_mention_write ON "FeedMention" FOR ALL USING (
  public.giq_is_moderator() OR "accountableProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR (
    "accountableProfileId" = public.giq_current_profile_id()
    AND public.giq_actor_visible("actorId")
    AND (
      ("postId" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "FeedPost" post
        WHERE post.id = "postId"
          AND post."authorProfileId" = public.giq_current_profile_id()
      ))
      OR ("commentId" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "FeedComment" comment
        WHERE comment.id = "commentId"
          AND comment."authorProfileId" = public.giq_current_profile_id()
      ))
    )
  )
);
CREATE POLICY giq_feed_share_select ON "FeedShare" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_feed_post_visible("sourcePostId") AND (
      visibility = 'public'
      OR (visibility = 'members' AND public.giq_current_profile_id() IS NOT NULL)
      OR (visibility = 'connections' AND public.giq_actor_connected("actorId"))
      OR (visibility = 'only_me' AND public.giq_actor_owned("actorId"))
    )
  )
);
CREATE POLICY giq_feed_share_write ON "FeedShare" FOR ALL USING (
  public.giq_is_moderator() OR (public.giq_actor_owned("actorId") AND "accountableProfileId" = public.giq_current_profile_id())
) WITH CHECK (
  public.giq_is_moderator() OR (
    public.giq_actor_can_act("actorId")
    AND "accountableProfileId" = public.giq_current_profile_id()
    AND public.giq_feed_post_visible("sourcePostId")
    AND public.giq_audience_rank(visibility) <= (
      SELECT public.giq_audience_rank(p.visibility) FROM "FeedPost" p WHERE p.id = "sourcePostId"
    )
  )
);

DROP POLICY IF EXISTS giq_feed_post_select ON "FeedPost";
CREATE POLICY giq_feed_post_select ON "FeedPost" FOR SELECT USING (public.giq_feed_post_visible(id));
DROP POLICY IF EXISTS giq_feed_comment_select ON "FeedComment";
CREATE POLICY giq_feed_comment_select ON "FeedComment" FOR SELECT USING (
  "deletedAt" IS NULL
  AND (public.giq_is_moderator() OR "authorProfileId" = public.giq_current_profile_id()
    OR (status = 'active' AND public.giq_feed_post_visible("postId")))
);
DROP POLICY IF EXISTS giq_feed_reaction_select ON "FeedReaction";
CREATE POLICY giq_feed_reaction_select ON "FeedReaction" FOR SELECT USING (
  ("postId" IS NOT NULL AND public.giq_feed_post_visible("postId"))
  OR ("commentId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "FeedComment" c WHERE c.id = "commentId" AND public.giq_feed_post_visible(c."postId")
  ))
);

-- During the additive/dual-write window legacy revisions may still write a
-- NULL actor id. When an actor id is present it must be owned by the
-- accountable profile and match the legacy personal/page author columns.
CREATE OR REPLACE FUNCTION public.giq_actor_accountable(
  actor_id text,
  accountable_profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT actor_id IS NULL OR EXISTS (
    SELECT 1
    FROM public."SocialActor" a
    WHERE a.id = actor_id
      AND a."ownerProfileId" = accountable_profile_id
      AND a."ownerProfileId" = public.giq_current_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.giq_feed_actor_consistent(
  actor_id text,
  accountable_profile_id text,
  page_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT actor_id IS NULL OR EXISTS (
    SELECT 1
    FROM public."SocialActor" a
    WHERE a.id = actor_id
      AND a."ownerProfileId" = accountable_profile_id
      AND a."ownerProfileId" = public.giq_current_profile_id()
      AND (
        (page_id IS NULL AND a.kind = 'personal' AND a."profileId" = accountable_profile_id)
        OR (page_id IS NOT NULL AND a.kind = 'page' AND a."pageId" = page_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.giq_feed_actor_can_publish(actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT actor_id IS NULL OR public.giq_actor_can_act(actor_id);
$$;

DROP POLICY IF EXISTS giq_feed_post_insert ON "FeedPost";
CREATE POLICY giq_feed_post_insert ON "FeedPost" FOR INSERT WITH CHECK (
  public.giq_is_moderator()
  OR (
    public.giq_can_publish_feed_as("authorProfileId", "authorPageId")
    AND public.giq_feed_actor_consistent("authorActorId", "authorProfileId", "authorPageId")
  )
);
DROP POLICY IF EXISTS giq_feed_post_update ON "FeedPost";
CREATE POLICY giq_feed_post_update ON "FeedPost" FOR UPDATE USING (
  public.giq_is_moderator() OR "authorProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR (
    public.giq_can_publish_feed_as("authorProfileId", "authorPageId")
    AND public.giq_feed_actor_consistent("authorActorId", "authorProfileId", "authorPageId")
  )
);

DROP POLICY IF EXISTS giq_feed_comment_insert ON "FeedComment";
CREATE POLICY giq_feed_comment_insert ON "FeedComment" FOR INSERT WITH CHECK (
  public.giq_is_moderator()
  OR (
    "authorProfileId" = public.giq_current_profile_id()
    AND public.giq_actor_accountable("authorActorId", "authorProfileId")
    AND public.giq_feed_actor_can_publish("authorActorId")
    AND public.giq_feed_post_visible("postId")
  )
);
DROP POLICY IF EXISTS giq_feed_comment_update ON "FeedComment";
CREATE POLICY giq_feed_comment_update ON "FeedComment" FOR UPDATE USING (
  public.giq_is_moderator() OR "authorProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR (
    "authorProfileId" = public.giq_current_profile_id()
    AND public.giq_actor_accountable("authorActorId", "authorProfileId")
    AND public.giq_feed_actor_can_publish("authorActorId")
  )
);

DROP POLICY IF EXISTS giq_feed_reaction_insert ON "FeedReaction";
CREATE POLICY giq_feed_reaction_insert ON "FeedReaction" FOR INSERT WITH CHECK (
  public.giq_is_moderator()
  OR (
    "profileId" = public.giq_current_profile_id()
    AND public.giq_actor_accountable("actorId", "profileId")
    AND public.giq_feed_actor_can_publish("actorId")
    AND (
      ("postId" IS NOT NULL AND public.giq_feed_post_visible("postId"))
      OR ("commentId" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "FeedComment" c
        WHERE c.id = "commentId" AND public.giq_feed_post_visible(c."postId")
      ))
    )
  )
);

DROP POLICY IF EXISTS giq_feed_reaction_update ON "FeedReaction";
CREATE POLICY giq_feed_reaction_update ON "FeedReaction" FOR UPDATE USING (
  public.giq_is_moderator() OR "profileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR (
    "profileId" = public.giq_current_profile_id()
    AND public.giq_actor_accountable("actorId", "profileId")
    AND public.giq_feed_actor_can_publish("actorId")
    AND (
      ("postId" IS NOT NULL AND public.giq_feed_post_visible("postId"))
      OR ("commentId" IS NOT NULL AND EXISTS (
        SELECT 1 FROM "FeedComment" comment
        WHERE comment.id = "commentId"
          AND public.giq_feed_post_visible(comment."postId")
      ))
    )
  )
);

ALTER TABLE "FeedPost"
  ADD CONSTRAINT giq_feed_post_visibility_check
  CHECK (visibility IN ('public', 'members', 'connections', 'only_me')) NOT VALID;
ALTER TABLE "FeedReaction"
  ADD CONSTRAINT giq_feed_reaction_target_xor_check
  CHECK (("postId" IS NULL) <> ("commentId" IS NULL)) NOT VALID;
ALTER TABLE "FeedReaction"
  ADD CONSTRAINT giq_feed_reaction_type_check
  CHECK ("reactionType" IN ('like', 'love', 'celebrate', 'insightful', 'support')) NOT VALID;

CREATE OR REPLACE FUNCTION public.giq_actor_belongs_to_profile(
  actor_id text,
  profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT actor_id IS NULL OR EXISTS (
    SELECT 1 FROM public."SocialActor" a
    WHERE a.id = actor_id AND a."ownerProfileId" = profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.giq_conversation_actor_pair_valid(
  profile_a_id text,
  actor_a_id text,
  profile_b_id text,
  actor_b_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.giq_actor_belongs_to_profile(actor_a_id, profile_a_id)
    AND public.giq_actor_belongs_to_profile(actor_b_id, profile_b_id);
$$;

CREATE OR REPLACE FUNCTION public.giq_conversation_actor_can_start(
  profile_a_id text,
  actor_a_id text,
  profile_b_id text,
  actor_b_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    public.giq_current_profile_id() = profile_a_id
    AND (
      actor_a_id IS NULL
      OR public.giq_is_pro()
      OR EXISTS (
        SELECT 1 FROM public."SocialActor" actor
        WHERE actor.id = actor_a_id AND actor.kind = 'personal'
      )
    )
  ) OR (
    public.giq_current_profile_id() = profile_b_id
    AND (
      actor_b_id IS NULL
      OR public.giq_is_pro()
      OR EXISTS (
        SELECT 1 FROM public."SocialActor" actor
        WHERE actor.id = actor_b_id AND actor.kind = 'personal'
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.giq_conversation_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF public.giq_is_system() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;
  IF public.giq_current_profile_id() NOT IN (NEW."participantAId", NEW."participantBId") THEN
    RAISE EXCEPTION 'auth.forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT public.giq_conversation_actor_pair_valid(
    NEW."participantAId", NEW."participantAActorId",
    NEW."participantBId", NEW."participantBActorId"
  ) THEN
    RAISE EXCEPTION 'conversation.actor_not_authorized' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.giq_conversation_actor_can_start(
      NEW."participantAId", NEW."participantAActorId",
      NEW."participantBId", NEW."participantBActorId"
    ) THEN
      RAISE EXCEPTION 'payment.required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (
    OLD."participantAId" <> NEW."participantAId"
    OR OLD."participantBId" <> NEW."participantBId"
    OR (OLD."participantAActorId" IS NOT NULL AND OLD."participantAActorId" IS DISTINCT FROM NEW."participantAActorId")
    OR (OLD."participantBActorId" IS NOT NULL AND OLD."participantBActorId" IS DISTINCT FROM NEW."participantBActorId")
  ) THEN
    RAISE EXCEPTION 'conversation.participants_immutable' USING ERRCODE = '42501';
  END IF;

  IF (
    OLD."participantAActorId" IS DISTINCT FROM NEW."participantAActorId"
    OR OLD."participantBActorId" IS DISTINCT FROM NEW."participantBActorId"
  ) AND NOT public.giq_conversation_actor_can_start(
    NEW."participantAId", NEW."participantAActorId",
    NEW."participantBId", NEW."participantBActorId"
  ) THEN
    RAISE EXCEPTION 'payment.required' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.giq_message_actor_pair_valid(
  conversation_id text,
  sender_profile_id text,
  sender_actor_id text,
  recipient_profile_id text,
  recipient_actor_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public."Conversation" c
    WHERE c.id = conversation_id
      AND (
        (c."participantAId" = sender_profile_id
          AND c."participantBId" = recipient_profile_id
          AND (sender_actor_id IS NULL OR (public.giq_actor_belongs_to_profile(sender_actor_id, sender_profile_id)
            AND (c."participantAActorId" IS NULL OR c."participantAActorId" = sender_actor_id)))
          AND (recipient_actor_id IS NULL OR (public.giq_actor_belongs_to_profile(recipient_actor_id, recipient_profile_id)
            AND (c."participantBActorId" IS NULL OR c."participantBActorId" = recipient_actor_id))))
        OR
        (c."participantBId" = sender_profile_id
          AND c."participantAId" = recipient_profile_id
          AND (sender_actor_id IS NULL OR (public.giq_actor_belongs_to_profile(sender_actor_id, sender_profile_id)
            AND (c."participantBActorId" IS NULL OR c."participantBActorId" = sender_actor_id)))
          AND (recipient_actor_id IS NULL OR (public.giq_actor_belongs_to_profile(recipient_actor_id, recipient_profile_id)
            AND (c."participantAActorId" IS NULL OR c."participantAActorId" = recipient_actor_id))))
      )
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.giq_message_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF public.giq_is_system() OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
    AND NEW."senderId" = public.giq_current_profile_id()
    AND public.giq_is_conversation_participant(NEW."conversationId")
    AND public.giq_message_actor_pair_valid(
      NEW."conversationId", NEW."senderId", NEW."senderActorId",
      NEW."recipientId", NEW."recipientActorId"
    ) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
    AND public.giq_current_profile_id() IN (NEW."senderId", NEW."recipientId")
    AND OLD."conversationId" IS NOT DISTINCT FROM NEW."conversationId"
    AND OLD."senderId" = NEW."senderId"
    AND OLD."recipientId" = NEW."recipientId"
    AND OLD."senderActorId" IS NOT DISTINCT FROM NEW."senderActorId"
    AND OLD."recipientActorId" IS NOT DISTINCT FROM NEW."recipientActorId"
    AND OLD.body IS NOT DISTINCT FROM NEW.body
    AND OLD."mediaIdsJson" IS NOT DISTINCT FROM NEW."mediaIdsJson"
    AND OLD."createdAt" IS NOT DISTINCT FROM NEW."createdAt" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'auth.forbidden' USING ERRCODE = '42501';
END;
$$;

DROP POLICY IF EXISTS giq_conversation_insert ON "Conversation";
CREATE POLICY giq_conversation_insert ON "Conversation" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR (
    public.giq_current_profile_id() IN ("participantAId", "participantBId")
    AND public.giq_conversation_actor_pair_valid(
      "participantAId", "participantAActorId", "participantBId", "participantBActorId"
    )
    AND public.giq_conversation_actor_can_start(
      "participantAId", "participantAActorId", "participantBId", "participantBActorId"
    )
  )
);
DROP POLICY IF EXISTS giq_conversation_update ON "Conversation";
CREATE POLICY giq_conversation_update ON "Conversation" FOR UPDATE USING (
  public.giq_is_system() OR public.giq_is_moderator()
  OR public.giq_current_profile_id() IN ("participantAId", "participantBId")
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR (
    public.giq_current_profile_id() IN ("participantAId", "participantBId")
    AND public.giq_conversation_actor_pair_valid(
      "participantAId", "participantAActorId", "participantBId", "participantBActorId"
    )
  )
);

DROP POLICY IF EXISTS giq_message_insert ON "Message";
CREATE POLICY giq_message_insert ON "Message" FOR INSERT WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator() OR (
    "senderId" = public.giq_current_profile_id()
    AND public.giq_message_actor_pair_valid(
      "conversationId", "senderId", "senderActorId", "recipientId", "recipientActorId"
    )
  )
);

CREATE OR REPLACE FUNCTION public.giq_is_profile_in_conversation(
  conversation_id text,
  profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."Conversation" conversation
    WHERE conversation.id = conversation_id
      AND profile_id IN (conversation."participantAId", conversation."participantBId")
  ), false);
$$;

DROP POLICY IF EXISTS giq_conversation_participant_write ON "ConversationParticipant";
CREATE POLICY giq_conversation_participant_write ON "ConversationParticipant" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
  OR (
    public.giq_is_conversation_participant("conversationId")
    AND public.giq_is_profile_in_conversation("conversationId", "profileId")
  )
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
  OR (
    public.giq_is_conversation_participant("conversationId")
    AND public.giq_is_profile_in_conversation("conversationId", "profileId")
    AND public.giq_actor_belongs_to_profile("actorId", "profileId")
  )
);

CREATE OR REPLACE FUNCTION public.giq_reject_page_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."conversationId" IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public."Conversation" c
    JOIN public."SocialActor" a
      ON a.id IN (c."participantAActorId", c."participantBActorId")
    WHERE c.id = NEW."conversationId" AND a.kind = 'page'
  ) THEN
    RAISE EXCEPTION 'call.page_actor_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER giq_call_room_person_only
BEFORE INSERT OR UPDATE OF "conversationId" ON "CallRoom"
FOR EACH ROW EXECUTE FUNCTION public.giq_reject_page_call();

REVOKE ALL ON FUNCTION public.giq_current_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_owned(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_connected(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_visible(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_social_actor_identity_valid(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_can_act(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_media_owned_by_actor(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_audience_rank(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_feed_post_visible(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_accountable(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_feed_actor_consistent(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_feed_actor_can_publish(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_belongs_to_profile(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_conversation_actor_pair_valid(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_conversation_actor_can_start(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_message_actor_pair_valid(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_is_profile_in_conversation(text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "SocialActor", "ActorFollow", "ActorTopicFollow", "ActorMute", "ActorGalleryMedia", "SavedFeedPost", "FeedMention", "FeedShare" TO greyhoundiq_runtime;
    GRANT EXECUTE ON FUNCTION public.giq_current_actor_id(), public.giq_actor_owned(text), public.giq_actor_connected(text), public.giq_actor_visible(text), public.giq_social_actor_identity_valid(text, text, text, text), public.giq_actor_can_act(text), public.giq_media_owned_by_actor(text, text), public.giq_audience_rank(text), public.giq_feed_post_visible(text), public.giq_actor_accountable(text, text), public.giq_feed_actor_consistent(text, text, text), public.giq_feed_actor_can_publish(text), public.giq_actor_belongs_to_profile(text, text), public.giq_conversation_actor_pair_valid(text, text, text, text), public.giq_conversation_actor_can_start(text, text, text, text), public.giq_message_actor_pair_valid(text, text, text, text, text), public.giq_is_profile_in_conversation(text, text) TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "SocialActor", "ActorFollow", "ActorTopicFollow", "ActorMute", "ActorGalleryMedia", "SavedFeedPost", "FeedMention", "FeedShare" TO greyhoundiq_app;
    GRANT EXECUTE ON FUNCTION public.giq_current_actor_id(), public.giq_actor_owned(text), public.giq_actor_connected(text), public.giq_actor_visible(text), public.giq_social_actor_identity_valid(text, text, text, text), public.giq_actor_can_act(text), public.giq_media_owned_by_actor(text, text), public.giq_audience_rank(text), public.giq_feed_post_visible(text), public.giq_actor_accountable(text, text), public.giq_feed_actor_consistent(text, text, text), public.giq_feed_actor_can_publish(text), public.giq_actor_belongs_to_profile(text, text), public.giq_conversation_actor_pair_valid(text, text, text, text), public.giq_conversation_actor_can_start(text, text, text, text), public.giq_message_actor_pair_valid(text, text, text, text, text), public.giq_is_profile_in_conversation(text, text) TO greyhoundiq_app;
  END IF;
END;
$$;
