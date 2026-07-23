-- Fix: owners could not soft-delete (or otherwise remove) their own feed posts.
-- The giq_feed_post_update WITH CHECK required publish entitlement
-- (giq_can_publish_feed_as) AND actor consistency (giq_feed_actor_consistent).
-- A soft-delete sets status='removed' + deletedAt, which does not need publish
-- rights, so DELETE /api/feed/[postId] failed with Postgres 42501
-- ("new row violates row-level security policy for table FeedPost") -> HTTP 500.
--
-- This adds an explicit owner-soft-delete allowance to the WITH CHECK while
-- preserving the existing edit semantics (edits still require publish rights +
-- actor consistency). The USING clause is unchanged (owner or moderator).
-- Forward-only, non-destructive: replaces one policy definition.

DROP POLICY IF EXISTS giq_feed_post_update ON "FeedPost";
CREATE POLICY giq_feed_post_update ON "FeedPost" FOR UPDATE USING (
  public.giq_is_moderator()
  OR "authorProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_moderator()
  OR (
    public.giq_can_publish_feed_as("authorProfileId", "authorPageId")
    AND public.giq_feed_actor_consistent("authorActorId", "authorProfileId", "authorPageId")
  )
  OR (
    -- Owner removing their own post (soft-delete): only ownership is required,
    -- not publish entitlement. Scoped to rows the owner is marking deleted.
    "deletedAt" IS NOT NULL
    AND "authorProfileId" = public.giq_current_profile_id()
  )
);
