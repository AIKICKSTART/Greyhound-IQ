-- Block relationships apply to actor/profile discovery in both directions.
CREATE OR REPLACE FUNCTION public.giq_profiles_blocked(
  profile_a_id text,
  profile_b_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public."UserBlock" block
    WHERE (block."blockerProfileId" = profile_a_id AND block."blockedProfileId" = profile_b_id)
       OR (block."blockedProfileId" = profile_a_id AND block."blockerProfileId" = profile_b_id)
  ), false);
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
    FROM public."SocialActor" actor
    WHERE actor.id = actor_id
      AND NOT public.giq_profiles_blocked(
        public.giq_current_profile_id(),
        actor."ownerProfileId"
      )
      AND (
        (actor.kind = 'personal' AND EXISTS (
          SELECT 1
          FROM public."Friendship" friendship
          WHERE friendship.status = 'accepted'
            AND (
              (friendship."profileAId" = public.giq_current_profile_id() AND friendship."profileBId" = actor."profileId")
              OR (friendship."profileBId" = public.giq_current_profile_id() AND friendship."profileAId" = actor."profileId")
            )
        ))
        OR (actor.kind = 'page' AND EXISTS (
          SELECT 1
          FROM public."ActorFollow" follow
          WHERE follow."followerActorId" = public.giq_current_actor_id()
            AND follow."followedActorId" = actor.id
        ))
      )
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.giq_actor_visible(actor_id text)
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
      AND (
        public.giq_is_system()
        OR public.giq_is_moderator()
        OR actor."ownerProfileId" = public.giq_current_profile_id()
        OR (
          NOT public.giq_profiles_blocked(
            public.giq_current_profile_id(),
            actor."ownerProfileId"
          )
          AND actor.published
          AND (
            actor."profileVisibility" = 'public'
            OR (actor."profileVisibility" = 'members' AND public.giq_current_profile_id() IS NOT NULL)
            OR (actor."profileVisibility" = 'connections' AND public.giq_actor_connected(actor.id))
          )
        )
      )
  ), false);
$$;

-- Empty-search-path trigger functions must not call legacy helpers that resolve
-- unqualified tables through the caller's search path.
CREATE OR REPLACE FUNCTION public.giq_is_conversation_participant(conversation_id text)
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
      AND public.giq_current_profile_id() IN (
        conversation."participantAId",
        conversation."participantBId"
      )
  ), false);
$$;

REVOKE ALL ON FUNCTION public.giq_profiles_blocked(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_connected(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_actor_visible(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_is_conversation_participant(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_profiles_blocked(text, text), public.giq_actor_connected(text), public.giq_actor_visible(text), public.giq_is_conversation_participant(text) TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_profiles_blocked(text, text), public.giq_actor_connected(text), public.giq_actor_visible(text), public.giq_is_conversation_participant(text) TO greyhoundiq_app;
  END IF;
END;
$$;

-- Direct database clients receive a safe projection instead of base tables
-- containing private contact fields. Server runtime roles retain base access so
-- the previous Cloud Run revision remains forward compatible during rollout.
CREATE VIEW public.giq_public_social_actor_profiles
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
  actor."updatedAt"
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

REVOKE ALL ON public.giq_public_social_actor_profiles FROM PUBLIC;
REVOKE SELECT ON public."CustomPage", public."Profile" FROM PUBLIC;
REVOKE SELECT ("contactEmail", "contactPhone", website) ON public."CustomPage" FROM PUBLIC;
REVOKE SELECT (phone, website) ON public."Profile" FROM PUBLIC;

DO $$
DECLARE direct_role text;
BEGIN
  FOREACH direct_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = direct_role) THEN
      EXECUTE format(
        'REVOKE SELECT ON public."CustomPage", public."Profile" FROM %I',
        direct_role
      );
      EXECUTE format(
        'REVOKE SELECT ("contactEmail", "contactPhone", website) ON public."CustomPage" FROM %I',
        direct_role
      );
      EXECUTE format(
        'REVOKE SELECT (phone, website) ON public."Profile" FROM %I',
        direct_role
      );
      EXECUTE format(
        'GRANT SELECT ON public.giq_public_social_actor_profiles TO %I',
        direct_role
      );
    END IF;
  END LOOP;
END;
$$;
