CREATE TABLE "RealtimeTopicGrant" (
  topic TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  extension TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RealtimeTopicGrant_pkey" PRIMARY KEY (topic, "profileId", extension),
  CONSTRAINT "RealtimeTopicGrant_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT giq_realtime_grant_extension_check
    CHECK (extension IN ('broadcast', 'presence'))
);

CREATE INDEX "RealtimeTopicGrant_profileId_expiresAt_idx"
  ON "RealtimeTopicGrant"("profileId", "expiresAt");
CREATE INDEX "RealtimeTopicGrant_expiresAt_idx"
  ON "RealtimeTopicGrant"("expiresAt");

ALTER TABLE "RealtimeTopicGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RealtimeTopicGrant" FORCE ROW LEVEL SECURITY;
CREATE POLICY giq_realtime_topic_grant_system
  ON "RealtimeTopicGrant" FOR ALL
  USING (public.giq_is_system())
  WITH CHECK (public.giq_is_system());

CREATE OR REPLACE FUNCTION public.giq_realtime_profile_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims text;
BEGIN
  claims := current_setting('request.jwt.claims', true);
  IF claims IS NULL OR claims = '' THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF((claims::jsonb ->> 'profile_id'), '');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.giq_realtime_topic_allowed(
  requested_topic text,
  requested_extension text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT requested_extension IN ('broadcast', 'presence')
    AND EXISTS (
      SELECT 1
      FROM public."RealtimeTopicGrant" g
      WHERE g.topic = requested_topic
        AND g."profileId" = public.giq_realtime_profile_id()
        AND g.extension = requested_extension
        AND g."expiresAt" > CURRENT_TIMESTAMP
    );
$$;

REVOKE ALL ON FUNCTION public.giq_realtime_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.giq_realtime_topic_allowed(text, text) FROM PUBLIC;

-- Generic/local Postgres does not necessarily install the Supabase realtime
-- schema. Supabase environments receive the private Broadcast/Presence
-- policies; local application migrations remain portable.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS giq_private_topic_receive ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS giq_private_topic_send ON realtime.messages';
    EXECUTE $policy$
      CREATE POLICY giq_private_topic_receive
      ON realtime.messages FOR SELECT
      TO authenticated
      USING (
        extension IN ('broadcast', 'presence')
        AND public.giq_realtime_topic_allowed(
          (SELECT realtime.topic()),
          extension
        )
      )
    $policy$;
    EXECUTE $policy$
      CREATE POLICY giq_private_topic_send
      ON realtime.messages FOR INSERT
      TO authenticated
      WITH CHECK (
        extension IN ('broadcast', 'presence')
        AND public.giq_realtime_topic_allowed(
          (SELECT realtime.topic()),
          extension
        )
      )
    $policy$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.giq_realtime_profile_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.giq_realtime_topic_allowed(text, text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "RealtimeTopicGrant" TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "RealtimeTopicGrant" TO greyhoundiq_app;
  END IF;
END;
$$;
