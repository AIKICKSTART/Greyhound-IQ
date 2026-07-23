\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  role_state record;
BEGIN
  IF current_database()<>'giq_production_candidate_20260716_r1' THEN
    RAISE EXCEPTION 'candidate runtime-grant database mismatch';
  END IF;
  IF (SELECT phase FROM _giq_history_merge.run WHERE id=1)<>'verified' THEN
    RAISE EXCEPTION 'candidate runtime grants require verified phase';
  END IF;
  SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
  INTO STRICT role_state FROM pg_roles WHERE rolname='greyhoundiq_runtime';
  IF NOT role_state.rolcanlogin OR role_state.rolsuper OR role_state.rolcreatedb
     OR role_state.rolcreaterole OR role_state.rolreplication OR role_state.rolbypassrls THEN
    RAISE EXCEPTION 'greyhoundiq_runtime attributes exceed the approved boundary';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE giq_production_candidate_20260716_r1 TO greyhoundiq_runtime;
REVOKE TEMPORARY ON DATABASE giq_production_candidate_20260716_r1 FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE giq_production_candidate_20260716_r1 FROM greyhoundiq_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM greyhoundiq_runtime;
GRANT USAGE ON SCHEMA public TO greyhoundiq_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO greyhoundiq_runtime;
REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM greyhoundiq_runtime;

DO $$
DECLARE relation_name text;
BEGIN
  FOR relation_name IN
    SELECT format('%I.%I',n.nspname,c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m')
  LOOP
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON TABLE %s FROM greyhoundiq_runtime',relation_name);
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM greyhoundiq_runtime;
GRANT USAGE ON SEQUENCE public."AuditLog_id_seq" TO greyhoundiq_runtime;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM greyhoundiq_runtime;

DO $$
DECLARE
  allowed text[]:=ARRAY[
    'giq_actor_accountable(actor_id text, accountable_profile_id text)',
    'giq_actor_belongs_to_profile(actor_id text, profile_id text)',
    'giq_actor_can_act(actor_id text)','giq_actor_connected(actor_id text)',
    'giq_actor_owned(actor_id text)','giq_actor_visible(actor_id text)',
    'giq_audience_rank(audience text)',
    'giq_call_room_current_profile_can_join(room_id text)',
    'giq_call_room_current_profile_has_access(room_id text)',
    'giq_call_room_current_profile_is_creator(room_id text)',
    'giq_call_room_profile_is_conversation_participant(room_id text, profile_id text)',
    'giq_can_publish_feed_as(target_profile_id text, target_page_id text)',
    'giq_claim(name text)',
    'giq_conversation_actor_can_start(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
    'giq_conversation_actor_pair_valid(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
    'giq_conversation_default_personal_actors()','giq_conversation_write_guard()',
    'giq_current_actor_id()','giq_current_profile_id()','giq_current_role()',
    'giq_current_tier()','giq_current_user_id()','giq_enforce_profile_marketing_tier()',
    'giq_feed_actor_can_publish(actor_id text)',
    'giq_feed_actor_consistent(actor_id text, accountable_profile_id text, page_id text)',
    'giq_feed_post_visible(post_id text)','giq_feed_post_write_guard()',
    'giq_is_admin()','giq_is_conversation_participant(conversation_id text)',
    'giq_is_moderator()','giq_is_pro()',
    'giq_is_profile_in_conversation(conversation_id text, profile_id text)',
    'giq_is_system()','giq_media_owned_by_actor(actor_id text, media_id text)',
    'giq_message_actor_pair_valid(conversation_id text, sender_profile_id text, sender_actor_id text, recipient_profile_id text, recipient_actor_id text)',
    'giq_message_write_guard()','giq_org_current_user_is_member(org_id text)',
    'giq_org_current_user_is_owner(org_id text)','giq_personal_feed_write_guard()',
    'giq_profiles_blocked(profile_a_id text, profile_b_id text)',
    'giq_refresh_aggregate_matview(requested_name text)','giq_reject_page_call()',
    'giq_require_pro_write()','giq_social_actor_identity_guard()',
    'giq_social_actor_identity_valid(actor_kind text, profile_id text, page_id text, owner_profile_id text)'
  ];
  routine record;
  found integer;
BEGIN
  FOR routine IN
    SELECT p.oid,p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS identity
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'giq\_%' ESCAPE '\'
  LOOP
    IF routine.identity=ANY(allowed) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO greyhoundiq_runtime',routine.oid::regprocedure);
    END IF;
  END LOOP;
  SELECT count(*) INTO found
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')=ANY(allowed);
  IF found<>cardinality(allowed) THEN
    RAISE EXCEPTION 'candidate routine allowlist expected %, found %',cardinality(allowed),found;
  END IF;
END
$$;

DO $$
DECLARE
  dml_count integer;
  view_count integer;
  sequence_count integer;
  routine_count integer;
  unexpected_routine_count integer;
  migration_access boolean;
BEGIN
  SELECT count(*) INTO dml_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations'
    AND has_table_privilege('greyhoundiq_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE');
  SELECT has_table_privilege('greyhoundiq_runtime','public."_prisma_migrations"','SELECT,INSERT,UPDATE,DELETE')
    INTO migration_access;
  SELECT count(*) INTO view_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('v','m')
    AND has_table_privilege('greyhoundiq_runtime',c.oid,'SELECT');
  SELECT count(*) INTO sequence_count FROM information_schema.usage_privileges
  WHERE grantee='greyhoundiq_runtime' AND object_schema='public'
    AND object_type='SEQUENCE' AND privilege_type='USAGE';
  SELECT count(*) INTO routine_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND has_function_privilege('greyhoundiq_runtime',p.oid,'EXECUTE');
  SELECT count(*) INTO unexpected_routine_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND has_function_privilege('greyhoundiq_runtime',p.oid,'EXECUTE')
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')<>ALL(ARRAY[
      'giq_actor_accountable(actor_id text, accountable_profile_id text)',
      'giq_actor_belongs_to_profile(actor_id text, profile_id text)',
      'giq_actor_can_act(actor_id text)','giq_actor_connected(actor_id text)',
      'giq_actor_owned(actor_id text)','giq_actor_visible(actor_id text)',
      'giq_audience_rank(audience text)','giq_call_room_current_profile_can_join(room_id text)',
      'giq_call_room_current_profile_has_access(room_id text)',
      'giq_call_room_current_profile_is_creator(room_id text)',
      'giq_call_room_profile_is_conversation_participant(room_id text, profile_id text)',
      'giq_can_publish_feed_as(target_profile_id text, target_page_id text)','giq_claim(name text)',
      'giq_conversation_actor_can_start(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
      'giq_conversation_actor_pair_valid(profile_a_id text, actor_a_id text, profile_b_id text, actor_b_id text)',
      'giq_conversation_default_personal_actors()','giq_conversation_write_guard()',
      'giq_current_actor_id()','giq_current_profile_id()','giq_current_role()',
      'giq_current_tier()','giq_current_user_id()','giq_enforce_profile_marketing_tier()',
      'giq_feed_actor_can_publish(actor_id text)',
      'giq_feed_actor_consistent(actor_id text, accountable_profile_id text, page_id text)',
      'giq_feed_post_visible(post_id text)','giq_feed_post_write_guard()',
      'giq_is_admin()','giq_is_conversation_participant(conversation_id text)',
      'giq_is_moderator()','giq_is_pro()',
      'giq_is_profile_in_conversation(conversation_id text, profile_id text)',
      'giq_is_system()','giq_media_owned_by_actor(actor_id text, media_id text)',
      'giq_message_actor_pair_valid(conversation_id text, sender_profile_id text, sender_actor_id text, recipient_profile_id text, recipient_actor_id text)',
      'giq_message_write_guard()','giq_org_current_user_is_member(org_id text)',
      'giq_org_current_user_is_owner(org_id text)','giq_personal_feed_write_guard()',
      'giq_profiles_blocked(profile_a_id text, profile_b_id text)',
      'giq_refresh_aggregate_matview(requested_name text)','giq_reject_page_call()',
      'giq_require_pro_write()','giq_social_actor_identity_guard()',
      'giq_social_actor_identity_valid(actor_kind text, profile_id text, page_id text, owner_profile_id text)'
    ]::text[]);
  IF dml_count<>111 OR migration_access OR view_count<>6 OR sequence_count<>1
     OR routine_count<>45 OR unexpected_routine_count<>0 THEN
    RAISE EXCEPTION 'candidate runtime grant mismatch dml=% migration=% views=% sequences=% routines=% unexpected_routines=%',
      dml_count,migration_access,view_count,sequence_count,routine_count,unexpected_routine_count;
  END IF;
END
$$;

UPDATE _giq_history_merge.run
SET runtime_grants_verified_at=clock_timestamp(),
    runtime_grants_manifest=jsonb_build_object(
      'role','greyhoundiq_runtime','superuser',false,'bypassRls',false,
      'applicationDmlTables',111,'migrationAccess',false,'projectionReads',6,
      'sequenceUsage',1,'routineExecute',45,'restrictedLoginSmoke',false
    )
WHERE id=1;

COMMIT;
