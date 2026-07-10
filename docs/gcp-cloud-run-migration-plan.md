# GreyhoundIQ Cloud Run Migration And Production Adoption Plan

Date: 2026-07-03

Scope: operate GreyhoundIQ on Google Cloud Run for staging and production, while keeping Supabase as the main app backend unless a later evidence-based migration justifies changing it.

Non-negotiable: production data must never be wiped, reset, reseeded, overwritten, or destructively migrated by CI/CD, preview workflows, staging workflows, deployment scripts, seed scripts, or local convenience commands.

Extension: native marketplace, community, messaging, media, moderation, and later calls are covered in `docs/marketplace-community-messaging-media-calls-plan.md`.

## A. Skill Scan Summary

Primary skill read and applied:

| Skill | Status | Effect on this plan |
|---|---:|---|
| `G:/skills/gcp-cloud-run` | Used | Cloud Run service must be a stateless container, respect `PORT`, expose health checks, handle `SIGTERM`, avoid long-running background work in the request container, set concurrency deliberately, use startup CPU boost and min instances where latency matters. |

Relevant local skills found under `G:/skills`:

| Skill | Relevance |
|---|---|
| `cloud-devops` | Frames the migration as infra, CI/CD, monitoring, security, cost, and DR phases. |
| `cloud-architect` | Cost-conscious, secure, resilient target architecture and tradeoffs. |
| `cloud_run_manager` | Cloud Run operating surface, assumed compatible with `gcp-cloud-run`. |
| `cloud` | General cloud planning support. |
| `devops-deploy` | Release sequencing and deployment steps. |
| `devops-rollout-plan` | Rollout, staged adoption, rollback, and launch phases. |
| `devops-troubleshooter` | Incident and deployment failure handling. |
| `docker-expert` | Dockerfile, image size, non-root runtime, `.dockerignore`, build validation. |
| `multi-stage-dockerfile` | Production Node/Next image build pattern. |
| `github-actions` | Existing CI platform; build/deploy skeletons should extend this rather than introduce a second pipeline first. |
| `github-actions-docs` | Workflow syntax/reference support. |
| `github-actions-templates` | Starter workflow structure. |
| `cicd-automation-workflow-automate` | PR, staging, approval, production, rollback stages. |
| `terraform-infrastructure` | IaC target for repeatable GCP resources. |
| `terraform-skill` | Terraform implementation conventions. |
| `terraform-specialist` | Advanced Terraform/IAM/state review. |
| `secrets-management` | Secret Manager, GitHub environment secrets, rotation policy. |
| `secret-scanning` | CI gate for leaked secrets. |
| `security-audit` | Production review stance and threat/risk framing. |
| `api-security-best-practices` | API route and webhook protection. |
| `web-security-testing` | Staging DAST/security checks. |
| `sast-configuration` | SAST gate design. |
| `codeql` | Optional GitHub-native code scanning gate. |
| `supabase-automation` | Supabase environment and operational checklist. |
| `supabase-postgres-best-practices` | Pooling, migrations, RLS, backup policy. |
| `supabase_explorer` | Future Supabase inspection path, not used here because no live Supabase credentials were needed. |
| `postgres-best-practices` | Postgres safety, indexing, connection and backup posture. |
| `postgresql` | General Postgres operations. |
| `postgresql-optimization` | Query/performance follow-up once traffic data exists. |
| `database-migration` | Forward-only migration planning. |
| `database-migrations-sql-migrations` | Expand-and-contract, validation, rollback-by-forward-fix. |
| `observability-monitoring-monitor-setup` | Logging, metrics, dashboards, alerting. |
| `observability-monitoring-slo-implement` | SLOs and launch reliability targets. |
| `slo-implementation` | SLO checklist support. |
| `agent_sre_engineer` | GCP Cloud Run monitoring and structured logging perspective. |
| `agent_realtime_engineer` | Realtime/WebSocket/SSE review perspective. |
| `launch-strategy` | Launch readiness and staged adoption. |

Cybersecurity skill layer used:

| Skill | Effect |
|---|---|
| `C:/Users/verri/.agents/skills/auditing-gcp-iam-permissions/SKILL.md` | Least-privilege IAM, service account separation, no primitive roles, avoid user-managed service account keys. |
| `C:/Users/verri/.agents/skills/implementing-devsecops-security-scanning/SKILL.md` | Gitleaks, Semgrep, Trivy, container scan, SBOM, DAST, branch protection gates. |

Missing exact local skill folders found during scan:

| Missing exact skill | Assumption used |
|---|---|
| Google Cloud Build | Use official Google Cloud Build docs later if Cloud Build is selected; this plan recommends GitHub Actions first because the repo already uses it. |
| Artifact Registry | Use standard Google Artifact Registry Docker repository pattern. |
| Cloud DNS | Use standard Cloud DNS managed zone and registrar delegation. |
| Cloud Tasks | Future option for retryable internal work if launch scheduler calls outgrow bounded HTTP handlers. |
| Pub/Sub | Use only if multiple consumers need event fan-out; otherwise Cloud Tasks is simpler. |
| Cloud Storage | Use standard GCS bucket controls for backups/imports/exports/temp processing. |
| Load balancing | Use official Cloud Run custom domain guidance: production custom domain through global external Application Load Balancer, not Cloud Run domain mapping. |

Current Google Cloud docs checked on 2026-07-03:

- Cloud Run supports `australia-southeast1` Sydney and `australia-southeast2` Melbourne.
- Google recommends a global external Application Load Balancer for production Cloud Run custom domains; direct Cloud Run domain mappings are preview/limited and not recommended for production.
- Workload Identity Federation is the preferred GitHub Actions auth path over long-lived service account keys.

## B. Current App Audit

| Area | Finding |
|---|---|
| Framework | Next.js `16.2.9` App Router, React `19.2.4`, TypeScript, Tailwind v4, Node engine `>=22.11 <25`. |
| Runtime | Node route handlers and server components. Several routes explicitly set `runtime = "nodejs"`. No Edge runtime requirement found. |
| Backend/API | Next.js API route handlers under `src/app/api`: health, users, listings, forum, conversations/messages, media, agents, internal jobs, and Lago webhook. |
| Auth | WorkOS AuthKit is the production auth path. `src/proxy.ts` uses `authkitProxy`; local app users link by WorkOS subject in `User.workosUserId`. |
| Database | Prisma `6.19.3` against PostgreSQL. README and env examples point to Supabase Postgres pooler on port `6543` with `pgbouncer=true`. |
| Storage | Supabase Storage via server-side service role for signed operations. Buckets: `site-assets`, `public-user-media`, `private-user-media`. |
| Billing | Lago is source of truth. Webhook endpoint verifies HMAC with `LAGO_WEBHOOK_SECRET` and dedupes by Lago unique key/payload hash. |
| Live data | The Dogs, Watchdog, Topaz, and FastTrack prototype providers. Current schedule is Cloud Scheduler every 5 minutes/hourly, with GitHub Actions available as an operator-triggered backup. |
| Realtime | No durable Supabase Realtime/WebSocket implementation found for forum/messages/live race UI. Current data is DB-backed HTTP. |
| Retired preview path | Legacy preview/main workflows, cron config, CLI config, and preview redirect fallback have been removed. |
| Docker | No root app Dockerfile or `.dockerignore` for GreyhoundIQ. Only local Postgres compose and vendored Lago Docker files exist. |
| Health | `/api/health`, `/api/health/ready`, `/api/health/feeds`; smoke script checks these plus auth/listings/forum endpoints. |

Build and verification commands:

```bash
npm ci
npm run check:env -- --ci --production
npx prisma validate
npm run typecheck
npm run lint
npm run build
npm run start -- --hostname 0.0.0.0
npm run test:smoke
```

Database commands:

| Command | Production policy |
|---|---|
| `npm run db:migrate` / `npx prisma migrate deploy` | Allowed only after staging pass, migration review, and production approval. |
| `npm run db:seed` | Never allowed in production. Current seed wipes core tables with `deleteMany()`. |
| `npm run db:reset` | Never allowed outside local disposable DB. |
| `npm run db:push` | Never allowed for staging/prod. Use migrations only. |
| `npm run bootstrap` | Never allowed in production because it runs migrate plus seed. |
| `npm run db:local:*` | Local only. |
| backfill/import scripts | Not CI deploy steps. Run only as operator jobs with explicit target DB and throttles. |

Environment variables:

| Public browser-safe | Private server-only / secret |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `DATABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `DATABASE_IMPORT_URL` |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | `DIRECT_URL` |
| `NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA` | `SUPABASE_URL` |
| `NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT` | `SUPABASE_ANON_KEY` if not exposed intentionally |
| `NEXT_PUBLIC_USE_SUPABASE_SITE_ASSETS` | `SUPABASE_SERVICE_ROLE_KEY` |
|  | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_SECRET`, `AUTH_URL` |
|  | `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_REDIRECT_URI` |
|  | `LAGO_API_URL`, `LAGO_FRONT_URL`, `LAGO_API_KEY`, `LAGO_WEBHOOK_SECRET` |
|  | `INTERNAL_API_SECRET`, `INTERNAL_SECRET`, `CRON_SECRET`, `PROD_INTERNAL_API_SECRET` |
|  | `TOPAZ_API_KEY`, provider feed credentials |
|  | `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_BUILD_SERVICE_ACCOUNT`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `GCP_RUNTIME_SERVICE_ACCOUNT`, `OPENAI_API_KEY` |
|  | `STAGING_DATABASE_URL`, `PROD_DATABASE_URL`, GitHub WIF variables |

Values that belong in Google Secret Manager for Cloud Run:

- `DATABASE_URL`, `DIRECT_URL` if used for approved migration jobs only, `SUPABASE_SERVICE_ROLE_KEY`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXTAUTH_SECRET`, `AUTH_SECRET`, `LAGO_API_KEY`, `LAGO_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`, `CRON_SECRET`, `TOPAZ_API_KEY`, and any future paid/live feed credentials.

Risks found:

1. `supabase-migrate.yml` allows `environment=production` and `seed=true`. That can run the destructive seed against production.
2. `prisma/seed.ts` deletes core tables before inserting demo data.
3. `db:reset`, `db:push`, and `bootstrap` exist in package scripts. They are useful locally but must be blocked in CI/prod.
4. Live sync is an HTTP request with `maxDuration = 300`; keep it on bounded Cloud Scheduler HTTP calls for launch, and move archive/backfill work to Cloud Run Jobs before making those workloads routine.
5. No production app Dockerfile exists yet.
6. `safeQuery` hides DB failures from users by returning empty states. Good for graceful degradation, but production alerts must fire on readiness/feed failures and DB errors.

## C. Recommended Target Architecture

```mermaid
flowchart LR
  U[Users and crawlers] --> DNS[Cloud DNS]
  DNS --> ALB[Global external HTTPS Load Balancer]
  ALB --> CDN[Optional Cloud CDN for static/cacheable paths]
  ALB --> RUN[Cloud Run web-api service]

  RUN --> SM[Secret Manager]
  RUN --> SUPA[(Supabase Postgres/Auth-adjacent APIs/Storage)]
  RUN --> WORKOS[WorkOS AuthKit]
  RUN --> LAGO[Lago billing]
  RUN --> FEEDS[Race data providers]
  RUN --> GCS[Cloud Storage backups/imports/exports/temp]

  SCH[Cloud Scheduler] --> JOBS[Bounded internal job routes]
  JOBS --> SUPA
  JOBS --> FEEDS

  GH[GitHub Actions OIDC] --> AR[Artifact Registry]
  AR --> RUN
  GH --> STAGE[Deploy staging]
  GH --> PROD[Manual approval deploy production]

  RUN --> LOG[Cloud Logging/Monitoring/Error Reporting]
  JOBS --> LOG
```

Service list:

- Cloud Run: `greyhoundiq-web-staging`, `greyhoundiq-web-prod`.
- Optional future Cloud Run Jobs: `greyhoundiq-import-*`, `greyhoundiq-backfill-*`, and other long-running operator workloads.
- Artifact Registry: Docker repo per project or per env, preferably one repo with env tags and immutable digest promotion.
- Secret Manager: separate staging and production secret names and access bindings.
- Cloud Storage: env-separated buckets for imports, exports, backups, temp processing, logs if needed.
- Cloud Scheduler: triggers sync/maintenance.
- Cloud Tasks: future retry buffer only if bounded scheduler calls need queueing/backoff beyond Cloud Scheduler.
- Pub/Sub: only when a single event must fan out to multiple independent consumers.
- Cloud Logging, Monitoring, Error Reporting, uptime checks, alert policies.
- Cloud DNS and global external Application Load Balancer with Google-managed cert.

Request flow:

1. User hits `https://www.greyhoundsiq.com.au`.
2. Cloud DNS resolves to the HTTPS load balancer.
3. Load balancer terminates TLS and routes to the prod Cloud Run serverless NEG.
4. Cloud Run reads secrets from Secret Manager and connects to Supabase through the transaction pooler.
5. WorkOS handles session/auth. Lago handles billing source-of-truth operations.

Deployment flow:

1. PR runs checks only.
2. Successful `CI` on `main` triggers the Cloud Run deploy workflow, which builds one image and pushes `australia-southeast1-docker.pkg.dev/.../greyhoundiq-web:<sha>`.
3. Deploy the same image digest to staging.
4. Run staging migrations only after explicit staging approval.
5. Run smoke/security checks.
6. Manual production approval promotes the same digest to production.
7. Production migrations are separately approved and forward-only.

Failure-mode handling:

| Failure | Handling |
|---|---|
| Traffic spike | Cloud Run scales within max instance budget; load balancer returns normal errors if hard cap reached rather than exhausting Supabase. Increase max only after Supabase pool limits are confirmed. |
| Supabase slows/rate limits | Lower Cloud Run concurrency/max instances, cache last-good race data, alert on readiness/feed degradation, temporarily pause write-heavy sync jobs. |
| Live data ingestion fails | Serve last-good data, mark `DataSourceHealth` degraded, rely on the next bounded scheduler attempt for launch, and move to Cloud Tasks/Run Jobs only if retry/backoff pressure proves it. |
| External feed unavailable | Do not overwrite good rows with blanks. Keep provenance and stale markers. |
| Storage upload fails | Return retryable UI error; leave `MediaAsset` pending/error; scheduled cleanup removes abandoned objects. |
| Bad deployment | Shift Cloud Run traffic back to previous revision. Do not roll back DB destructively. |
| Bad migration | Forward-fix with reviewed migration or restore after staging drill and Daniel approval. |

Trial-credit setup:

- One GCP project is acceptable for trial if IAM, service accounts, secrets, Cloud Run services, and buckets are env-separated.
- Better production shape: separate `greyhoundiq-staging` and `greyhoundiq-prod` GCP projects once billing and domain are stable.
- Start with one region: `australia-southeast1`.
- Add `australia-southeast2` active/passive only after launch metrics prove need.

Production-scale upgrade path:

- Move custom domain behind global external Application Load Balancer with Cloud Armor.
- Add regional failover to Melbourne if availability target requires it.
- Add Cloud CDN for static/cacheable assets.
- Move large imports/backfills to Cloud Run Jobs with GCS manifests.
- Introduce Pub/Sub only when multiple consumers need the same event.

## D. Environment Strategy

| Env | Domain | Cloud Run service | Supabase project | DB access | Storage buckets | Secrets source | Deploy trigger | Migrations | Who can deploy |
|---|---|---|---|---|---|---|---|---|---|
| local | `http://localhost:3000` | none | local Postgres or Supabase staging | local/staging only | local/Supabase staging | `.env` from secret store, never committed | developer command | local `migrate dev` or staging-safe only | developer |
| preview | optional `pr-*.staging.greyhoundsiq.com.au` later | optional later | staging only | staging read/write, no prod creds | staging buckets | GitHub preview env secrets | PR | no prod migrations, no seed against prod | CI bot |
| staging | `https://staging.greyhoundsiq.com.au` | `greyhoundiq-web-staging` | `greyhoundiq-staging` | staging write | `greyhoundiq-staging-*` plus Supabase staging storage | Secret Manager staging + GitHub environment | merge to `main` or manual | `migrate deploy` allowed after review; seed allowed only if staging | Daniel/approved maintainer |
| production | `https://www.greyhoundsiq.com.au` | `greyhoundiq-web-prod` | `greyhoundiq-prod` | app runtime only; migration URL isolated | `greyhoundiq-prod-*` plus Supabase prod storage | Secret Manager prod + protected GitHub environment | manual approval, same image digest as staging | forward-only, reviewed, backup first, no seed | Daniel/approved release owner |

No shared write credentials between staging and production. Staging jobs must not be able to read production Secret Manager secrets.

## E. CI/CD Design

Recommendation: GitHub Actions first. The repo already uses GitHub Actions for CI, Cloud Run deploys, live sync backup, Codex review, and Supabase migration. Use Workload Identity Federation to avoid long-lived GCP service account keys.

Branch strategy:

- PR: checks only.
- `main`: build image once, deploy to staging.
- Production: manual GitHub environment approval that promotes an existing image digest.

PR checks:

```yaml
name: Cloud Run CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: greyhoundiq
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres -d greyhoundiq"
          --health-interval 5s --health-timeout 5s --health-retries 20
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/greyhoundiq
      NEXTAUTH_URL: http://127.0.0.1:3000
      NEXTAUTH_SECRET: ci-nextauth-secret-32-characters-minimum
      AUTH_SECRET: ci-nextauth-secret-32-characters-minimum
      SUPABASE_URL: https://ci.supabase.co
      NEXT_PUBLIC_SUPABASE_URL: https://ci.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon
      SUPABASE_SERVICE_ROLE_KEY: ci-service-role
      WORKOS_CLIENT_ID: client_ci_dummy
      WORKOS_API_KEY: sk_test_ci_dummy
      WORKOS_COOKIE_PASSWORD: ci-workos-cookie-password-32-characters
      NEXT_PUBLIC_WORKOS_REDIRECT_URI: http://127.0.0.1:3000/callback
      INTERNAL_API_SECRET: ci-internal-secret-32-characters-min
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npm run check:env -- --ci --production
      - run: npx prisma validate
      - run: npx prisma migrate deploy
      - run: npm run db:seed
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - name: Block dangerous production DB commands
        run: |
          set -euo pipefail
          ! git grep -nE 'prisma migrate reset|prisma db push|npm run db:reset|npm run db:push|npm run bootstrap' -- . ':!README.md' ':!docs/**'
          ! git grep -nEi '\bTRUNCATE\b|DELETE\s+FROM\s+[A-Za-z_"][A-Za-z0-9_"]*\s*;' -- prisma/migrations scripts src || true
```

DevSecOps gates:

- Gitleaks on PRs and pushes.
- Semgrep security/OWASP rules on PRs.
- Trivy filesystem scan on PRs.
- Trivy container scan after Docker build.
- SBOM artifact for each release image.
- OWASP ZAP baseline against staging, non-blocking at first then blocking for high-confidence critical findings.

Build and deploy skeleton:

```yaml
name: Cloud Run Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      image_digest:
        description: Existing image digest to promote to production
        required: false
permissions:
  contents: read
  id-token: write

env:
  PROJECT_ID: greyhoundiq-prod-or-shared
  REGION: australia-southeast1
  REPOSITORY: greyhoundiq
  IMAGE: greyhoundiq-web

jobs:
  build:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_BUILD_SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
      - run: docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE:${{ github.sha }} .
      - id: push
        run: |
          docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE:${{ github.sha }}
          digest="$(gcloud artifacts docker images describe $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE:${{ github.sha }} --format='value(image_summary.digest)')"
          echo "digest=$digest" >> "$GITHUB_OUTPUT"

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_STAGING_DEPLOY_SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: |
          gcloud run deploy greyhoundiq-web-staging \
            --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE@${{ needs.build.outputs.digest }}" \
            --region "$REGION" \
            --service-account greyhoundiq-run-staging@$PROJECT_ID.iam.gserviceaccount.com \
            --no-allow-unauthenticated

  deploy-production:
    if: github.event_name == 'workflow_dispatch' && inputs.image_digest != ''
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_PROD_DEPLOY_SERVICE_ACCOUNT }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: |
          gcloud run deploy greyhoundiq-web-prod \
            --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE@${{ inputs.image_digest }}" \
            --region "$REGION" \
            --service-account greyhoundiq-run-prod@$PROJECT_ID.iam.gserviceaccount.com
```

Required workflow change before production:

- Remove `seed` from the production option in `.github/workflows/supabase-migrate.yml`, or add a hard guard:

```yaml
- name: Refuse production seed
  if: inputs.environment == 'production' && inputs.seed == true
  run: |
    echo "Production seed is forbidden."
    exit 1
```

Rollback:

```bash
gcloud run services update-traffic greyhoundiq-web-prod \
  --region australia-southeast1 \
  --to-revisions LAST_KNOWN_GOOD_REVISION=100
```

Database rollback is not destructive. Fix forward with a reviewed migration or restore only after a staging restore drill and Daniel approval.

## F. Database Protection Plan

Strict policy:

- Production migrations are forward-only.
- Use expand-and-contract:
  1. add nullable/default-compatible schema
  2. deploy code that writes both old and new if needed
  3. backfill in bounded jobs
  4. switch reads
  5. remove old schema in a later reviewed migration
- No production `DROP`, `TRUNCATE`, unscoped `DELETE`, `migrate reset`, `db push`, seed, or bootstrap.
- Any destructive operation needs a written data-retention reason, manual approval, preflight count, backup, and rollback-by-restore plan.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and never appears in frontend env, build logs, public examples, or PR comments.
- Production DB URL must exist only in production GitHub environment secrets/Secret Manager, not preview/staging.
- Staging and production Supabase projects should be separate. Using one project with schema separation is a temporary exception only with explicit approval.

Backups:

- Enable Supabase production backups/PITR at the highest practical tier before launch.
- Before production migrations, take provider backup/snapshot if available and record timestamp.
- Export critical tables or full logical dump to locked GCS bucket for major launches.
- Drill restore to staging before domain cutover.

RLS and access:

- Keep WorkOS as app identity source.
- Keep Supabase Third-Party Auth/RLS only where storage policies need authenticated context.
- Audit storage RLS policies after every bucket/migration change.
- Application runtime should use the lowest credential needed; service role only for server-side signed storage/admin paths.

Emergency recovery:

1. Stop writes or pause Cloud Run traffic if corruption is active.
2. Preserve logs and current DB state.
3. Restore to staging first.
4. Validate smoke, auth, billing, live race data, and media access.
5. Restore production only after sign-off.

## G. GCP Setup Checklist

1. Create/select projects:
   ```bash
   gcloud projects create greyhoundiq-staging
   gcloud projects create greyhoundiq-prod
   ```
2. Enable APIs:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
     cloudbuild.googleapis.com iamcredentials.googleapis.com cloudresourcemanager.googleapis.com \
     logging.googleapis.com monitoring.googleapis.com cloudscheduler.googleapis.com cloudtasks.googleapis.com \
     storage.googleapis.com certificatemanager.googleapis.com dns.googleapis.com compute.googleapis.com
   ```
3. Create service accounts:
   - `greyhoundiq-run-staging`
   - `greyhoundiq-run-prod`
   - `greyhoundiq-build`
   - `greyhoundiq-deploy-staging`
   - `greyhoundiq-deploy-prod`
   - optional `greyhoundiq-jobs-*`
4. IAM:
   - Runtime SAs: Secret Manager accessor only for own env secrets, logging writer.
   - Build SA: Artifact Registry writer.
   - Deploy SAs: Cloud Run developer/admin scoped to target service plus `iam.serviceAccountUser` on target runtime SA.
   - No primitive Owner/Editor roles.
   - No user-managed service account keys.
5. Configure GitHub Workload Identity Federation with environment-bound claims.
6. Create Artifact Registry:
   ```bash
   gcloud artifacts repositories create greyhoundiq \
     --repository-format=docker \
     --location=australia-southeast1
   ```
7. Add Secret Manager values per env. Do not copy prod values to staging.
8. Add Cloud Storage buckets:
   - `greyhoundiq-staging-imports`
   - `greyhoundiq-staging-exports`
   - `greyhoundiq-staging-backups`
   - `greyhoundiq-staging-temp`
   - `greyhoundiq-prod-imports`
   - `greyhoundiq-prod-exports`
   - `greyhoundiq-prod-backups`
   - `greyhoundiq-prod-temp`
9. Bucket controls:
   - uniform bucket-level access
   - public access prevention unless explicitly public
   - lifecycle delete temp after 1-7 days
   - retention lock for backups after policy is confirmed
   - signed URLs for private downloads
10. Create Cloud Run services:
    - initial staging deploy only
    - prod deploy only after staging sign-off
11. Cloud Run baseline settings:

| Setting | Staging | Production |
|---|---:|---:|
| Region | `australia-southeast1` | `australia-southeast1` |
| CPU | 2 | 2 |
| Memory | 4Gi | 4Gi |
| Concurrency | 20 | 20, capped by Supabase pool limits |
| Min instances | 3 | 3 initially, raise only with budget approval |
| Max instances | 10 | 10 under current trial quota, raise after quota increase plus DB/load test |
| Timeout | 300s web/internal routes, with app-level bounds on sync jobs | 300s web/internal routes, jobs/tasks for long sync after load evidence |
| Port | `8080` via `PORT` | `8080` via `PORT` |
| Startup CPU boost | on | on |
| CPU allocation | request-based for web | request-based for web; jobs can use always-on semantics |
| Health | `/api/health`, `/api/health/ready` | same |

12. Configure Cloud Scheduler for bounded launch jobs:
    - upcoming racecard sync every 5 minutes
    - result sync hourly
    - listing/media/notification maintenance on bounded schedules
    - move archive/backfill workloads to Cloud Run Jobs before routine operation
13. Monitoring/logging:
    - uptime checks for `/api/health` and `/api/health/ready`
    - alert on 5xx rate, latency, readiness 503, container crashes, task failure, feed stale, error budget burn
14. Budget alerts:
    - 50%, 75%, 90%, 100% monthly budget
    - cap Cloud Run max instances until launch day
15. Domain:
    - create Cloud DNS zone or configure registrar DNS
    - create global external HTTPS load balancer with serverless NEG
    - managed cert for `www.greyhoundsiq.com.au`
    - redirect apex `greyhoundsiq.com.au` to `www.greyhoundsiq.com.au`
    - staging cert/domain for `staging.greyhoundsiq.com.au`
16. HTTPS:
    - use managed cert
    - verify before DNS cutover
17. Optional Cloud Armor:
    - rate limiting for abusive paths
    - WAF managed rules in preview mode first
18. IaC:
    - create Terraform after manual spike validates exact service list
    - use remote state with locked access

## H. Supabase Setup Checklist

1. Create/confirm `greyhoundiq-staging`.
2. Create/confirm `greyhoundiq-prod`.
3. Set separate database passwords, API keys, JWT settings, and service-role keys.
4. Use transaction pooler URLs for app runtime:
   - `pgbouncer=true`
   - `sslmode=require`
   - low `connection_limit`
5. Keep direct/session URL out of app runtime. Use only for approved migration workflows if needed.
6. Apply staging migrations:
   ```bash
   npx prisma validate
   npx prisma migrate deploy
   ```
7. Seed staging only when desired:
   ```bash
   npm run db:seed
   ```
8. Never seed production.
9. Review storage migration `20260630170000_supabase_storage` and RLS policies.
10. Buckets:
    - `site-assets`: public
    - `public-user-media`: public-read
    - `private-user-media`: private
11. Configure WorkOS Third-Party Auth in each Supabase project if storage RLS depends on WorkOS JWT.
12. Verify anon key is safe for browser usage and RLS blocks unauthorized writes.
13. Rotate service-role keys before launch if they have been exposed in local logs or tooling.
14. Enable production backups/PITR where plan supports it.
15. Test restore into staging.
16. Promote migration process:
    - migration reviewed
    - staging applied
    - smoke tested
    - backup timestamp recorded
    - production approval
    - production migrate deploy
    - post-migration smoke

## I. Launch Readiness Checklist

- Load test complete against staging Cloud Run.
- Marketplace search benchmark complete against staging with representative listings:
  ```bash
  npm run benchmark:marketplace-search
  ```
- Race-day traffic simulation complete.
- Supabase connection/pool limits tested with target Cloud Run concurrency and max instances.
- Uptime checks live.
- Error alerts live.
- Budget alerts live.
- Database backups enabled and verified.
- Restore drill completed into staging.
- DNS records verified.
- SSL certificate active.
- Apex redirect to `www` verified.
- WorkOS sign-up, login, logout, callback, session expiry, protected routes verified.
- Lago billing health, webhook signature, plans, entitlements, invoices, and replay process verified if pricing is live.
- Responsible-use and not-wagering copy verified.
- Mobile racecard, dog profile, listing, messages, account, and pricing flows tested.
- Storage upload, signed private download, delete, and abandoned upload cleanup tested.
- Notification delivery route tested in disabled mode and, if a provider is configured, webhook delivery mode.
- Live race update sync tested.
- Feed failure fallback tested.
- Cloud Run revision rollback tested.
- Production migration dry-run reviewed.
- Seed/reset production blockers tested.
- Incident contacts and private runbook confirmed.

## J. Implementation Plan

| Phase | Tasks | Commands/files | Acceptance | Rollback | Risks |
|---|---|---|---|---|---|
| 1. Discovery and audit | Complete this plan, confirm current workflows, envs, DB scripts, provider paths. | `docs/gcp-cloud-run-migration-plan.md` | Plan reviewed and blockers accepted. | No runtime change. | Existing docs still mention VPS; update after direction confirmed. |
| 2. Local Docker readiness | Add root Dockerfile and `.dockerignore`; decide `next start` vs Next standalone after reading Next 16 docs. | `Dockerfile`, `.dockerignore`, maybe `next.config.ts` | `docker build` and local container health pass. | Delete Docker files. | Next 16 output behavior differs from older assumptions. |
| 3. Supabase hardening | Split staging/prod, remove prod seed path, add seed guard, add dangerous command CI gate. | `.github/workflows/supabase-migrate.yml`, optional guard script | Production seed/reset impossible through CI. | Revert workflow change only if alternate guard exists. | Human-operated scripts can still target wrong DB unless guarded. |
| 4. GCP staging deployment | Create staging Cloud Run, Artifact Registry, Secret Manager, WIF, staging secrets. | `gcloud`, Terraform later | Staging Cloud Run passes smoke with staging Supabase. | Remove staging service/secrets. | Missing env or WorkOS redirect mismatch. |
| 5. CI/CD pipeline | Add GitHub Actions build image, deploy staging, scan image, SBOM. | `.github/workflows/cloud-run-*.yml` | Image built once; staging deploy uses digest; checks pass. | Disable workflow. | IAM/WIF claim mistakes. |
| 6. Production infrastructure | Create prod Cloud Run, prod secrets, prod SA, load balancer, cert, monitoring. | GCP console/gcloud/Terraform | Prod service reachable on temporary LB/run URL, no domain cutover yet. | Scale prod to zero/delete service. | Prod secret misbinding; avoid by separate SAs. |
| 7. Domain cutover | Configure DNS and `www.greyhoundsiq.com.au`, apex redirect. | Cloud DNS/registrar/ALB | SSL green, smoke tests green, old preview not production. | Revert DNS TTL/records. | DNS propagation delay. |
| 8. Load testing | Run staging load tests for race-day and auth/media paths. | k6/Artillery later | p95/p99 and error rates within SLO; DB pool stable. | Lower max instances/concurrency. | Load test can hit paid APIs; use staging feed mocks where possible. |
| 9. Launch | Promote reviewed image digest, apply approved prod migrations, switch domain. | GitHub manual prod deploy, `prisma migrate deploy` | Launch checklist complete. | Cloud Run traffic rollback; no DB rollback except approved restore. | Migration defects; mitigate with staging and backups. |
| 10. Post-launch monitoring | Watch alerts, logs, feed freshness, billing webhooks, DB pool. | Cloud Monitoring dashboards | No unresolved P1/P2 launch issues after first race-day window. | Pause jobs, rollback app revision, scale caps. | Spikes and external feed instability. |

## K. Current Deployment Status

Verified on 2026-07-04:

- `greyhoundsiq.com.au` and `www.greyhoundsiq.com.au` resolve to the Google HTTPS load balancer.
- The Google-managed certificate for `greyhoundsiq.com.au` and `www.greyhoundsiq.com.au` is active.
- `greyhoundiq-web-staging` is serving the domain and `/api/health/ready` returns `200` with database readiness OK.
- `greyhoundiq-web-staging` revision `greyhoundiq-web-staging-00021-7dd` is serving 100% traffic with 2 CPU, 4Gi memory, min 3 instances, max 10 instances, concurrency 20, and startup CPU boost.
- A 4 CPU, 4Gi, max 20 profile was rejected by the current `australia-southeast1` Cloud Run quota. Current regional quota allows 20 allocated CPU and 40Gi allocated memory, so the active profile keeps max scale within quota while improving warm capacity and reducing per-instance request queuing.
- Deploy wiring creates or updates Cloud Scheduler jobs for staging live sync, listing maintenance, media maintenance, and notification delivery:
  - `greyhoundiq-staging-live-sync-upcoming`
  - `greyhoundiq-staging-live-sync-results`
  - `greyhoundiq-staging-listing-maintenance`
  - `greyhoundiq-staging-media-maintenance`
  - `greyhoundiq-staging-notification-delivery`
- The PowerShell and GitHub Actions Cloud Run deploy paths route traffic to the latest deployed web/scanner revisions so rollback drills do not leave future deploys pinned to old revisions.
- The GitHub Actions Cloud Run deploy path runs from `workflow_run` after `CI` succeeds, while manual `workflow_dispatch` remains available for approved staging/prod releases.
- The app image includes ClamAV tooling and `/api/internal/media-maintenance` supports `MEDIA_SCAN_MODE=clamav`. Maintenance refreshes due definitions with `freshclam` as the non-root app user, re-checks the installed timestamp, and stops scanning when definitions exceed the configured maximum age.
- Cloud Run deploy wiring keeps `greyhoundiq-web-{env}` at `MEDIA_SCAN_MODE=disabled` and deploys `greyhoundiq-media-scanner-{env}` as a private 4Gi scanner service. The PowerShell deploy script points the media maintenance scheduler job at that scanner service with OIDC plus the existing internal secret header.
- The PowerShell and GitHub Actions Cloud Run deploy paths now require enabled Secret Manager versions for `greyhoundiq-{env}-SUPABASE_URL` and `greyhoundiq-{env}-SUPABASE_SERVICE_ROLE_KEY` before deploying the ClamAV scanner path, and the GitHub Actions path maps the LiveKit secrets required by call token issuance.
- Runtime service accounts now have Secret Manager access only on their own environment-prefixed secrets instead of project-wide `roles/secretmanager.secretAccessor`. Project IAM now leaves `giq-web-staging` and `giq-web-prod` with only log/metric writer roles at project scope; secret-level checks confirm staging runtime access to staging secrets and prod runtime access to prod secrets.
- A service-account key audit found no user-managed service account keys. The only primitive role binding found in project IAM is Daniel's user-level `roles/owner`.
- `.github/workflows/supabase-migrate.yml` blocks production seed, and `prisma/seed.ts` blocks destructive seed execution unless the target is local or explicitly approved with `GREYHOUNDIQ_ALLOW_DESTRUCTIVE_SEED=true`.
- `npm run check:production-safety` verifies production seed blockers, CI local seed database use, destructive workflow command absence, CI-gated Cloud Run deploy triggering, Cloud Run tuned min-instance/concurrency/startup-boost settings, scanner Supabase secret preflights, LiveKit secret mapping, and that CI includes migration, call-token, marketplace-safety, and visibility-policy gates. The check is part of `npm run ci`.
- Root `Dockerfile`, `.dockerignore`, `cloudbuild.yaml`, Cloud Run deploy workflow, and Cloud Run PowerShell/Cloud Shell scripts are present.
- Legacy preview-hosting workflows/config/docs have been removed from the current worktree.
- Staging migrations are applied through `20260703184000_add_banned_phrases`; `prisma migrate status` reports the staging database is up to date.
- Staging smoke against `https://greyhoundsiq.com.au` passed after the latest deploy and again after runtime Secret Manager IAM was narrowed.
- Marketplace search benchmark against staging passed with p95 `160.0ms` on 13 indexed rows.
- A bounded public endpoint probe against `/`, `/races`, `/feed`, `/listings`, and `/api/health/ready` returned `200` for all 25 requests. `/races` remained the slowest public page, with low TTFB but multi-second total download/render response timing, so the next performance pass should target the races payload/query path rather than only increasing Cloud Run quota.
- `npm run test:staging-load` now provides a bounded no-dependency load probe with per-request timeout handling. After routing the tuned `00020-pr9` profile live and warming public read paths, public mode passed against `https://greyhoundsiq.com.au` with 12 iterations per endpoint and concurrency 3: ready p50/p95 `424/606ms`, feed health `23/28ms`, browse listings API `24/29ms`, listings page `204/1521ms`, and feed page `330/837ms`. Authenticated chat/upload/call-token probes require `LOAD_TEST_COOKIE`, target IDs, and explicit mutation opt-in.
- Live feed health is configured with active provider `thedogs+watchdog`, no blockers, and current staging data including 60 upcoming meetings, 696 upcoming races, 5,608 upcoming runners, and 405,430 results.
- Watchdog YouTube replay records now render as embedded `youtube-nocookie.com` iframes on race pages. A known staging race page returned `200` and contained the expected YouTube embed after the `00018-f7g` deploy.
- `npm run check:calls` verifies call-token authorization uses active, non-stale room membership with `canJoin=true` and validates the short-lived LiveKit JWT claims with a fake signing secret. The check is part of `npm run ci`.
- `npm run check:marketplace-safety` verifies dog listing welfare/legal acknowledgement enforcement and marketplace media rules: public bucket only, image/video only, max 10 images, and max 1 video. The check is part of `npm run ci`.
- `npm run test:smoke` now verifies unauthenticated denial for conversations, conversation create, listing create, media upload signing, call room create, and call token routes; live smoke passed against `https://greyhoundsiq.com.au` after the staging internal scheduler secret rotation.
- `npm run check:visibility-policies` guards message soft-delete visibility, received-message-only reporting, approved-listing public media, blocked-author feed comment filtering, and no public URL being stored/returned for pending user uploads. The check is part of `npm run ci`.
- Notification delivery is intentionally in-app-only for the first release. Staging has no notification webhook secrets configured, and `/api/internal/notification-delivery` returned `200` with `mode=disabled` and no pending work on `https://greyhoundsiq.com.au`.
- Staging internal scheduler secret was rotated after the media scheduler URI correction. `greyhoundiq-media-scanner-staging` revision `greyhoundiq-media-scanner-staging-00004-nxg` is serving 100% traffic, and `greyhoundiq-staging-media-maintenance` now targets the private scanner URL with OIDC audience/service account set to the scanner service.
- Secret Manager has no enabled versions for staging/prod `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`, so real Supabase Storage object scanning is blocked until those secret versions are loaded. Local env inspection found only `.env.selfhost.local` values for these keys, and its Supabase URL is local/self-host, so those values were not copied into staging or prod.
- `greyhoundsiq.com.au` currently serves the staging Cloud Run service through the Google HTTPS load balancer. `staging.greyhoundsiq.com.au` does not currently resolve, so this is the documented trial exception until a separate staging hostname is configured or apex is promoted to production.
- LiveKit POC infrastructure is running on GCE host `greyhoundiq-docker-host` in `australia-southeast1-b` with Docker `20.10.24`, `docker-compose` `1.29.2`, Caddy, and `livekit/livekit-server:1.13.3`. `livekit.greyhoundsiq.com.au` resolves to `34.40.149.239`, HTTPS returns `200`, and unauthenticated `/rtc/validate` returns `401`.
- Cloud Monitoring now has an enabled email notification channel, an uptime check for `/api/health/ready`, and enabled alert policies for staging readiness failure and Cloud Run 5xx responses. Billing already has a `GreyhoundIQ monthly guardrail` budget configured.
- Cloud Run rollback drill passed on staging: traffic was routed from `greyhoundiq-web-staging-00014-kmz` to previous ready revision `greyhoundiq-web-staging-00013-kqz`, smoke passed, then traffic was restored to `00014-kmz` and smoke passed again.
- Current launch scheduler paths are bounded and do not need Cloud Tasks/Run Jobs before launch: live sync has `maxDuration=300` and validates `days<=7`, listing maintenance is set-based, notification delivery batches 50 rows, and media maintenance batches 100 rows on the private scanner service with a 900s deadline. Archive/backfill imports remain operator workloads until they are moved to Cloud Run Jobs with GCS manifests.
- Staging schema-only restore drill passed: `pg_dump` from the staging `DATABASE_URL` using Postgres 17 client restored into a disposable local Supabase Postgres 17 database, created 93 public tables, verified `_prisma_migrations`, and removed the disposable restore database.
- GCS staging/prod `media-processing`, `exports`, and `backups` buckets exist in `australia-southeast1` with uniform bucket-level access and public access prevention enforced. Staging/prod `media-processing` buckets now have a 7-day delete lifecycle rule; backups intentionally have no auto-delete until retention policy is approved.

Remaining blockers before any production Cloud Run launch:

1. Load and confirm separate Supabase staging/prod storage credentials in Secret Manager, especially `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. Verify the dedicated ClamAV scanner service in staging with real uploads, virus definition evidence, and scanner logs before allowing public media attachments in production.
3. Complete authenticated load testing for chat/upload/call-token paths with staging test accounts and a full Supabase data/PITR restore drill before production cutover.
4. Configure a separate staging hostname before promoting apex to production, or explicitly approve using the current apex-domain staging exception during the trial period.
