# Environment Variables

Use `.env.example` as the contract. Real values live in the AI Kick Start VPS/runtime secret store and GitHub Actions secrets.

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
- `LAGO_API_URL`
- `LAGO_FRONT_URL`
- `LAGO_API_KEY`
- `LAGO_WEBHOOK_SECRET`
- `INTERNAL_API_SECRET`
- `CRON_SECRET`

## Optional live racing variables

- `TOPAZ_API_KEY`
- `TOPAZ_API_BASE`
- `TOPAZ_OWNING_AUTHORITY_CODE`
- `TOPAZ_TIME_ZONE`
- `THEDOGS_PROVIDER_ENABLED` (defaults to `true` for all-Australia racecard coverage)
- `THEDOGS_BASE_URL`
- `THEDOGS_MAX_MEETINGS`
- `THEDOGS_CONCURRENCY`
- `THEDOGS_TIME_ZONE`
- `THEDOGS_BACKFILL_FROM` (defaults to `2006-08-01` for the historical backfill command)
- `FASTTRACK_PROTOTYPE_ENABLED` (defaults to `true` in `.env.example` for demo race data)
- `FASTTRACK_BASE_URL`
- `FASTTRACK_MAX_MEETINGS` (defaults to `1` for the high-frequency fallback sync)
- `NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA`
- `NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT`

`CRON_SECRET` secures scheduled internal sync calls to `/api/internal/live-sync`. `INTERNAL_API_SECRET` remains available for manual internal maintenance calls with the `X-Internal-Secret` header.

`/api/health/feeds` reports whether live feed credentials are configured without returning secret values.

`NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA` controls pre-launch marketplace mock imagery. Keep it enabled while listings need demo media, then set it to `false` for live-only listing uploads.

`NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT` controls the signed-out account preview used for demos. Real signed-in account data still comes from WorkOS plus the local user/profile tables.

## Lago app integration

- `LAGO_API_URL` is the Lago API base URL used by server-side billing and metering integration code.
- `LAGO_FRONT_URL` is the Lago frontend URL used for customer/admin billing flows.
- `LAGO_API_KEY` is server-only and must be stored in the VPS/runtime secret store or GitHub Actions secrets.
- `LAGO_WEBHOOK_SECRET` is server-only and must be at least 32 characters in production.

`npm run check:env -- --production` requires all four Lago variables for production. Do not add payment-provider variables here unless the app integration actually requires them.

Supabase Storage browser uploads require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-side signed upload/download operations require `SUPABASE_SERVICE_ROLE_KEY`; keep it server-only in the VPS/runtime environment and GitHub secrets.

## CI/CD secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `OPENAI_API_KEY`
- `PROD_INTERNAL_API_SECRET`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

Never commit `.env` or any real secret value.
