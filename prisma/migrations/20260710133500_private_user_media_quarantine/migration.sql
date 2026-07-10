-- User uploads are delivered only through server-issued signed URLs or the
-- authenticated media route. Legacy public-user-media objects remain in place,
-- but both user-media buckets are private and direct client policies are denied.

DO $giq_private_user_media$
BEGIN
  IF to_regclass('storage.buckets') IS NULL
    OR to_regclass('storage.objects') IS NULL
  THEN
    RAISE NOTICE 'Skipping user-media storage hardening because Supabase Storage is unavailable.';
    RETURN;
  END IF;

  UPDATE storage.buckets
  SET public = false
  WHERE id IN ('public-user-media', 'private-user-media')
    AND public IS DISTINCT FROM false;

  EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ public read public user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ private read own media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ upload public user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ upload private user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ update own public user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ update own private user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ delete own public user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ delete own private user media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "deny anon reads of private media" ON storage.objects';

  IF to_regrole('anon') IS NOT NULL AND to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ deny direct user media select" ON storage.objects';
    EXECUTE 'CREATE POLICY "GreyhoundIQ deny direct user media select" ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (bucket_id NOT IN (''public-user-media'', ''private-user-media''))';

    EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ deny direct user media insert" ON storage.objects';
    EXECUTE 'CREATE POLICY "GreyhoundIQ deny direct user media insert" ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id NOT IN (''public-user-media'', ''private-user-media''))';

    EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ deny direct user media update" ON storage.objects';
    EXECUTE 'CREATE POLICY "GreyhoundIQ deny direct user media update" ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id NOT IN (''public-user-media'', ''private-user-media'')) WITH CHECK (bucket_id NOT IN (''public-user-media'', ''private-user-media''))';

    EXECUTE 'DROP POLICY IF EXISTS "GreyhoundIQ deny direct user media delete" ON storage.objects';
    EXECUTE 'CREATE POLICY "GreyhoundIQ deny direct user media delete" ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id NOT IN (''public-user-media'', ''private-user-media''))';
  END IF;
END
$giq_private_user_media$;
