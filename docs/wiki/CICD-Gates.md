# CI/CD Gates

## CI

The `CI` workflow runs on PRs and `main`:

- docs check
- `npm ci`
- `npm audit --audit-level=high`
- environment validation
- Prisma validation
- disposable Postgres migration
- seed
- typecheck
- lint
- build
- production server boot
- smoke tests

## Vercel Preview

Runs on PRs after preview secrets are available. It deploys a prebuilt preview and smoke tests the URL.

## Vercel Temporary Deployments

Vercel is preview and temporary verification infrastructure only. A Vercel deployment must not be treated as GreyhoundIQ production.

Temporary deployments are allowed for short-lived validation after successful CI. They must use preview or staging credentials and must not own the production domain.

## Production Gate

Production deploys to the AI Kick Start Google Cloud VPS. A production release is blocked unless:

- CI is green
- docs check is green
- staging migration and smoke tests have passed
- WorkOS production configuration is verified as the only auth path
- Lago products, plans, entitlements, and webhook settings are verified as the billing source of truth
- production migrations are reviewed as forward-only
- VPS environment variables are updated through the approved secret mechanism

## Supabase Migrate

Manual workflow for staging and reviewed production migrations. Production migration execution belongs to the approved VPS release window, not to a Vercel production rollout.
