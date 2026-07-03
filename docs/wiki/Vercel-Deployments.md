# Vercel Deployments

Vercel is a preview and temporary deployment platform for GreyhoundIQ. Production runs on the AI Kick Start Google Cloud VPS.

## Preview deployments

Every PR deploys a preview URL after required secrets are configured:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The preview workflow builds with Vercel CLI, deploys a prebuilt artifact, smoke tests the URL, and comments the URL on the PR.

## Main temp URL

Merges to `main` may deploy a stable temporary Vercel URL after CI succeeds. This URL is for validation only and is not the production hosting target.

Production language:

- Auth: WorkOS only.
- Billing: Lago is the source of truth.
- Hosting: AI Kick Start Google Cloud VPS.
- Vercel: PR previews and temporary validation URLs only.

## Local linking

```bash
vercel link --yes --project greyhound-iq --scope <aikickstart-team-scope>
vercel env pull .env.local
```

If the AIKICKSTART team is not listed by `vercel teams ls`, the account needs to be invited to the Vercel team.
