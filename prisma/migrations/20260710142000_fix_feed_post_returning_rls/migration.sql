-- Prisma creates FeedPost rows with INSERT ... RETURNING. The visibility helper
-- re-queries FeedPost and cannot see the proposed row in the same SQL command,
-- so keep the stored-row helper while making equivalent owner/privileged checks
-- row-local for RETURNING. Preserve the existing soft-delete boundary.
ALTER POLICY giq_feed_post_select
ON public."FeedPost"
USING (
  "deletedAt" IS NULL
  AND (
    public.giq_is_system()
    OR public.giq_is_moderator()
    OR "authorProfileId" = public.giq_current_profile_id()
    OR public.giq_feed_post_visible(id)
  )
);
