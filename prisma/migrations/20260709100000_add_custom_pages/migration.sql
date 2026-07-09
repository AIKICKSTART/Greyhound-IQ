-- Custom user pages: trainer / punter / business / dog marketing.
-- Forward-only. Mirrors the RLS idiom from 20260708190000_add_rls_remaining_tables.

CREATE TABLE "CustomPage" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "businessCategory" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "accentColor" TEXT,
    "heroMediaId" TEXT,
    "dogId" TEXT,
    "saleStatus" TEXT,
    "priceOrFee" DOUBLE PRECISION,
    "contentJson" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" TEXT NOT NULL DEFAULT 'approved',
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomPage_handle_key" ON "CustomPage"("handle");
CREATE INDEX "CustomPage_handle_idx" ON "CustomPage"("handle");
CREATE INDEX "CustomPage_pageType_published_idx" ON "CustomPage"("pageType", "published");
CREATE INDEX "CustomPage_dogId_idx" ON "CustomPage"("dogId");
CREATE UNIQUE INDEX "CustomPage_ownerProfileId_pageType_dogId_key" ON "CustomPage"("ownerProfileId", "pageType", "dogId");

ALTER TABLE "CustomPage" ADD CONSTRAINT "CustomPage_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomPage" ADD CONSTRAINT "CustomPage_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === RLS ===
-- Public sees only published, non-removed pages. Owner sees own at any state.
-- Writes are owner / moderator / system only.
ALTER TABLE "CustomPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomPage" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_custom_page_select ON "CustomPage" FOR SELECT USING (
  ("published" = true AND "moderationStatus" <> 'removed')
  OR public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerProfileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_custom_page_insert ON "CustomPage" FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerProfileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_custom_page_update ON "CustomPage" FOR UPDATE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerProfileId" = public.giq_current_profile_id()
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerProfileId" = public.giq_current_profile_id()
);

CREATE POLICY giq_custom_page_delete ON "CustomPage" FOR DELETE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "ownerProfileId" = public.giq_current_profile_id()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "CustomPage" TO greyhoundiq_runtime;
  END IF;
END;
$$;
