# Supabase Setup

Use two Supabase projects:

- `greyhoundiq-staging` for PR previews and the temporary Vercel URL.
- `greyhoundiq-prod` for launch.

## Database

The app uses Prisma with PostgreSQL:

```bash
npx prisma validate
npx prisma migrate deploy
```

Use `npm run db:seed` only for local or staging data.

## Storage

GreyhoundIQ uses Supabase Storage buckets and object paths:

- `site-assets`: public bucket for logos, website images, marketing graphics, article images, Open Graph images, and static UI media.
- `public-user-media`: public-read bucket for profile images, dog photos, marketplace listing images/videos, and forum media intended to be public.
- `private-user-media`: private bucket for message attachments, verification files, owner/breeder/trainer uploads, and private videos.

User isolation is path-based, not one bucket per user. Server-generated object paths start with the app user id:

```text
users/{user_id}/avatars/{entity_or_pending}/{file_name}
users/{user_id}/dogs/{dog_id_or_pending}/{file_name}
users/{user_id}/listings/{listing_id_or_pending}/{file_name}
users/{user_id}/forum/{thread_id_or_pending}/{file_name}
users/{user_id}/messages/{thread_id_or_pending}/{file_name}
site/{section}/{file_name}
```

The Prisma migration `20260630170000_supabase_storage` creates the buckets, expands the `MediaAsset` metadata table, and installs RLS policies on `storage.objects` for public reads, private authenticated reads, owner-only upload/update/delete, and admin/moderator override.

After applying migrations in staging or production, upload site assets:

```bash
npm run storage:upload-site-assets
```

The app generates public URLs for public buckets and signed URLs for private media. Do not store signed URLs permanently; `MediaAsset.storageBucket` and `MediaAsset.storagePath` are the source of truth.

## Auth

If WorkOS is the active auth provider, configure Supabase Third-Party Auth for WorkOS in each Supabase project. The WorkOS JWT template must set the Supabase role claim to authenticated:

```json
{
  "role": "authenticated",
  "user_role": {{organization_membership.role}}
}
```

GreyhoundIQ maps the WorkOS subject to `User.supabaseUid`. Storage RLS policies resolve that app user id and allow users to write only under their own `users/{user_id}/...` object paths unless their GreyhoundIQ profile role or WorkOS `user_role` is `admin` or `moderator`.

## Environment

Set these in Vercel Preview and Production:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Migrations

Use the GitHub Actions **Supabase Migrate** workflow for staging and production migrations. Production migrations should be run manually and reviewed before execution.
