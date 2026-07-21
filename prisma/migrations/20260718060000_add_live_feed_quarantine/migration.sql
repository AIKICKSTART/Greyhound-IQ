-- Private append-only occurrences rejected by live-feed canonical ingestion.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "LiveFeedQuarantine" (
  "id" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "provider" TEXT NOT NULL,
  "entityKind" TEXT NOT NULL,
  "sourceId" TEXT,
  "naturalIdentity" TEXT,
  "reasonCode" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL,
  "evidenceJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveFeedQuarantine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveFeedQuarantine_id_check" CHECK (
    "id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT "LiveFeedQuarantine_observedAt_check" CHECK (
    "observedAt" >= TIMESTAMP '2000-01-01 00:00:00'
    AND "observedAt" <= CURRENT_TIMESTAMP + INTERVAL '2 days'
  ),
  CONSTRAINT "LiveFeedQuarantine_provider_check" CHECK (
    "provider" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  ),
  CONSTRAINT "LiveFeedQuarantine_entityKind_check" CHECK (
    "entityKind" ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  CONSTRAINT "LiveFeedQuarantine_sourceId_check" CHECK (
    "sourceId" IS NULL OR char_length(btrim("sourceId")) BETWEEN 1 AND 256
  ),
  CONSTRAINT "LiveFeedQuarantine_naturalIdentity_check" CHECK (
    "naturalIdentity" IS NULL
    OR char_length(btrim("naturalIdentity")) BETWEEN 1 AND 512
  ),
  CONSTRAINT "LiveFeedQuarantine_reasonCode_check" CHECK (
    "reasonCode" ~ '^[a-z][a-z0-9._-]{0,99}$'
  ),
  CONSTRAINT "LiveFeedQuarantine_classification_check" CHECK (
    "classification" IN ('invalid', 'incomplete', 'conflict')
  ),
  CONSTRAINT "LiveFeedQuarantine_evidenceSha256_check" CHECK (
    "evidenceSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "LiveFeedQuarantine_evidenceJson_size_check" CHECK (
    octet_length("evidenceJson") BETWEEN 2 AND 16384
  ),
  CONSTRAINT "LiveFeedQuarantine_evidenceJson_object_check" CHECK (
    jsonb_typeof("evidenceJson"::jsonb) = 'object'
  )
);

CREATE INDEX "LiveFeedQuarantine_classification_createdAt_idx"
  ON "LiveFeedQuarantine"("classification", "createdAt");
CREATE INDEX "LiveFeedQuarantine_provider_entityKind_observedAt_idx"
  ON "LiveFeedQuarantine"("provider", "entityKind", "observedAt");
CREATE INDEX "LiveFeedQuarantine_evidenceSha256_idx"
  ON "LiveFeedQuarantine"("evidenceSha256");

CREATE OR REPLACE FUNCTION public.giq_guard_live_feed_quarantine()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'live feed quarantine occurrences are append-only';
END;
$$;

REVOKE ALL ON FUNCTION public.giq_guard_live_feed_quarantine() FROM PUBLIC;

CREATE TRIGGER giq_live_feed_quarantine_append_only
  BEFORE UPDATE OR DELETE ON "LiveFeedQuarantine"
  FOR EACH ROW EXECUTE FUNCTION public.giq_guard_live_feed_quarantine();

ALTER TABLE "LiveFeedQuarantine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveFeedQuarantine" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_live_feed_quarantine_admin_read
  ON "LiveFeedQuarantine" FOR SELECT
  USING (public.giq_is_admin());
CREATE POLICY giq_live_feed_quarantine_system_insert
  ON "LiveFeedQuarantine" FOR INSERT
  WITH CHECK (public.giq_is_system());

REVOKE ALL ON TABLE "LiveFeedQuarantine" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT ON "LiveFeedQuarantine" TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT SELECT, INSERT ON "LiveFeedQuarantine" TO greyhoundiq_app;
  END IF;
END
$$;

COMMIT;
