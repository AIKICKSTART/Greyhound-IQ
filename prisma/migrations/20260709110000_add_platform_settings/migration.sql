-- Admin-editable platform flags (relax custom-page / listing fraud gates, etc.).
-- Forward-only. RLS: readable under system context (server reads flags), writes
-- restricted to moderators/system.

CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedByProfileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "PlatformSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSetting" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_platform_setting_select ON "PlatformSetting" FOR SELECT USING (
  public.giq_is_system() OR public.giq_is_moderator()
);
CREATE POLICY giq_platform_setting_write ON "PlatformSetting" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformSetting" TO greyhoundiq_runtime;
  END IF;
END;
$$;
