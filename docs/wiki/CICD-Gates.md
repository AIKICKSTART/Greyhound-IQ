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

## Cloud Run Staging

The `Cloud Run Deploy` workflow builds the container image and deploys the staging service from a `workflow_run` trigger after the `CI` workflow passes on `main`. Staging must use staging credentials and must not share production write credentials.

## Production Gate

Production deploys to Google Cloud Run after manual approval. A production release is blocked unless:

- CI is green
- docs check is green
- staging migration and smoke tests have passed
- WorkOS production configuration is verified as the only auth path
- Lago products, plans, entitlements, and webhook settings are verified as the billing source of truth
- production migrations are reviewed as forward-only
- Cloud Run environment variables and Secret Manager bindings are updated through the approved secret mechanism

## Lago Webhook Replay and Failure Handling

Lago is the billing source of truth. For failed deliveries, fix the root cause first, then replay from the Lago webhook log instead of editing local billing rows or resending ad hoc payloads.

1. Find the Lago webhook by event id, event type, customer, subscription, or invoice, and confirm no newer duplicate delivery already resolved the state.
2. Check the local `WebhookEvent` snapshot for `provider`, `lagoEventId`, `eventType`, `payloadHash`, `status`, `retryCount`, `receivedAt`, `processedAt`, and `error` to confirm whether the payload was received, deduped, or failed during processing.
3. Replay only after the webhook route, signature configuration, and app health are fixed. Do not hand-edit `WebhookEvent`, `BillingEvent`, subscription, invoice, or entitlement rows except through an approved data-repair change.
4. After replay, verify the linked `BillingEvent` or `lagoEventId`, clear failure status, and confirm local derived snapshots match the Lago customer, subscription, invoice, and entitlement state.

Unresolved Lago webhook failures block production promotion until reconciled or formally accepted as a launch risk.

## Supabase Migrate

Manual workflow for staging and reviewed production migrations. Production migration execution belongs to the approved Cloud Run release window.
