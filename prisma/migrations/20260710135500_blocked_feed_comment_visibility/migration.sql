-- Lazy comment reads run in viewer context; enforce block relationships in RLS
-- so nested replies and every future reader inherit the same privacy boundary.
DROP POLICY IF EXISTS giq_feed_comment_select ON "FeedComment";
CREATE POLICY giq_feed_comment_select ON "FeedComment" FOR SELECT USING (
  "deletedAt" IS NULL
  AND (
    public.giq_is_moderator()
    OR "authorProfileId" = public.giq_current_profile_id()
    OR (
      status = 'active'
      AND public.giq_feed_post_visible("postId")
      AND NOT EXISTS (
        SELECT 1
        FROM "UserBlock" block
        WHERE (block."blockerProfileId" = public.giq_current_profile_id() AND block."blockedProfileId" = "authorProfileId")
           OR (block."blockedProfileId" = public.giq_current_profile_id() AND block."blockerProfileId" = "authorProfileId")
      )
    )
  )
);
