-- FeedPost and SocialActor both FORCE row-level security. Their SELECT policies
-- called SECURITY DEFINER helpers that queried the same table, so AlloyDB roles
-- without BYPASSRLS recursively re-entered the policy until max_stack_depth.
-- Keep the same viewer boundaries row-local; child-table policies may continue
-- using the helpers without re-entering an own-table helper policy.

DROP POLICY IF EXISTS giq_social_actor_select ON "SocialActor";
CREATE POLICY giq_social_actor_select ON "SocialActor" FOR SELECT USING (
  (
    kind <> 'personal'
    OR EXISTS (
      SELECT 1
      FROM "Profile" profile
      JOIN "User" account ON account.id = profile."userId"
      WHERE profile.id = "profileId"
        AND account."isBanned" = false
        AND account."deletionRequestedAt" IS NULL
    )
  )
  AND (
    public.giq_is_system()
    OR public.giq_is_moderator()
    OR "ownerProfileId" = public.giq_current_profile_id()
    OR (
      NOT public.giq_profiles_blocked(
        public.giq_current_profile_id(),
        "ownerProfileId"
      )
      AND published
      AND CASE "profileVisibility"
        WHEN 'public' THEN true
        WHEN 'members' THEN public.giq_current_profile_id() IS NOT NULL
        WHEN 'connections' THEN public.giq_actor_connected(id)
        ELSE false
      END
    )
  )
);

DROP POLICY IF EXISTS giq_feed_post_select ON "FeedPost";
CREATE POLICY giq_feed_post_select ON "FeedPost" FOR SELECT USING (
  "deletedAt" IS NULL
  AND (
    public.giq_is_system()
    OR public.giq_is_moderator()
    OR "authorProfileId" = public.giq_current_profile_id()
    OR (
      status = 'active'
      AND (
        "authorActorId" IS NULL
        OR EXISTS (
          SELECT 1
          FROM "SocialActor" actor
          WHERE actor.id = "authorActorId"
            AND actor.published
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "UserBlock" block
        WHERE (
          block."blockerProfileId" = public.giq_current_profile_id()
          AND block."blockedProfileId" = "authorProfileId"
        ) OR (
          block."blockedProfileId" = public.giq_current_profile_id()
          AND block."blockerProfileId" = "authorProfileId"
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "ActorMute" mute
        WHERE mute."muterActorId" = public.giq_current_actor_id()
          AND mute."mutedActorId" = "authorActorId"
      )
      AND CASE visibility
        WHEN 'public' THEN true
        WHEN 'members' THEN public.giq_current_profile_id() IS NOT NULL
        WHEN 'connections' THEN (
          public.giq_actor_connected("authorActorId")
          OR (
            "authorActorId" IS NULL
            AND EXISTS (
              SELECT 1
              FROM "Friendship" friendship
              WHERE friendship.status = 'accepted'
                AND (
                  (
                    friendship."profileAId" = public.giq_current_profile_id()
                    AND friendship."profileBId" = "authorProfileId"
                  ) OR (
                    friendship."profileBId" = public.giq_current_profile_id()
                    AND friendship."profileAId" = "authorProfileId"
                  )
                )
            )
          )
        )
        WHEN 'only_me' THEN "authorProfileId" = public.giq_current_profile_id()
        ELSE false
      END
    )
  )
);
