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

Runs on PRs after secrets are available. It deploys a prebuilt preview and smoke tests the URL.

## Vercel Main

Runs after successful CI on `main`. It deploys the stable temporary Vercel URL.

## Supabase Migrate

Manual workflow for staging and production migrations.
