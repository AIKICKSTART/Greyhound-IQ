# GreyhoundIQ — Operations & Deployment Plan v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (sections 11, 14, 16)
> Status: Production operations baseline. Detailed runbooks continue in Phase 4.
> Hosting note: production targets the AI Kick Start-owned Google Cloud VPS.
> Vercel remains preview/temp infrastructure only; Supabase remains only for the
> current storage integration.

---

## Infrastructure topology

```
┌─────────────────────────────────────────────────────────────┐
│  AI Kick Start Google Cloud VPS                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Docker Compose stack                                │    │
│  │                                                      │    │
│  │  nextjs: Next.js 16 (standalone)                     │    │
│  │  postgres: GreyhoundIQ app database                  │    │
│  │  workers: cron/import/usage/outbox jobs              │    │
│  │  agents: spawned on-demand in Docker (sandboxed)     │    │
│  │  lago: billing API, UI, workers, clock, Redis, DB     │    │
│  │  n8n: workflow orchestration (optional v2)            │    │
│  │  localai: embeddings + LLM fallback (added in v2)    │    │
│  │  whisper: voice transcription (added in v2)           │    │
│  │  firecrawl: web scraping for data gaps (added in v2) │    │
│  │  cognee: knowledge graph for breeding (added in v2)  │    │
│  │  mem0: per-user memory layer (added in v2)            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Caddy reverse proxy (TLS, HSTS, mTLS for internal services)│
│  Daily VPS volume, Postgres, Lago, and config backups         │
└──────────────────────────────┬───────────────────────────────┘
                               │ TLS
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  Supabase Storage integration                                │
│  - Storage buckets only: messages, listings, avatars,        │
│    agent-outputs, site-assets                                │
│  - Signed URLs and bucket policies remain until replaced     │
└─────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  External services                                            │
│  - WorkOS AuthKit (identity and sessions)                    │
│  - Resend (transactional email)                               │
│  - Stripe or payment provider via Lago                        │
│  - Sentry (error tracking, free tier)                         │
│  - Hermes MiniMax M3 (LLM, existing plan)                    │
└─────────────────────────────────────────────────────────────┘
```

### v2 service descriptions

| Service | Port | Purpose | Data flow |
|---------|------|---------|-----------|
| **nextjs** | 3000 | Web app + API | Reads/writes the local Postgres database via Prisma; uses Supabase Storage only for object storage |
| **postgres** | 5432 (internal) | GreyhoundIQ application database | Private Docker/VPS network only; migrations run through Prisma |
| **workers** | -- | Daily/hourly jobs, usage outbox, webhook processing | Calls `/api/internal/*` or worker entrypoints with scoped internal secrets |
| **agents** | (spawn) | Hermes agent subprocesses | Docker with `--read-only --network=none`, destroyed after run |
| **lago** | 3001/3002 (internal + restricted UI) | Billing, metering, invoices, entitlements, dunning | GreyhoundIQ sends usage/events; Lago webhooks update local billing snapshots |
| **n8n** | 5678 | Workflow orchestration (Topaz, Betfair, Firecrawl) | Triggers via schedule; writes through app APIs/workers to local Postgres |
| **localai** | 8080 | Embeddings (all-MiniLM-L6-v2 or text-embedding-3-small) + LLM fallback | Caddy mTLS reverse proxy; only `nextjs` and `agents` can reach it |
| **whisper** | 9000 | Voice message transcription (distil-large-v3) | Triggered on voice upload; writes transcript metadata to Postgres and files to storage |
| **piper** | 9001 | TTS for narrated form guides | Triggered by agent; writes `MediaAsset` metadata to Postgres and audio to storage |
| **firecrawl** | 3002 | Self-hosted web scraping (GRNSW, GRV, Tasracing) | n8n-driven; quota 1000 pages/day per source |
| **cognee** | 8000 | Knowledge graph for breeding (Postgres `graph` extension) | Event-driven sync from Prisma writes via middleware |
| **mem0** | 8000 (shared with cognee) | Per-user memory extraction + storage | Embedding via localai, storage in local Postgres |
| **timesfm** | 9002 | Form trajectory forecasting (zero-shot) | Stateless inference; called by race-analyst agent |
| **autotrain** | -- | Monthly win-probability model retraining (worker) | Reads local Postgres training data; writes model artifact to VPS/object backup storage |
| **dify** | 5000 | Document Q&A (RAG over stewards' reports etc.) | pgvector-backed; tier-gated UI on /breeding and /statistics |
| **aider** | — | Dev pair-programmer (Python venv, terminal) | Called via `scripts/aider.sh`; not a service |
| **prometheus** | 9090 | Metrics scraping (every 15s) | Scrapes `/api/internal/metrics` from all services |
| **loki** | 3100 | Log aggregation | Reads container stdout |
| **grafana** | 3000 (internal) | Dashboards + alerting | Connected to Prometheus + Loki + Alertmanager |
| **otel-collector** | 4317/4318 | OpenTelemetry trace receiver | Agents/services export spans here |

---

## Hosting decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App server | AI Kick Start Google Cloud VPS | Owned production runtime, full control, fits app, workers, billing, and AI harnesses |
| Database | Self-hosted Postgres 16 on the VPS | Local source of truth for app data, auth linkage, entitlements, jobs, and audit records |
| File storage | Supabase Storage integration | Current signed upload/download and bucket policy implementation remains storage-only |
| Auth | WorkOS AuthKit | Production identity and session provider; no Supabase identity provider |
| Billing | Self-hosted Lago | Source of truth for plans, usage, subscriptions, invoices, entitlements, and dunning |
| Email | Resend | Modern API, good deliverability, $0-20/mo |
| Payments | Stripe or another payment provider via Lago | Payment rail only; Lago owns billing state |
| Error tracking | Sentry | Free tier, good Next.js integration, PII stripping |
| LLM | Hermes on MiniMax M3 | Existing plan, no new API costs |

---

## Deployment topology

### Staging
- Google Cloud VPS staging stack, `staging.greyhoundiq.com.au`
- Auto-deploys on push to `main` branch (after CI passes)
- Uses separate staging Postgres database and Lago test-mode configuration
- Uses separate Supabase Storage staging buckets/project for current media storage
- Ingestion runs against staging sources (with rate limit overrides)

### Production
- AI Kick Start-owned Google Cloud VPS, `greyhoundiq.com.au` (apex) and `www.greyhoundiq.com.au`
- Manual deploys via tag-based releases (no auto-deploy)
- Uses self-hosted production Postgres and production Lago services on the VPS
- Uses Supabase Storage production buckets only for current media/storage integration
- Ingestion runs against licensed sources only

### Rollback strategy
- Docker images tagged with git SHA + semver (`v1.0.0`, `v1.0.1-rc.1`)
- Previous image kept for 30 days
- Rollback = `docker compose up -d nextjs:v1.0.0`
- Database migrations are forward-only (no rollbacks); reverse migrations are forward-fix scripts

---

## CI/CD pipeline

### CI (GitHub Actions)

The current repository gate is implemented in
`.github/workflows/production-gate.yml`. It runs against a disposable Postgres
16 service and verifies the production build path.

```yaml
# .github/workflows/production-gate.yml
name: Production Gate
on:
  push:
    branches: ["main"]
  pull_request:
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run check:env -- --ci --production
      - run: npx prisma migrate deploy
      - run: npm run db:seed
      - run: npx prisma validate
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - run: npm run test:smoke
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
          VPS_DEPLOY_HOST: ${{ secrets.VPS_DEPLOY_HOST }}
          VPS_DEPLOY_KEY: ${{ secrets.VPS_DEPLOY_KEY }}
```

### Database migrations
- Run via `npx prisma migrate deploy` on container startup
- Prisma tracks applied migrations in `_prisma_migrations` table
- New environments start from `prisma/migrations/20260630093000_baseline`
- Manual review required for any migration that:
  - Drops a column or table
  - Adds a NOT NULL column without default
  - Changes an index
- Existing environments previously synchronized with `prisma db push` must be
  baselined once after confirming the schema matches:

```bash
npm run check:env -- --production
npx prisma migrate resolve --applied 20260630093000_baseline
npx prisma migrate deploy
```

Do not run `db:baseline` on an empty database; use `npm run bootstrap` there.

---

## Environment configuration

### Environment variables (production)

```bash
# Database (self-hosted Postgres on the VPS private network)
DATABASE_URL="postgresql://greyhoundiq_app:<password>@postgres:5432/greyhoundiq?schema=public"
DATABASE_IMPORT_URL="postgresql://greyhoundiq_import:<password>@postgres:5432/greyhoundiq?schema=public"
DIRECT_URL="postgresql://greyhoundiq_migrator:<password>@postgres:5432/greyhoundiq?schema=public"

# Supabase Storage only
SUPABASE_URL="https://<storage-project-ref>.supabase.co"
SUPABASE_ANON_KEY="<storage-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<storage-service-role-key>"
NEXT_PUBLIC_SUPABASE_URL="https://<storage-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<storage-anon-key>"

# Auth (WorkOS only)
NEXTAUTH_SECRET="<32-byte-base64>"
NEXTAUTH_URL="https://greyhoundiq.com.au"
AUTH_SECRET="<same class of secret; optional fallback for signed media URLs>"
WORKOS_CLIENT_ID="client_***"
WORKOS_API_KEY="sk_live_***"
WORKOS_COOKIE_PASSWORD="<32-byte-minimum>"
NEXT_PUBLIC_WORKOS_REDIRECT_URI="https://greyhoundiq.com.au/callback"

# Billing (Lago is the billing source of truth)
LAGO_API_URL="https://billing.greyhoundiq.com.au/api"
LAGO_FRONT_URL="https://billing.greyhoundiq.com.au"
LAGO_API_KEY="<lago-api-key>"
LAGO_WEBHOOK_SECRET="<32-byte-base64>"

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

# Optional live racing feed
TOPAZ_API_KEY="<licensed Topaz key>"
TOPAZ_API_BASE="https://topaz.grv.org.au/api"
TOPAZ_OWNING_AUTHORITY_CODE="VIC"
TOPAZ_TIME_ZONE="Australia/Sydney"

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

Local production gate commands:

```bash
npm run check:env -- --production
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm run build
SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
```

### Environment variables (staging)

Same structure, different values:
- Staging Postgres database on the VPS staging stack
- Supabase Storage staging buckets/project
- Lago test-mode configuration and payment-provider test keys inside Lago
- `NEXTAUTH_URL=https://staging.greyhoundiq.com.au`
- Test Resend API key
- Sentry staging DSN

### Secrets management
- All secrets in 1Password (team vault)
- Production secrets in the Google Cloud VPS/runtime secret mechanism
- Database, WorkOS, Lago, payment-provider, and storage service keys rotated quarterly
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
| `backup:db` | 04:00 AEST daily | Local Postgres backup verification | Alert if missing |
| `backup:media` | 05:00 AEST daily | Supabase Storage backup verification | Alert if missing |
| `metrics:export` | Hourly | Push metrics to monitoring | Skip silently if down |

All cron jobs use the shared-secret header for internal auth. Set
`INTERNAL_API_SECRET` on the web service and send it as `X-Internal-Secret`.
Marketplace expiry is exposed at `POST /api/internal/listing-expiry` and can be
run locally with `npm run maintain:listings`. Account deletion finalization is
exposed at `POST /api/internal/account-deletion` and can be run locally with
`npm run maintain:accounts`. Memory decay is exposed at
`POST /api/internal/memory-decay` and can be run locally with
`npm run maintain:memory`. Agent timeout cleanup is exposed at
`POST /api/internal/agent-cleanup` and can be run locally with
`npm run maintain:agents`.

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
| Medium | Lago or payment-provider webhook failure | Telegram |
| Low | Cron job single failure | Email (daily digest) |

---

## Backups & disaster recovery

### Database (self-hosted Postgres)
- **Daily** `pg_dump` plus VPS volume snapshot
- **7 days** hot backup retention, expandable
- **Weekly** manual export to off-host encrypted object storage
- Recovery time objective (RTO): 1 hour
- Recovery point objective (RPO): 24 hours

### Media (Supabase Storage)
- Files versioned automatically
- **Weekly** full export to off-host encrypted object storage
- Recovery: re-import from export + re-link MediaAsset rows

### Restore procedure (runbook)

```bash
# 1. Identify target time
TARGET_TIME="2026-06-29 02:00 UTC"

# 2. Find the closest backup
ls -lh /opt/aikickstart/backups/postgres

# 3. Restore to staging first
pg_restore --clean --if-exists --dbname "$STAGING_DATABASE_URL" "$BACKUP_FILE"

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

## Cost projection (Y1)

### v1 baseline (architecture v1)

| Service | Cost |
|---------|------|
| Google Cloud VPS production stack | Existing AI Kick Start VPS allocation |
| Self-hosted Postgres | $0 incremental |
| Self-hosted Lago | $0 incremental compute |
| Supabase Storage | Current storage-plan cost |
| Resend (transactional email) | $20/mo |
| Hermes MiniMax M3 (existing) | $0 |
| Sentry free tier | $0 |
| **Total fixed (v1)** | **VPS allocation + storage/email usage** |

### v2 additions (architecture v2)

| Service | Cost | Notes |
|---------|------|-------|
| n8n (self-hosted) | $0 | Docker container on Google Cloud VPS |
| LocalAI + Whisper + Piper | $0 (compute) | May require larger VPS sizing for 8 vCPU / 16GB RAM class workloads |
| Firecrawl (self-hosted) | $0 | Docker container |
| Cognee (in-process) | $0 | Same Postgres + pgvector + graph extensions |
| Mem0 (Apache-2.0) | $0 | Same Postgres |

### v3 additions (Technology Opportunities report, 2026-06-29)

| Service | Cost | Notes |
|---------|------|-------|
| TimesFM (Google pretrained, self-hosted) | $0 | Docker container; ~2GB RAM |
| Hugging Face AutoTrain (monthly retraining) | $0 | Self-hosted cron job |
| Dify (RAG pipeline) | $0 | Docker container on Google Cloud VPS |
| Aider (dev workflow) | $0 | Python venv; called via wrapper script |
| Piper / Voicebox (TTS) | $0 | Already included in v2 |
| Prometheus + Loki + Grafana stack | $0 (compute) | ~2GB RAM additional |
| OpenTelemetry collector | $0 | Docker sidecar |
| Open-weight fallback models (GLM-5.2, Kimi, Qwen) | ~$20/mo | OpenRouter metered; cached aggressively |
| DeepSeek-V4-Flash (gated — AU data-sovereignty review needed) | ~$30-100/mo | Cache-aware prompts only |
| **VPS upgrade** | TBD | Required for v3 compute (TimesFM + AutoTrain + Grafana stack) |
| **Total fixed (v3)** | **VPS sizing + storage/email/model usage** |

At 6,000 paying users × $99/yr avg = $49,500 ARR. Keep VPS, storage, email, and model spend under monthly budget review as compute-heavy v3 services come online.

### v3 cost caps (per user)

- LocalAI embeddings: 100 req/sec, ~$0.0001/embed → 1M embeds = $100
- Whisper transcription: ~0.5 min/voice msg, $0.0006/min (if we were using OpenAI) — local = $0
- Cognee graph traversal: compute-bound on Postgres, negligible
- n8n runs: negligible
- TimesFM forecasts: ~$0.001/forecast; 100k forecasts/mo = $100
- AutoTrain retraining: $0 (self-hosted)
- Open-weight fallback: $20/mo baseline; cache-aware reduces further
- DeepSeek (if gated cleared): capped at $200/mo

**At 6,000 users avg 50 memory entries each = 300k memories. 50k voice msgs/month × 30s avg = 25k min/month. 1M forecasts/month = $100. Target a 16 vCPU / 32GB Google Cloud VPS class before enabling the full v3 compute stack.**

---

## Scaling plan

### Stage 1: 0 — 5,000 users
- Single Google Cloud VPS, single local Postgres database
- Cron-based ingestion
- Static assets served by Next.js

### Stage 2: 5,000 — 50,000 users
- Upgrade the Google Cloud VPS to an 8 vCPU / 16GB class or split workers to a second VPS
- Add Redis (Upstash free tier) for rate limiting
- Move cron/import workloads to dedicated worker containers
- Add CDN (Cloudflare free tier)

### Stage 3: 50,000+ users
- Split app, Postgres, workers, and Lago onto separate VPS instances or a reviewed managed boundary
- Add Postgres read replicas for analytics
- Move cron/import workloads to a dedicated scheduler/worker host
- Consider multi-region (Sydney primary, US-East-Edge for static)

---

## Cost monitoring

Daily checks:
- Local Postgres usage (DB size, connections, backup freshness) — alert at 80% of plan
- Supabase Storage usage (bucket size, object count, egress) — alert at 80% of plan
- Google Cloud VPS resource usage (CPU, RAM, disk) — alert at > 80%
- Resend email volume — alert at 80% of plan
- Payment-provider processing volume — reconcile daily

---

## Runbook inventory (to be written in Phase 4)

| Runbook | Owner | When written |
|---------|-------|--------------|
| Incident response | Daniel | Phase 4 |
| Database restore | Daniel | Phase 1 |
| Adding a new ingestion source | Daniel | Phase 2 |
| Scaling Google Cloud VPS | Daniel | Stage 2 |
| Billing webhook replay | Daniel | Phase 4 |
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
| Payment-provider account review | Monthly | Daniel |
| Supabase Storage integration review | Monthly | Daniel |
| Storage service-role key rotation | Quarterly | Daniel |
| Audit log review | Monthly | Daniel |
| Backup verification | Weekly (automated) | Daniel (on alert) |
| APP compliance review | Bi-annually | Daniel |
| Insurance review | Annually | Daniel |
