# Environment Variables

Use `.env.example` as the contract. Real values live in the team secret store, Vercel environment variables, and GitHub Actions secrets.

## Runtime variables

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `INTERNAL_API_SECRET`
- `CRON_SECRET`

## Optional live racing variables

- `TOPAZ_API_KEY`
- `TOPAZ_API_BASE`
- `TOPAZ_OWNING_AUTHORITY_CODE`
- `TOPAZ_TIME_ZONE`
- `FASTTRACK_PROTOTYPE_ENABLED`
- `FASTTRACK_BASE_URL`
- `FASTTRACK_MAX_MEETINGS`
- `NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA`

`CRON_SECRET` secures Vercel Cron calls to `/api/internal/live-sync`. `INTERNAL_API_SECRET` remains available for manual internal maintenance calls with the `X-Internal-Secret` header.

`/api/health/feeds` reports whether live feed credentials are configured without returning secret values.

`NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA` controls pre-launch marketplace mock imagery. Keep it enabled while listings need demo media, then set it to `false` for live-only listing uploads.

Supabase Storage browser uploads require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-side signed upload/download operations require `SUPABASE_SERVICE_ROLE_KEY`; keep it server-only in Vercel and GitHub secrets.

## CI/CD secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `OPENAI_API_KEY`
- `PROD_INTERNAL_API_SECRET`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

Never commit `.env` or any real secret value.
