ALTER TABLE "User" RENAME COLUMN "supabaseUid" TO "workosUserId";
ALTER INDEX IF EXISTS "User_supabaseUid_key" RENAME TO "User_workosUserId_key";

DO $giq_workos_user_id$
BEGIN
  IF to_regclass('public."User"') IS NULL
    OR to_regclass('public."Profile"') IS NULL
    OR to_regprocedure('auth.jwt()') IS NULL
  THEN
    RAISE NOTICE 'Skipping GreyhoundIQ storage RLS helper refresh because required auth/profile objects are unavailable.';
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE OR REPLACE FUNCTION public.giq_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT u.id
  FROM public."User" u
  WHERE u."workosUserId" = public.giq_jwt_claim('sub')
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.giq_current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p.role
  FROM public."Profile" p
  JOIN public."User" u ON u.id = p."userId"
  WHERE u."workosUserId" = public.giq_jwt_claim('sub')
  LIMIT 1;
$fn$;
$sql$;
END;
$giq_workos_user_id$;
