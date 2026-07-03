# Release Process

## Release targets

- Production runs on the AI Kick Start Google Cloud VPS.
- Vercel is for PR previews and temporary verification URLs only.
- WorkOS is the only production authentication provider.
- Lago is the billing source of truth for plans, entitlements, invoices, and subscription state.

## Pre-release gates

Before a production release:

1. Run CI.
2. Run `npm run docs:check`.
3. Apply and verify staging migrations.
4. Smoke test the Vercel preview or temporary verification deployment.
5. Confirm WorkOS production redirect URLs, allowed origins, and secrets for the VPS domain.
6. Confirm no fallback auth provider is enabled for production users.
7. Confirm Lago products, plans, entitlements, and webhook settings before exposing paid access.
8. Review the forward-only production migration plan and get Daniel's sign-off.

## Production launch

1. Deploy the reviewed build to the AI Kick Start Google Cloud VPS.
2. Apply production Prisma migrations manually during the approved release window.
3. Update production VPS environment variables through the approved host secret mechanism.
4. Point the production domain at the VPS when the smoke checks pass.
5. Verify `/api/health` and `/api/health/ready`.
6. Verify WorkOS sign-in, sign-out, and protected-route access.
7. Verify Lago billing and entitlement state for free and paid accounts.

## Rollback

Roll back the VPS application release to the last known good build. Database migrations are forward-only; fix data or schema issues with a new reviewed migration.
