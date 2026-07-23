-- Custom page management is a Pro/Pro+ entitlement at the database boundary.
-- Published, non-removed pages remain publicly readable; private owner access
-- and every owner mutation require giq_is_pro(). Moderator/system access stays.

DROP POLICY IF EXISTS giq_custom_page_select ON "CustomPage";
DROP POLICY IF EXISTS giq_custom_page_insert ON "CustomPage";
DROP POLICY IF EXISTS giq_custom_page_update ON "CustomPage";
DROP POLICY IF EXISTS giq_custom_page_delete ON "CustomPage";

CREATE POLICY giq_custom_page_select ON "CustomPage" FOR SELECT USING (
  ("published" = true AND "moderationStatus" <> 'removed')
  OR public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "ownerProfileId" = public.giq_current_profile_id()
  )
);

CREATE POLICY giq_custom_page_insert ON "CustomPage" FOR INSERT WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "ownerProfileId" = public.giq_current_profile_id()
  )
);

CREATE POLICY giq_custom_page_update ON "CustomPage" FOR UPDATE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "ownerProfileId" = public.giq_current_profile_id()
  )
) WITH CHECK (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "ownerProfileId" = public.giq_current_profile_id()
  )
);

CREATE POLICY giq_custom_page_delete ON "CustomPage" FOR DELETE USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR (
    public.giq_is_pro()
    AND "ownerProfileId" = public.giq_current_profile_id()
  )
);
