# Environment Variables

Use `.env.example` as the contract. Real values live in Google Secret Manager, Cloud Run runtime configuration, and GitHub Actions secrets.

## Database Source Of Truth

`DATABASE_URL` is the single application database source of truth and must point
at the self-hosted Supabase Postgres database. App reads and writes go through
Prisma in `src/lib/db.ts`. Production startup refuses managed Supabase
database hosts for `DATABASE_URL`; use the self-hosted Postgres endpoint. The
runtime does not use Supabase REST/PostgREST as a second application database.

`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are for Supabase API services such as Storage and
Realtime. They are not a second application database.

`DATABASE_IMPORT_URL` is optional and exists only for bulk archive/import jobs.
It must point at the same self-hosted database with an import-scoped role.
`LOCAL_DATABASE_URL` is only used by `npm run db:local:*` commands and must not
be used by production runtime services.

`DIRECT_URL` is optional for the web runtime and reserved for Prisma CLI
migration/introspection work. When present, `prisma.config.ts` uses it for CLI
operations; it must target the same self-hosted database with a migration-scoped
role.

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
- `WORKOS_COOKIE_DOMAIN`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `LAGO_API_URL`
- `LAGO_FRONT_URL`
- `LAGO_API_KEY`
- `LAGO_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_APP_URL`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `INTERNAL_API_SECRET`
- `CRON_SECRET`

## Optional app security variables

- `REALTIME_CHANNEL_SECRET`

## Optional media scanner variables

- `MEDIA_SCAN_MODE` (`disabled`, `metadata`, or `clamav`)
- `MEDIA_CLAMSCAN_BIN`
- `MEDIA_CLAMAV_DATABASE`
- `MEDIA_CLAMSCAN_TIMEOUT_MS`

## Optional notification delivery variables

- `NOTIFICATION_WEBHOOK_URL`
- `NOTIFICATION_WEBHOOK_SECRET`
- `NOTIFICATION_DELIVERY_MAX_ATTEMPTS`

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

`REALTIME_CHANNEL_SECRET` can be set as a dedicated HMAC secret for opaque Supabase Realtime message/profile channel names. If it is not set, the app falls back to `INTERNAL_API_SECRET`, then `AUTH_SECRET`, then `NEXTAUTH_SECRET`.

`MEDIA_SCAN_MODE=disabled` leaves pending media blocked from attach/download in production. `MEDIA_SCAN_MODE=metadata` only verifies object metadata and is suitable for local/staging smoke checks, not antivirus scanning. `MEDIA_SCAN_MODE=clamav` runs `clamscan` and marks pending media `clean`, `infected`, or `error`; use it on a dedicated scanner service/job with enough memory rather than the default 1Gi web service. `MEDIA_CLAMSCAN_BIN`, `MEDIA_CLAMAV_DATABASE`, and `MEDIA_CLAMSCAN_TIMEOUT_MS` override the binary path, database path, and scan timeout.

`NOTIFICATION_WEBHOOK_URL` enables background delivery for persisted in-app notifications through `/api/internal/notification-delivery`. Leave it unset for in-app-only notifications. `NOTIFICATION_WEBHOOK_SECRET` is sent as `X-Notification-Secret` to the webhook target. `NOTIFICATION_DELIVERY_MAX_ATTEMPTS` caps retry attempts before operator review.

`/api/health/feeds` reports whether live feed credentials are configured without returning secret values.

`NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA` controls pre-launch marketplace mock imagery. Keep it enabled while listings need demo media, then set it to `false` for live-only listing uploads.

`NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT` controls the signed-out account preview used for demos. Real signed-in account data still comes from WorkOS plus the local user/profile tables.

`npm run check:env -- --production` fails if `FASTTRACK_PROTOTYPE_ENABLED`,
`NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA`, or
`NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT` is set to `true`. These flags are local/demo
conveniences only and are not production persistence or feed layers.

## Lago app integration

- `LAGO_API_URL` is the Lago API base URL used by server-side billing and metering integration code.
- `LAGO_FRONT_URL` is the Lago frontend URL used for customer/admin billing flows.
- `LAGO_API_KEY` is server-only and must be stored in the VPS/runtime secret store or GitHub Actions secrets.
- `LAGO_WEBHOOK_SECRET` is server-only and must be at least 32 characters in production.

`npm run check:env -- --production` requires all four Lago variables for production.

## Stripe app integration

- `STRIPE_SECRET_KEY` is server-only and must use the live-mode key in production.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must match the same Stripe mode as the server key.
- `STRIPE_WEBHOOK_SECRET` must come from the Stripe Dashboard webhook for `https://greyhoundsiq.com.au/api/webhooks/stripe`.
- `STRIPE_APP_URL` must be `https://greyhoundsiq.com.au` in production.
- `STRIPE_PRICE_PRO_MONTHLY` must be the live-mode recurring price ID for the `$29/month` Pro plan.
- `STRIPE_PRICE_PRO_YEARLY` must be the live-mode recurring price ID for the `$278.40/year` Pro plan.

`npm run check:env -- --production` requires the Stripe variables above for production. Store production values in Google Secret Manager, not repo files.

Supabase Storage browser uploads require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-side signed upload/download operations require `SUPABASE_SERVICE_ROLE_KEY`; keep it server-only in the VPS/runtime environment and GitHub secrets.

## CI/CD secrets

- `GCP_PROJECT_ID`
- `GCP_WIF_PROVIDER`
- `GCP_BUILD_SERVICE_ACCOUNT`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_RUNTIME_SERVICE_ACCOUNT`
- `OPENAI_API_KEY`
- `PROD_INTERNAL_API_SECRET`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

Never commit `.env` or any real secret value.
