# Incident and Secrets Runbook

## Secret exposure

If a secret appears in a commit, log, screenshot, PR, issue, wiki page, or chat:

1. Revoke the exposed secret.
2. Create a replacement secret.
3. Update the affected GitHub Actions, Secret Manager, WorkOS, Lago, or Cloud Run environment secret.
4. Audit logs for suspicious use.
5. Document the incident privately.

## Deployment incident

1. Check GitHub Actions.
2. Confirm whether the incident affects production or staging.
3. For production, check Cloud Run service logs and Cloud Monitoring.
4. For staging, check Cloud Run service logs and the deploying GitHub Actions run.
5. Check `/api/health`.
6. Check `/api/health/ready`.
7. Roll back Cloud Run traffic to the last known good revision as appropriate.

## Auth incident

WorkOS is the only production authentication provider.

1. Confirm the affected WorkOS environment and application.
2. Rotate impacted WorkOS secrets or signing keys.
3. Review redirect URLs, allowed origins, sessions, and audit logs.
4. Disable affected sessions when account compromise is possible.
5. Do not enable a fallback auth provider as an incident workaround.

## Billing incident

Lago is the billing source of truth.

1. Check Lago customer, subscription, plan, entitlement, invoice, and webhook state.
2. Replay or repair Lago webhooks after the root cause is understood.
3. Treat local billing fields as derived state until reconciled with Lago.
4. Do not grant or revoke paid access from local state alone.

## Cloud Run staging incident

1. Confirm no production customer traffic is routed through staging.
2. Rotate affected staging secrets.
3. Check `/api/health`.
4. Check `/api/health/ready`.
5. Roll back or delete the staging revision if needed.

## Database incident

1. Stop writes if data corruption is active.
2. Confirm whether staging or production is affected.
3. Restore to staging first.
4. Validate with smoke tests.
5. Only restore production after Daniel signs off.
