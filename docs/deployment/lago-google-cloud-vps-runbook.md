# Lago Google Cloud VPS Runbook

Purpose: self-host Lago for GreyhoundIQ billing on the AI Kick Start Google Cloud VPS, using the vendored `external/lago` checkout as the deployment source.

## Scope

- Lago is the billing source of truth for customers, plans, subscriptions, usage, invoices, entitlements, and dunning.
- Stripe or another payment service provider is a payment rail only.
- GreyhoundIQ stores Lago IDs, webhook snapshots, and entitlement cache locally.
- Race-provider ingestion is out of scope. Do not change `TOPAZ_*`, `THEDOGS_*`, `WATCHDOG_*`, `FASTTRACK_*`, importer scripts, or provider middleware.

## VPS Prerequisites

- Google Cloud VPS with Docker Engine and the Docker Compose plugin.
- DNS A record for the Lago host, for example `billing.greyhoundiq.ai`, pointing at the VPS.
- Firewall allows public `443`; restrict `22`, Traefik dashboard `8080`, PostgreSQL `5432`, Redis `6379`, and Portainer to operator IPs or private networking only.
- A server-only secret store or operator password manager for Lago `.env` values. Never commit `.env`, API keys, database passwords, webhook secrets, or generated private keys.

## Deploy

Assume the GreyhoundIQ checkout is available on the VPS at `/srv/greyhoundiq`; adjust once per host.

```bash
sudo mkdir -p /opt/aikickstart/lago
sudo chown "$USER:$USER" /opt/aikickstart/lago
cd /opt/aikickstart/lago

cp /srv/greyhoundiq/external/lago/deploy/docker-compose.production.yml ./docker-compose.yml
cp /srv/greyhoundiq/external/lago/deploy/.env.production.example ./.env
chmod 600 .env
```

Edit `.env` on the VPS only. Set at minimum:

- `LAGO_DOMAIN`, `LAGO_ACME_EMAIL`
- `PORTAINER_USER`, `PORTAINER_PASSWORD`
- PostgreSQL, Redis, Rails, encryption, and RSA key variables used by `docker-compose.yml`
- SMTP and GCS/S3 storage variables if invoices, mail, or durable object storage are enabled

For first bootstrap only, create the initial Lago organisation/admin account through Lago's supported flow. After bootstrap, disable open signup and store the Lago API key in the GreyhoundIQ runtime secret store.

Before customer-facing use, review the Traefik ACME settings in the VPS copy of `docker-compose.yml`. The vendored production compose may use Let's Encrypt staging for dry runs; switch to the production ACME endpoint only after DNS and firewall checks pass.

```bash
docker compose config
docker compose pull
docker compose up -d --profile all
docker compose ps
```

## Verify

```bash
curl -I "https://$LAGO_DOMAIN"
curl -fsS "https://$LAGO_DOMAIN/api/health"
docker compose logs --tail=100 api worker billing-worker webhook-worker
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

Operator checks:

- Frontend loads over HTTPS.
- API health endpoint returns success.
- `api`, `worker`, `billing-worker`, `webhook-worker`, `clock`, `pdf`, PostgreSQL, and Redis are healthy.
- Portainer and Traefik dashboard are not publicly reachable.
- Lago can create a test customer, plan, subscription, usage event, invoice draft, and webhook endpoint in test mode.

## GreyhoundIQ Integration Handoff

Set these GreyhoundIQ production runtime secrets after Lago is healthy:

- `LAGO_API_URL=https://<lago-domain>/api`
- `LAGO_FRONT_URL=https://<lago-domain>`
- `LAGO_API_KEY`
- `LAGO_WEBHOOK_SECRET`

Do not add payment-provider variables to GreyhoundIQ until the app integration actually needs them. Webhooks must be signature-verified, idempotent, and processed asynchronously before production traffic.

## Backups

Before launch and before every Lago upgrade:

```bash
mkdir -p backups
set -a; . ./.env; set +a
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-lago}" "${POSTGRES_DB:-lago}" > "backups/lago-db-$(date +%F).sql"
docker compose config > "backups/docker-compose-$(date +%F).rendered.yml"
```

Also snapshot the VPS disk or back up the Docker volumes for PostgreSQL, Redis, Lago storage, RSA keys, Portainer data, and `letsencrypt/`. Run a restore drill before launch.

## Update And Rollback

```bash
cd /opt/aikickstart/lago
docker compose pull
docker compose up -d --profile all
docker compose ps
```

Rollback path:

1. Restore the previous `docker-compose.yml` and `.env` from the operator backup.
2. Restore the latest known-good PostgreSQL dump or VPS snapshot if migrations changed data.
3. Run `docker compose up -d --profile all`.
4. Re-run the verification checks and a GreyhoundIQ billing webhook smoke test.

## Production Guardrails

- Keep Lago admin UI access restricted to AI Kick Start operators.
- Keep Lago secrets server-only; never expose them in browser env, logs, docs, screenshots, or GitHub.
- Monitor Sidekiq queues, failed jobs, dead jobs, API health, disk, memory, TLS renewal, and backup freshness.
- Review Lago AGPL obligations before modifying Lago itself; prefer configuration and API integration over forks.
