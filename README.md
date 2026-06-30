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

## CI/CD

GitHub Actions:

- `CI`: docs, audit, env gate, Prisma validation/migration/seed on disposable Postgres, typecheck, lint, build, production server boot, smoke tests.
- `Vercel Preview`: deploys PR previews and comments the URL.
- `Vercel Main`: deploys the stable temporary Vercel URL after `main` passes CI.
- `Codex PR Review`: runs Codex as an automated reviewer.
- `Supabase Migrate`: manual staging/production migration workflow.

`Live Racing Sync` calls `/api/internal/live-sync?days=1` every 5 minutes from GitHub Actions. Vercel Cron is configured as a daily backup because the current Vercel Hobby plan does not allow sub-daily cron schedules. Without `TOPAZ_API_KEY`, the app can use a bounded public FastTrack prototype fallback for pre-production demos; the fallback caps at `FASTTRACK_MAX_MEETINGS=2` by default so each scheduled run stays inside the Vercel function limit. Real production ingestion requires the licensed `TOPAZ_API_KEY` in Vercel.

Feed readiness is exposed at `/api/health/feeds`. It reports configured providers, scheduler coverage, upcoming race counts, and missing feed credentials without exposing secret values.

Marketplace listing cards use optimized demo WebP media while `NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA` is enabled. Turn that flag off when real listing uploads should be the only displayed media.

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
