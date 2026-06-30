# Incident and Secrets Runbook

## Secret exposure

If a secret appears in a commit, log, screenshot, PR, issue, wiki page, or chat:

1. Revoke the exposed secret.
2. Create a replacement secret.
3. Update GitHub Actions or Vercel env vars.
4. Audit logs for suspicious use.
5. Document the incident privately.

## Deployment incident

1. Check GitHub Actions.
2. Check Vercel deployment logs.
3. Check `/api/health`.
4. Check `/api/health/ready`.
5. Roll back Vercel deployment if needed.

## Database incident

1. Stop writes if data corruption is active.
2. Confirm whether staging or production is affected.
3. Restore to staging first.
4. Validate with smoke tests.
5. Only restore production after Daniel signs off.
