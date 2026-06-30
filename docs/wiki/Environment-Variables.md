# Environment Variables

Use `.env.example` as the contract. Real values live in the team secret store, Vercel environment variables, and GitHub Actions secrets.

## Runtime variables

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

## Optional live racing variables

- `TOPAZ_API_KEY`
- `TOPAZ_API_BASE`
- `TOPAZ_OWNING_AUTHORITY_CODE`
- `TOPAZ_TIME_ZONE`

## CI/CD secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `OPENAI_API_KEY`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

Never commit `.env` or any real secret value.
