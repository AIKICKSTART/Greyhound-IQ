# Vercel Deployments

Vercel is the current frontend/API deployment platform.

## Preview deployments

Every PR deploys a preview URL after required secrets are configured:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The preview workflow builds with Vercel CLI, deploys a prebuilt artifact, smoke tests the URL, and comments the URL on the PR.

## Main temp URL

Merges to `main` deploy a stable Vercel URL after CI succeeds. During pre-launch this may use staging Supabase credentials.

## Local linking

```bash
vercel link --yes --project greyhound-iq --scope <aikickstart-team-scope>
vercel env pull .env.local
```

If the AIKICKSTART team is not listed by `vercel teams ls`, the account needs to be invited to the Vercel team.
