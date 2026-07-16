-- Replace the transitional one-conversation-per-human-pair constraint with an
-- actor-scoped key. Existing and legacy-revision inserts receive personal
-- actors before the authorization trigger runs, so the new key remains total.

CREATE OR REPLACE FUNCTION public.giq_conversation_default_personal_actors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."participantAActorId" IS NULL THEN
    SELECT actor.id INTO NEW."participantAActorId"
    FROM public."SocialActor" actor
    WHERE actor."profileId" = NEW."participantAId"
      AND actor.kind = 'personal';
  END IF;
  IF NEW."participantBActorId" IS NULL THEN
    SELECT actor.id INTO NEW."participantBActorId"
    FROM public."SocialActor" actor
    WHERE actor."profileId" = NEW."participantBId"
      AND actor.kind = 'personal';
  END IF;
  IF NEW."participantAActorId" IS NULL OR NEW."participantBActorId" IS NULL THEN
    RAISE EXCEPTION 'conversation.personal_actor_missing' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS giq_conversation_actor_defaults ON "Conversation";
CREATE TRIGGER giq_conversation_actor_defaults
BEFORE INSERT ON "Conversation"
FOR EACH ROW EXECUTE FUNCTION public.giq_conversation_default_personal_actors();

ALTER TABLE "Conversation" DISABLE TRIGGER giq_conversation_pro_write;
UPDATE "Conversation" conversation
SET "participantAActorId" = COALESCE(conversation."participantAActorId", actor_a.id),
    "participantBActorId" = COALESCE(conversation."participantBActorId", actor_b.id)
FROM "SocialActor" actor_a, "SocialActor" actor_b
WHERE actor_a."profileId" = conversation."participantAId"
  AND actor_a.kind = 'personal'
  AND actor_b."profileId" = conversation."participantBId"
  AND actor_b.kind = 'personal'
  AND (
    conversation."participantAActorId" IS NULL
    OR conversation."participantBActorId" IS NULL
  );
ALTER TABLE "Conversation" ENABLE TRIGGER giq_conversation_pro_write;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Conversation"
    WHERE "participantAActorId" IS NULL OR "participantBActorId" IS NULL
  ) THEN
    RAISE EXCEPTION 'conversation.personal_actor_backfill_incomplete';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "Conversation_profile_actor_pair_key"
ON "Conversation"(
  "participantAId",
  "participantBId",
  "participantAActorId",
  "participantBActorId"
);

-- Reviewed non-data-destructive contraction: the replacement unique index is
-- already populated and validated above. Production enables multiplexing only
-- after old Cloud Run revisions retire.
DROP INDEX "Conversation_participantAId_participantBId_key";

REVOKE ALL ON FUNCTION public.giq_conversation_default_personal_actors() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_conversation_default_personal_actors()
      TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_conversation_default_personal_actors()
      TO greyhoundiq_app;
  END IF;
END;
$$;
