# GreyhoundIQ — Operations & Deployment Plan v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (sections 11, 14, 16)
> Status: Architecture spec. Operations runbooks to be written in Phase 4.
> Hosting: Hetzner VPS (existing) + Supabase (managed)

---

## Infrastructure topology

```
┌─────────────────────────────────────────────────────────────┐
│  Hetzner VPS (cx22 — 4 vCPU, 8GB RAM, ~$8/mo)                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Docker Compose stack                                │    │
│  │                                                      │    │
│  │  nextjs: Next.js 16 (standalone)                     │    │
│  │  cron: node-cron, hits /api/internal/* endpoints     │    │
│  │  agents: spawned on-demand by hermes CLI             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Caddy reverse proxy (TLS, HSTS)                             │
│  Daily snapshots to Hetzner Storage Box                      │
└──────────────────────────────┬───────────────────────────────┘
                               │ TLS
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  Supabase (managed, ap-southeast-2 Sydney)                   │
│  - Postgres 15 (pgvector, citext, pg_trgm)                  │
│  - Auth (email + Google OAuth)                                │
│  - Storage (messages, listings, avatars, agent-outputs)      │
│  - Realtime (messages, conversation updates)                  │
└─────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  External services                                            │
│  - Resend (transactional email)                               │
│  - Stripe (payments)                                          │
│  - Sentry (error tracking, free tier)                         │
│  - Hermes MiniMax M3 (LLM, existing plan)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Hosting decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App server | Hetzner VPS | Existing, $8-30/mo, full control, fits tabular ML and image storage |
| Database | Supabase Postgres 15 | Managed, RLS, backups, Sydney region |
| File storage | Supabase Storage | Same project, signed URLs, RLS |
| Email | Resend | Modern API, good deliverability, $0-20/mo |
| Payments | Stripe | Industry standard, AU support, webhooks |
| Error tracking | Sentry | Free tier, good Next.js integration, PII stripping |
| LLM | Hermes on MiniMax M3 | Existing plan, no new API costs |

---

## Deployment topology

### Staging
- Hetzner VPS, `staging.greyhoundiq.com.au`
- Auto-deploys on push to `main` branch (after CI passes)
- Uses Supabase **staging** project (separate DB)
- Ingestion runs against staging sources (with rate limit overrides)

### Production
- Hetzner VPS, `greyhoundiq.com.au` (apex) and `www.greyhoundiq.com.au`
- Manual deploys via tag-based releases (no auto-deploy)
- Uses Supabase **production** project
- Ingestion runs against licensed sources only

### Rollback strategy
- Docker images tagged with git SHA + semver (`v1.0.0`, `v1.0.1-rc.1`)
- Previous image kept for 30 days
- Rollback = `docker compose up -d nextjs:v1.0.0`
- Database migrations are forward-only (no rollbacks); reverse migrations are forward-fix scripts

---

## CI/CD pipeline

### CI (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma validate
      - run: npx tsc --noEmit
      - run: npx next lint
      - run: npm run test
      - run: npx playwright test
        env:
          DATABASE_URL: postgres://staging@localhost:5432/greyhoundiq
      - run: npx audit-ci --config audit-ci.json
```

### CD (manual tag → deploy)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    tags: ['v*.*.*']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t greyhoundiq:${{ github.ref_name }} .
      - name: Push to registry
        run: docker push registry.greyhoundiq.com.au/greyhoundiq:${{ github.ref_name }}
      - name: Trigger rolling deploy
        run: ./scripts/trigger-deploy.sh ${{ github.ref_name }}
        env:
          HETZNER_API_TOKEN: ${{ secrets.HETZNER_API_TOKEN }}
```

### Database migrations
- Run via `npx prisma migrate deploy` on container startup
- Prisma tracks applied migrations in `_prisma_migrations` table
- Manual review required for any migration that:
  - Drops a column or table
  - Adds a NOT NULL column without default
  - Changes an index

---

## Environment configuration

### Environment variables (production)

```bash
# Supabase
DATABASE_URL="postgresql://postgres:***@db.dtizyjcoeostnfstzsvx.supabase.co:5432/postgres"
SUPABASE_URL="https://dtizyjcoeostnfstzsvx.supabase.co"
SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Auth
NEXTAUTH_SECRET="<32-byte-base64>"
NEXTAUTH_URL="https://greyhoundiq.com.au"

# Stripe
STRIPE_SECRET_KEY="sk_live_***"
STRIPE_WEBHOOK_SECRET="whsec_***"
STRIPE_PRICE_PRO_MONTHLY="price_***"
STRIPE_PRICE_PRO_YEARLY="price_***"
STRIPE_PRICE_PROPLUS_MONTHLY="price_***"
STRIPE_PRICE_PROPLUS_YEARLY="price_***"

# Email
RESEND_API_KEY="re_***"
EMAIL_FROM="GreyhoundIQ <hello@greyhoundiq.com.au>"

# Error tracking
SENTRY_DSN="https://***@sentry.io/***"
SENTRY_AUTH_TOKEN="<token>"
SENTRY_ORG="greyhoundiq"
SENTRY_PROJECT="web"

# Internal
INTERNAL_API_SECRET="<32-byte-base64>"

# Agents
HERMES_CLI_PATH="/usr/local/bin/hermes"
HERMES_TOKEN_PLAN="minimax-m3"
AGENT_USER="agent"  # low-privilege user for agent subprocess

# Storage
STORAGE_BUCKET_MESSAGES="messages"
STORAGE_BUCKET_LISTINGS="listings"
STORAGE_BUCKET_AVATARS="avatars"
STORAGE_BUCKET_AGENT_OUTPUTS="agent-outputs"
```

### Environment variables (staging)

Same structure, different values:
- Staging Supabase project
- Stripe test mode keys (`sk_test_*`)
- `NEXTAUTH_URL=https://staging.greyhoundiq.com.au`
- Test Resend API key
- Sentry staging DSN

### Secrets management
- All secrets in 1Password (team vault)
- Production secrets in Hetzner Cloud env vars (encrypted at rest)
- Service role key rotated quarterly
- API keys reviewed monthly

---

## Background jobs (cron)

System cron on VPS, no Redis/BullMQ at this scale.

| Job | Cron | Purpose | Failure handling |
|-----|------|---------|-------------------|
| `memory-decay` | 02:00 AEST daily | Reduce importance of idle memories | Retry 3x, alert after |
| `listing-expiry` | 01:00 AEST daily | Mark expired listings | Retry 3x |
| `moderator-agent` | Every 30 min | Scan new content for abuse | Alert if 2 consecutive failures |
| `agent-cleanup` | Hourly | Kill runs > 24h | Just log |
| `account-deletion` | 03:00 AEST daily | Hard-delete after 30d grace | Audit log |
| `ingest:betfair_hub` | 02:00 AEST daily | Nightly backfill | Retry with backoff |
| `ingest:topaz:results` | Every 5 min on race days | Race results | Skip if race day off |
| `ingest:topaz:live` | Every 2 min on race days | Live fields | Skip if race day off |
| `ingest:ga_studbook` | Sun 03:00 AEST weekly | Pedigree refresh | Manual re-trigger if fails |
| `backup:db` | 04:00 AEST daily | Supabase backup verification | Alert if missing |
| `backup:media` | 05:00 AEST daily | Storage backup verification | Alert if missing |
| `metrics:export` | Hourly | Push metrics to monitoring | Skip silently if down |

All cron jobs use the shared-secret header for internal auth.

---

## Monitoring & alerting

### Metrics (Prometheus)

Exposed at `/api/internal/metrics` (basic-auth + IP allowlist).

Key metrics:
- `http_requests_total{route, method, status}`
- `http_request_duration_seconds{route, method}`
- `prisma_query_duration_seconds{operation, model}`
- `agent_run_duration_seconds{agent_type, status}`
- `agent_run_tokens_total{agent_type, direction}`
- `safe_query_errors_total{operation}`
- `realtime_connections_active`
- `storage_bytes_used{bucket, user_id}`

### Sentry
- All server errors captured with context
- User context: `id` only, never PII
- Tags: `route`, `method`, `agent_type` (if applicable)
- Performance: trace every request, 10% sample

### Alerting (via Sentry + Telegram)

| Severity | Trigger | Channel |
|----------|----------|---------|
| Critical | Service down > 5 min | Telegram + SMS |
| Critical | RLS bypass attempt | Telegram (immediate) |
| High | Error rate > 1% for 5 min | Telegram |
| High | DB connection pool exhausted | Telegram |
| Medium | Source ingestion failure 2x in a row | Telegram |
| Medium | Stripe webhook failure | Telegram |
| Low | Cron job single failure | Email (daily digest) |

---

## Backups & disaster recovery

### Database (Supabase)
- **Daily** automated backups (Supabase Pro)
- **7 days** retention, expandable
- **Weekly** manual export to S3-compatible storage (Hetzner Storage Box)
- Recovery time objective (RTO): 1 hour
- Recovery point objective (RPO): 24 hours

### Media (Supabase Storage)
- Files versioned automatically
- **Weekly** full export to Hetzner Storage Box
- Recovery: re-import from export + re-link MediaAsset rows

### Restore procedure (runbook)

```bash
# 1. Identify target time
TARGET_TIME="2026-06-29 02:00 UTC"

# 2. Find the closest backup
supabase db backups list --project staging | grep $TARGET_TIME

# 3. Restore to staging first
supabase db restore --project staging --backup-id $BACKUP_ID

# 4. Verify with smoke tests
curl -s https://staging.greyhoundiq.com.au/api/health

# 5. Schedule production restore
# (Manual step — page Daniel)
```

---

## Capacity planning

### Targets (12-month projection)

| Metric | Y1 target | Headroom needed |
|--------|-----------|-----------------|
| Active users | 6,000 | 50,000 |
| Monthly active | 4,000 | 30,000 |
| Daily active | 500 | 5,000 |
| Total messages sent | 500K | 10M |
| Total conversations | 50K | 1M |
| Forum threads | 5K | 100K |
| Listings created | 10K | 200K |
| Memory entries | 500K | 50M |
| Agent runs/month | 100K | 5M |
| Storage | 100GB | 10TB |
| Monthly egress | 1TB | 50TB |

### Cost projection (Y1)

| Service | Cost |
|---------|------|
| Supabase Pro | $25/mo |
| Hetzner VPS | $20/mo |
| Resend (transactional) | $20/mo |
| Hermes MiniMax M3 (existing) | $0 |
| Sentry free | $0 |
| Stripe fees (~3% of revenue) | variable |
| **Total fixed** | **$65/mo** |

At 6,000 paying users × $99/yr avg = $49,500 ARR. Cost-to-revenue ratio: 65 × 12 / 49,500 = 1.6%. Healthy.

---

## Scaling plan

### Stage 1: 0 — 5,000 users
- Single VPS, single Supabase project
- Cron-based ingestion
- Static assets served by Next.js

### Stage 2: 5,000 — 50,000 users
- Upgrade to Hetzner VPS (8 vCPU, 16GB)
- Add Redis (Upstash free tier) for rate limiting
- Move cron to dedicated cron container
- Add CDN (Cloudflare free tier)

### Stage 3: 50,000+ users
- Migrate to Supabase Team plan ($599/mo)
- Add read replicas for analytics
- Move cron to dedicated scheduler (Cloudflare Workers + cron triggers)
- Consider multi-region (Sydney primary, US-East-Edge for static)

---

## Cost monitoring

Daily checks:
- Supabase usage (DB size, storage, egress) — alert at 80% of plan
- Hetzner VPS resource usage (CPU, RAM, disk) — alert at > 80%
- Resend email volume — alert at 80% of plan
- Stripe processing volume — reconcile daily

---

## Runbook inventory (to be written in Phase 4)

| Runbook | Owner | When written |
|---------|-------|--------------|
| Incident response | Daniel | Phase 4 |
| Database restore | Daniel | Phase 1 |
| Adding a new ingestion source | Daniel | Phase 2 |
| Scaling Hetzner VPS | Daniel | Stage 2 |
| Stripe webhook replay | Daniel | Phase 4 |
| Agent memory reset (per user) | Daniel | Phase 2 |
| Account deletion processing | Daniel | Phase 4 |
| Moderator agent override | Daniel | Phase 3 |
| Storage bucket policy change | Daniel | Phase 1 |
| Service role key rotation | Daniel | Phase 4 |

---

## On-call

- **Primary:** Daniel Fleuren (telegram: @danielfleuren)
- **Escalation:** 1Password vault has the runbook
- **Coverage:** Solo (no rotation). Acknowledge: known risk, accepted for v1.

---

## Compliance & audit calendar

| Event | When | Owner |
|-------|------|-------|
| Privacy policy review | Quarterly | Daniel |
| ToS review | Quarterly | Daniel |
| Penetration test | Before launch, then yearly | Daniel (booked) |
| Stripe account review | Monthly | Daniel |
| Supabase plan review | Monthly | Daniel |
| Service role key rotation | Quarterly | Daniel |
| Audit log review | Monthly | Daniel |
| Backup verification | Weekly (automated) | Daniel (on alert) |
| APP compliance review | Bi-annually | Daniel |
| Insurance review | Annually | Daniel |
