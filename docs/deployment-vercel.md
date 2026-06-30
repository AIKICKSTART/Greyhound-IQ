# GreyhoundIQ Vercel + Supabase Deployment

This is the current deployment path for the GitHub-hosted project.

## Environments

| Environment          | Purpose                                                  | Database            |
| -------------------- | -------------------------------------------------------- | ------------------- |
| Pull request preview | Review every PR on a unique Vercel URL                   | Supabase staging    |
| Main temp URL        | Stable Vercel project URL for current pre-launch testing | Supabase staging    |
| Production launch    | Future custom domain deployment                          | Supabase production |

For now, Vercel production env values may point to Supabase staging so the stable Vercel URL is safe for pre-launch testing. Switch those values to Supabase production only when launching the production domain.

## Required GitHub secrets

| Secret                 | Used by                   | Notes                                      |
| ---------------------- | ------------------------- | ------------------------------------------ |
| `VERCEL_TOKEN`         | Vercel workflows          | Create in Vercel dashboard. Do not commit. |
| `VERCEL_ORG_ID`        | Vercel workflows          | From `.vercel/project.json` after linking. |
| `VERCEL_PROJECT_ID`    | Vercel workflows          | From `.vercel/project.json` after linking. |
| `OPENAI_API_KEY`       | Codex PR review           | Required for `openai/codex-action@v1`.     |
| `PROD_INTERNAL_API_SECRET` | Live sync workflow    | Same value as production `INTERNAL_API_SECRET`. |
| `STAGING_DATABASE_URL` | Manual migration workflow | Supabase staging direct connection.        |
| `PROD_DATABASE_URL`    | Manual migration workflow | Supabase production direct connection.     |

## Required Vercel env vars

Set these in Vercel Preview and Production environments:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `INTERNAL_API_SECRET`
- `CRON_SECRET`

Optional:

- `TOPAZ_API_KEY`
- `TOPAZ_API_BASE`
- `TOPAZ_OWNING_AUTHORITY_CODE`
- `TOPAZ_TIME_ZONE`
- `FASTTRACK_PROTOTYPE_ENABLED`
- `FASTTRACK_BASE_URL`
- `FASTTRACK_MAX_MEETINGS`

## Scheduled live data sync

`Live Racing Sync` calls `/api/internal/live-sync` every 5 minutes from GitHub Actions. `vercel.json` also configures Vercel Cron to call the same route once daily as a backup because the current Vercel Hobby plan does not allow sub-daily cron schedules. The route accepts either:

- `Authorization: Bearer <CRON_SECRET>` from Vercel Cron.
- `X-Internal-Secret: <INTERNAL_API_SECRET>` for manual operator runs.

Without `TOPAZ_API_KEY`, the job can use the bounded FastTrack prototype fallback for pre-production demos. Set `FASTTRACK_PROTOTYPE_ENABLED=false` to force a no-op until the licensed Topaz key is configured. Once the licensed Topaz key is present, each run refreshes meetings, races, runners, scratchings, prices, and recent results through the official provider.

Use `/api/health/feeds` on the deployed app to verify feed readiness. A `waiting_for_credentials` status means the endpoint, scheduler, and database checks are reachable, but all configured feed paths are blocked by missing credentials.

Runtime Prisma clients cap each serverless instance at one Postgres connection by appending `connection_limit=1` when the deployed `DATABASE_URL` does not already specify a limit. This prevents Vercel function bursts and health checks from exhausting the Supabase session pool.

## Local Vercel setup

```bash
vercel login
vercel link --yes --project greyhound-iq --scope <aikickstart-team-scope>
vercel env pull .env.local
vercel dev
```

If the AIKICKSTART Vercel team is not visible in `vercel teams ls`, invite the authenticated Vercel user to the team first.

## Deploy flow

1. Developer opens a PR.
2. `CI` runs docs, env, Prisma, typecheck, lint, build, server boot, and smoke tests.
3. `Codex PR Review` reviews the PR.
4. `Vercel Preview` deploys a preview URL and smoke tests it.
5. Human reviewer approves.
6. Merge to `main`.
7. `Vercel Main` deploys the stable temp URL after CI succeeds.

## Migrations

Run Supabase migrations manually through GitHub Actions:

1. Open **Actions -> Supabase Migrate**.
2. Choose `staging` or `production`.
3. Run migration.
4. Seed only staging unless there is an explicit production data plan.
