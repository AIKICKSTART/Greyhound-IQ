# Release Process

## Release targets

- Production runs on Google Cloud Run.
- Staging runs on the Google Cloud Run staging service.
- WorkOS is the only production authentication provider.
- Stripe handles production payments, Checkout, subscriptions, and customer billing portal access.

## Pre-release gates

Before a production release:

1. Run CI.
2. Run `npm run docs:check`.
3. Apply and verify staging migrations.
4. Smoke test the Cloud Run staging deployment.
5. Confirm WorkOS production redirect URLs, allowed origins, and secrets for the production domain.
6. Confirm no fallback auth provider is enabled for production users.
7. Confirm Stripe live Pro monthly/yearly prices, Checkout, billing portal, and webhook settings before exposing paid access.
8. Review the forward-only production migration plan and get Daniel's sign-off.

## Production launch

1. Deploy the reviewed build to Google Cloud Run.
2. Apply production Prisma migrations manually during the approved release window.
3. Update production Cloud Run environment variables through the approved Secret Manager mechanism.
4. Point the production domain at Cloud Run when the smoke checks pass.
5. Verify `/api/health` and `/api/health/ready`.
6. Verify WorkOS sign-in, sign-out, and protected-route access.
7. Verify Stripe Checkout, signed webhook delivery, customer portal access, and paid account tier updates.

## Rollback

Roll back Cloud Run traffic to the last known good revision. Database migrations are forward-only; fix data or schema issues with a new reviewed migration.
