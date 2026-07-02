# Incident and Secrets Runbook

## Secret exposure

If a secret appears in a commit, log, screenshot, PR, issue, wiki page, or chat:

1. Revoke the exposed secret.
2. Create a replacement secret.
3. Update the affected GitHub Actions, Vercel preview/temp, WorkOS, Lago, or VPS environment secret.
4. Audit logs for suspicious use.
5. Document the incident privately.

## Deployment incident

1. Check GitHub Actions.
2. Confirm whether the incident affects production VPS or only Vercel preview/temp.
3. For production, check the AI Kick Start Google Cloud VPS service logs.
4. For preview/temp, check Vercel deployment logs.
5. Check `/api/health`.
6. Check `/api/health/ready`.
7. Roll back the VPS app release or the Vercel preview/temp deployment as appropriate.

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

## Vercel preview/temp incident

1. Confirm no production domain or production customer traffic is routed through Vercel.
2. Rotate affected preview/temp secrets.
3. Check `/api/health`.
4. Check `/api/health/ready`.
5. Roll back or delete the preview/temp deployment if needed.

## Database incident

1. Stop writes if data corruption is active.
2. Confirm whether staging or production is affected.
3. Restore to staging first.
4. Validate with smoke tests.
5. Only restore production after Daniel signs off.
