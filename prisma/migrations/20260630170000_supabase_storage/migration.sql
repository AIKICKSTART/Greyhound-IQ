-- GreyhoundIQ Supabase Storage setup.
-- Buckets are access-model boundaries; per-user isolation lives in object paths.

ALTER TABLE "MediaAsset" ADD COLUMN "publicUrl" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'file';
ALTER TABLE "MediaAsset" ADD COLUMN "linkedEntityType" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "linkedEntityId" TEXT;

UPDATE "MediaAsset"
SET "mediaType" = CASE
  WHEN "mimeType" LIKE 'image/%' THEN 'image'
  WHEN "mimeType" LIKE 'video/%' THEN 'video'
  WHEN "mimeType" LIKE 'audio/%' THEN 'audio'
  WHEN "mimeType" = 'application/pdf' THEN 'document'
  ELSE 'file'
END;

CREATE INDEX "MediaAsset_storageBucket_createdAt_idx" ON "MediaAsset"("storageBucket", "createdAt");
CREATE INDEX "MediaAsset_linkedEntityType_linkedEntityId_idx" ON "MediaAsset"("linkedEntityType", "linkedEntityId");

DO $giq_storage$
BEGIN
  IF to_regclass('storage.buckets') IS NULL
    OR to_regclass('storage.objects') IS NULL
    OR to_regprocedure('auth.jwt()') IS NULL
    OR to_regprocedure('storage.foldername(text)') IS NULL
    OR to_regrole('authenticated') IS NULL
  THEN
    RAISE NOTICE 'Skipping Supabase Storage bucket and RLS setup because Supabase storage/auth objects are unavailable.';
    RETURN;
  END IF;

  EXECUTE $sql$
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'site-assets',
    'site-assets',
    true,
    200 * 1024 * 1024,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm'
    ]::text[]
  ),
  (
    'public-user-media',
    'public-user-media',
    true,
    200 * 1024 * 1024,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]::text[]
  ),
  (
    'private-user-media',
    'private-user-media',
    false,
    200 * 1024 * 1024,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mp4',
      'audio/webm',
      'audio/ogg',
      'application/pdf'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.giq_jwt_claim(claim_name text)
RETURNS text
LANGUAGE sql
STABLE
AS $fn$
  SELECT NULLIF(auth.jwt() ->> claim_name, '');
$fn$;

CREATE OR REPLACE FUNCTION public.giq_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT u.id
  FROM public."User" u
  WHERE u."supabaseUid" = public.giq_jwt_claim('sub')
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
  WHERE u."supabaseUid" = public.giq_jwt_claim('sub')
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.giq_is_storage_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(public.giq_current_profile_role() IN ('admin', 'moderator'), false)
    OR COALESCE(public.giq_jwt_claim('user_role') IN ('admin', 'moderator'), false);
$fn$;

CREATE OR REPLACE FUNCTION public.giq_storage_folder(object_name text, folder_index int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT (storage.foldername(object_name))[folder_index];
$fn$;

CREATE OR REPLACE FUNCTION public.giq_is_owned_user_storage_path(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  SELECT public.giq_storage_folder(object_name, 1) = 'users'
    AND public.giq_storage_folder(object_name, 2) = public.giq_current_user_id();
$fn$;

CREATE OR REPLACE FUNCTION public.giq_is_user_media_path(
  object_name text,
  allowed_sections text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  SELECT public.giq_is_owned_user_storage_path(object_name)
    AND public.giq_storage_folder(object_name, 3) = ANY(allowed_sections);
$fn$;

DROP POLICY IF EXISTS "GreyhoundIQ public read site assets" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ public read public user media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ private read own media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ upload site assets as admin" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ upload public user media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ upload private user media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ update site assets as admin" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ update own public user media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ update own private user media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ delete site assets as admin" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ delete own public user media" ON storage.objects;
DROP POLICY IF EXISTS "GreyhoundIQ delete own private user media" ON storage.objects;

CREATE POLICY "GreyhoundIQ public read site assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'site-assets');

CREATE POLICY "GreyhoundIQ public read public user media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public-user-media');

CREATE POLICY "GreyhoundIQ private read own media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
);

CREATE POLICY "GreyhoundIQ upload site assets as admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-assets'
  AND public.giq_storage_folder(name, 1) = 'site'
  AND public.giq_is_storage_admin()
);

CREATE POLICY "GreyhoundIQ upload public user media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public-user-media'
  AND public.giq_is_user_media_path(
    name,
    ARRAY['avatars', 'dogs', 'listings', 'forum', 'agent-outputs']::text[]
  )
);

CREATE POLICY "GreyhoundIQ upload private user media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'private-user-media'
  AND public.giq_is_user_media_path(
    name,
    ARRAY['messages', 'verification', 'uploads', 'videos']::text[]
  )
);

CREATE POLICY "GreyhoundIQ update site assets as admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'site-assets' AND public.giq_is_storage_admin())
WITH CHECK (
  bucket_id = 'site-assets'
  AND public.giq_storage_folder(name, 1) = 'site'
  AND public.giq_is_storage_admin()
);

CREATE POLICY "GreyhoundIQ update own public user media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
)
WITH CHECK (
  bucket_id = 'public-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
);

CREATE POLICY "GreyhoundIQ update own private user media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'private-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
)
WITH CHECK (
  bucket_id = 'private-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
);

CREATE POLICY "GreyhoundIQ delete site assets as admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'site-assets' AND public.giq_is_storage_admin());

CREATE POLICY "GreyhoundIQ delete own public user media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
);

CREATE POLICY "GreyhoundIQ delete own private user media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'private-user-media'
  AND (
    public.giq_is_owned_user_storage_path(name)
    OR public.giq_is_storage_admin()
  )
);
$sql$;
END;
$giq_storage$;
