<p align="center">
  <img src="public/images/og-image.webp" alt="GreyhoundIQ - Australian Greyhound Racing Intelligence" width="100%">
</p>

# GreyhoundIQ

GreyhoundIQ is an AI Kick Start platform for Australian greyhound racing intelligence: race cards, dog profiles, track data, breeding analytics, marketplace listings, community features, and agent-assisted workflows.

Current delivery model:

- **App:** Next.js 16 App Router
- **Database:** Supabase Postgres via Prisma
- **Auth/runtime integrations:** WorkOS, Supabase, internal maintenance APIs
- **Deployments:** Vercel preview/temp URLs
- **Review gates:** GitHub Actions, Codex PR review, human approval

## Quick start

```bash
git clone https://github.com/AIKICKSTART/Greyhound-IQ.git
cd Greyhound-IQ
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

Fill `.env` from the team secret store. Do not commit real secrets.

## Local development

Useful commands:

```bash
npm run dev              # local Next.js dev server
npm run typecheck        # TypeScript gate
npm run lint             # ESLint gate
npm run build            # production build
npm run docs:check       # README/wiki/docs gate
npm run ci               # local CI approximation
```

Database commands:

```bash
npm run db:migrate       # apply Prisma migrations
npm run db:seed          # seed demo data
npm run db:reset         # reset local database
```

## Environment

Copy `.env.example` to `.env`. Required production-class values include:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET` or `AUTH_SECRET`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `INTERNAL_API_SECRET`
- `CRON_SECRET`

Supabase values are required for Supabase-backed runtime features:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Supabase Storage uses `site-assets`, `public-user-media`, and `private-user-media` buckets. After migrations, run `npm run storage:upload-site-assets` to upload public website media into the `site-assets` bucket.

Pre-launch demo boundary:

- Racing, listings, dogs, tracks, statistics, and breeding pages read the live database/query layer.
- `Live Racing Sync` keeps demo race data fresh from the configured provider.
- `NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA=true` keeps listing cards and detail pages media-rich with local WebP fallbacks when real uploads are missing.
- `NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT=true` shows a signed-out demo account preview without replacing real WorkOS account flows.

## CI/CD

GitHub Actions:

- `CI`: docs, audit, env gate, Prisma validation/migration/seed on disposable Postgres, typecheck, lint, build, production server boot, smoke tests.
- `Vercel Preview`: deploys PR previews and comments the URL.
- `Vercel Main`: deploys the stable temporary Vercel URL after `main` passes CI.
- `Codex PR Review`: runs Codex as an automated reviewer.
- `Supabase Migrate`: manual staging/production migration workflow.

`Live Racing Sync` calls `/api/internal/live-sync` from GitHub Actions. The fast schedule refreshes the current national racecards and posted results every 5 minutes with `days=1&scope=all`; the full schedule refreshes the 7-day national racecard horizon hourly with `days=7&scope=upcoming`. Vercel Cron is configured as a daily full-horizon backup because the current Vercel Hobby plan does not allow sub-daily cron schedules. Manual operator sync can run `npm run sync:live`. `THEDOGS_PROVIDER_ENABLED=true` enables the public all-Australia racecard and result feed for national field coverage. Topaz remains the licensed production feed where available, and the bounded FastTrack prototype fallback can keep demo race data flowing if the all-Australia feed is disabled.

Feed readiness is exposed at `/api/health/feeds`. It reports configured providers, scheduler coverage, upcoming race counts, and missing feed credentials without exposing secret values.

Run `npm run audit:live-race-coverage -- 7` after a sync to compare the database against the live all-Australia racecard feed. Run `npm run audit:live-result-coverage -- 1` to compare posted results against the national results feed. The audits exit non-zero while any expected live venue/date/racecard or result row is missing or stale.

Historical archive backfill uses the public The Dogs racing archive (`/racing?date=YYYY-MM-DD`). Probing confirmed useful national meeting/race coverage from `2006-08-01`; older dates return partial legacy pages and are not the default floor. The shipped frontend bundle does not expose a public unauthenticated racing JSON API, so this backfill uses public HTML pages and stores normalized rows plus source metadata.

```bash
npm run backfill:thedogs -- --date 2025-06-30
npm run backfill:thedogs -- --from 2025-01-01 --to 2025-01-31 --max-days 7
npm run backfill:thedogs -- --from 2006-08-01 --to 2006-12-31 --full
npm run backfill:thedogs -- --from 2006-08-01 --to 2026-06-30 --full --continue-on-error --max-errors 500
npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 3
npm run backfill:thedogs:shards -- start --from auto --to 2026-06-30 --workers 12 --provider-concurrency 1 --pause-ms 1000
npm run backfill:thedogs:shards -- status
npm run backfill:thedogs:shards -- stop
```

Backfill progress is written to `.backfill/thedogs-history-progress.jsonl`, which is ignored by git. Successful dates are skipped on the next run unless `--no-resume` is passed. Use `--continue-on-error` for full archive runs so an isolated malformed legacy page is logged and the job continues. For the full multi-year archive, prefer the shard launcher: it splits the remaining date range across non-overlapping local workers, writes one progress file per shard, and keeps a `.backfill/thedogs-shards-manifest.json` status/stop manifest. When using high shard counts, set `--provider-concurrency 1` so each worker fetches politely. The current Supabase session pool rejected 20 simultaneous workers with `EMAXCONNSESSION`; use 12 workers unless the database pool is increased.

Marketplace listing cards and details use optimized demo WebP media while `NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA` is enabled. Turn that flag off when real listing uploads should be the only displayed media.

Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `OPENAI_API_KEY`
- `PROD_INTERNAL_API_SECRET`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

## Vercel

The active deployment path is Vercel + Supabase:

- PR previews use Supabase staging.
- The temporary `main` Vercel URL uses Supabase staging until launch.
- Production domain launch switches Vercel production env vars to Supabase production.

See [docs/deployment-vercel.md](docs/deployment-vercel.md).

## GitHub workflow

`main` is protected after setup. Work locally on a branch:

```bash
git checkout main
git pull
git checkout -b feature/my-change
```

Open a PR and wait for CI, Codex review, Vercel preview, and human approval.

## Documentation

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Vercel deployment](docs/deployment-vercel.md)
- [Wiki source mirror](docs/wiki/Home.md)
- [Planning docs](docs/planning/README.md)

## Responsible use

GreyhoundIQ is a racing intelligence and community platform. It does not place bets, accept wagers, or provide guaranteed outcomes. Users must comply with local laws and responsible gambling guidance.
