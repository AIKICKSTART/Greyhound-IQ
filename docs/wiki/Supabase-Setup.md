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

## Storage and auth

Supabase values are present in `.env.example`, but not every Supabase-backed feature is fully enabled yet. Configure project values in Vercel before using previews.

## Migrations

Use the GitHub Actions **Supabase Migrate** workflow for staging and production migrations. Production migrations should be run manually and reviewed before execution.
