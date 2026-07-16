-- Free members may write as their personal profile. Managed-page publishing
-- remains Pro-only and is bound to the page owner at the database boundary.

DROP TRIGGER IF EXISTS giq_feed_post_pro_write ON "FeedPost";
DROP TRIGGER IF EXISTS giq_feed_comment_pro_write ON "FeedComment";
DROP TRIGGER IF EXISTS giq_feed_reaction_pro_write ON "FeedReaction";

CREATE OR REPLACE FUNCTION public.giq_can_publish_feed_as(
  target_profile_id text,
  target_page_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_profile_id = public.giq_current_profile_id()
    AND (
      target_page_id IS NULL
      OR (
        public.giq_is_pro()
        AND EXISTS (
          SELECT 1
          FROM "CustomPage" page
          WHERE page.id = target_page_id
            AND page."ownerProfileId" = public.giq_current_profile_id()
            AND page."moderationStatus" <> 'removed'
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.giq_feed_post_write_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."authorPageId" IS NULL OR public.giq_is_moderator() THEN
    RETURN NEW;
  END IF;

  IF NOT public.giq_is_pro() THEN
    RAISE EXCEPTION 'payment.required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.giq_can_publish_feed_as(
    NEW."authorProfileId",
    NEW."authorPageId"
  ) THEN
    RAISE EXCEPTION 'feed.page_not_owned' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.giq_personal_feed_write_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Keep the historical trigger names so migration replacement checks remain
-- deterministic; they no longer call giq_require_pro_write().
CREATE TRIGGER giq_feed_post_pro_write
BEFORE INSERT OR UPDATE ON "FeedPost"
FOR EACH ROW EXECUTE FUNCTION public.giq_feed_post_write_guard();

CREATE TRIGGER giq_feed_comment_pro_write
BEFORE INSERT OR UPDATE ON "FeedComment"
FOR EACH ROW EXECUTE FUNCTION public.giq_personal_feed_write_guard();

CREATE TRIGGER giq_feed_reaction_pro_write
BEFORE INSERT OR UPDATE ON "FeedReaction"
FOR EACH ROW EXECUTE FUNCTION public.giq_personal_feed_write_guard();

DROP POLICY IF EXISTS giq_feed_post_insert ON "FeedPost";
DROP POLICY IF EXISTS giq_feed_post_update ON "FeedPost";
DROP POLICY IF EXISTS giq_feed_post_media_write ON "FeedPostMedia";
DROP POLICY IF EXISTS giq_feed_comment_insert ON "FeedComment";
DROP POLICY IF EXISTS giq_feed_comment_update ON "FeedComment";
DROP POLICY IF EXISTS giq_feed_reaction_insert ON "FeedReaction";
DROP POLICY IF EXISTS giq_feed_reaction_delete ON "FeedReaction";

CREATE POLICY giq_feed_post_insert ON "FeedPost" FOR INSERT WITH CHECK (
  public.giq_is_moderator()
  OR public.giq_can_publish_feed_as("authorProfileId", "authorPageId")
);

CREATE POLICY giq_feed_post_update ON "FeedPost" FOR UPDATE USING (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR public.giq_can_publish_feed_as("authorProfileId", "authorPageId")
);

CREATE POLICY giq_feed_post_media_write ON "FeedPostMedia" FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM "FeedPost" post
    WHERE post.id = "postId"
      AND (
        public.giq_is_moderator()
        OR public.giq_can_publish_feed_as(
          post."authorProfileId",
          post."authorPageId"
        )
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "FeedPost" post
    WHERE post.id = "postId"
      AND (
        public.giq_is_moderator()
        OR public.giq_can_publish_feed_as(
          post."authorProfileId",
          post."authorPageId"
        )
      )
  )
);

CREATE POLICY giq_feed_comment_insert ON "FeedComment" FOR INSERT WITH CHECK (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_feed_comment_update ON "FeedComment" FOR UPDATE USING (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_feed_reaction_insert ON "FeedReaction" FOR INSERT WITH CHECK (
  public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_feed_reaction_delete ON "FeedReaction" FOR DELETE USING (
  public.giq_is_moderator()
  OR "profileId" = public.giq_current_profile_id()
);
