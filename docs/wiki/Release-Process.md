# Release Process

## Pre-launch

Merging to `main` deploys the temporary Vercel URL. This is the current release path.

## Production launch

Before switching to production Supabase credentials or a custom domain:

- run CI
- run Supabase staging migration
- smoke test Vercel preview
- run production migration manually
- update Vercel production env vars
- deploy main
- verify `/api/health` and `/api/health/ready`

## Rollback

Use Vercel deployment rollback from the dashboard or CLI. Database migrations are forward-only; fix data/schema issues with a new forward migration.
