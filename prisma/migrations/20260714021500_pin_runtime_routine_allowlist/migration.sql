-- Freeze the reviewed application-routine surface for the server runtime.
-- Existing PUBLIC grants remain where direct Supabase roles rely on them, but
-- future routines no longer receive implicit PUBLIC EXECUTE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  allowed_routines text[] := ARRAY[
    'giq_actor_accountable(actor_id text, accountable_profile_id text)',
    'giq_actor_belongs_to_profile(actor_id text, profile_id text)',
    'giq_actor_can_act(actor_id text)',
    'giq_actor_connected(actor_id text)',
    'giq_actor_owned(actor_id text)',
    'giq_actor_visible(actor_id text)',
    'giq_audience_rank(audience text)',
    'giq_call_room_current_profile_can_join(room_id text)',
    'giq_call_room_current_profile_has_access(room_id text)',
    'giq_call_room_current_profile_is_creator(room_id text)',
    'giq_call_room_profile_is_conversation_participant(room_id text, profile_id text)',
    'giq_can_publish_feed_as(target_profile_id text, target_page_id text)',
    'giq_claim(name text)',
    'giq_conversation_actor_can_start(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
    'giq_conversation_actor_pair_valid(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
    'giq_conversation_default_personal_actors()',
    'giq_conversation_write_guard()',
    'giq_current_actor_id()',
    'giq_current_profile_id()',
    'giq_current_role()',
    'giq_current_tier()',
    'giq_current_user_id()',
    'giq_enforce_profile_marketing_tier()',
    'giq_feed_actor_can_publish(actor_id text)',
    'giq_feed_actor_consistent(actor_id text, accountable_profile_id text, page_id text)',
    'giq_feed_post_visible(post_id text)',
    'giq_feed_post_write_guard()',
    'giq_is_conversation_participant(conversation_id text)',
    'giq_is_moderator()',
    'giq_is_pro()',
    'giq_is_profile_in_conversation(conversation_id text, profile_id text)',
    'giq_is_system()',
    'giq_media_owned_by_actor(actor_id text, media_id text)',
    'giq_message_actor_pair_valid(conversation_id text, sender_profile_id text, sender_actor_id text, recipient_profile_id text, recipient_actor_id text)',
    'giq_message_write_guard()',
    'giq_org_current_user_is_member(org_id text)',
    'giq_org_current_user_is_owner(org_id text)',
    'giq_personal_feed_write_guard()',
    'giq_profiles_blocked(profile_a_id text, profile_b_id text)',
    'giq_refresh_aggregate_matview(requested_name text)',
    'giq_reject_page_call()',
    'giq_require_pro_write()',
    'giq_social_actor_identity_guard()',
    'giq_social_actor_identity_valid(actor_kind text, profile_id text, page_id text, owner_profile_id text)'
  ];
  routine record;
  found_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    FOR routine IN
      SELECT function.oid,
        function.proname || '(' || pg_get_function_identity_arguments(function.oid) || ')' AS identity
      FROM pg_proc AS function
      JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
      WHERE namespace.nspname = 'public'
        AND function.proname LIKE 'giq\_%' ESCAPE '\'
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM greyhoundiq_runtime',
        routine.oid::regprocedure
      );
      IF routine.identity = ANY (allowed_routines) THEN
        EXECUTE format(
          'GRANT EXECUTE ON FUNCTION %s TO greyhoundiq_runtime',
          routine.oid::regprocedure
        );
      END IF;
    END LOOP;

    SELECT COUNT(*)::integer
    INTO found_count
    FROM pg_proc AS function
    JOIN pg_namespace AS namespace ON namespace.oid = function.pronamespace
    WHERE namespace.nspname = 'public'
      AND (
        function.proname || '(' ||
        pg_get_function_identity_arguments(function.oid) || ')'
      ) = ANY (allowed_routines);

    IF found_count <> cardinality(allowed_routines) THEN
      RAISE EXCEPTION
        'Runtime routine allowlist expected % functions but found %',
        cardinality(allowed_routines),
        found_count;
    END IF;
  END IF;
END
$$;
