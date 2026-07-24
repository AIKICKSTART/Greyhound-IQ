#!/usr/bin/env bash
# GreyhoundIQ scheduler env-scoping (P6-C).
#
# Background: the original 6 "greyhoundiq-staging-*" jobs were misconfigured —
# 5 of them POSTed to the PROD domain (https://greyhoundsiq.com.au) while
# sending the STAGING x-internal-secret, so prod rejected them with 403 and
# staging had no cron coverage at all. This script:
#   1. creates a correct greyhoundiq-prod-* job set (prod domain, prod secret),
#   2. repoints the staging-* jobs at the staging Cloud Run URL (staging secret).
# No job is deleted. Re-running create for an existing job errors; update is
# idempotent, so the script tolerates partial prior runs.
#
# Auth model (src/lib/internal-auth.ts): internal routes accept the request if
# x-internal-secret (trimmed) matches INTERNAL_API_SECRET, INTERNAL_SECRET, or
# CRON_SECRET on the target service. Prod web runs INTERNAL_API_SECRET only, so
# prod jobs must send greyhoundiq-prod-INTERNAL_API_SECRET (its stored value has
# a UTF-8 BOM + trailing CRLF; .trim() strips both, hence the node trim below).
set -euo pipefail

PROJECT="cosmic-reserve-500915-u1"
LOC="australia-southeast1"
PROD_DOMAIN="https://greyhoundsiq.com.au"
PROD_SCANNER="https://greyhoundiq-media-scanner-prod-5wsnl4feuq-ts.a.run.app"
PROD_INVOKER_SA="giq-web-prod@cosmic-reserve-500915-u1.iam.gserviceaccount.com"
STAGING_INVOKER_SA="giq-web-staging@cosmic-reserve-500915-u1.iam.gserviceaccount.com"

STAGING_URL="$(gcloud run services describe greyhoundiq-web-staging \
  --project="$PROJECT" --region="$LOC" --format='value(status.url)')"
STAGING_SCANNER="$(gcloud run services describe greyhoundiq-media-scanner-staging \
  --project="$PROJECT" --region="$LOC" --format='value(status.url)')"

PROD_SECRET="$(node -e 'process.stdout.write(process.argv[1].trim())' \
  "$(gcloud secrets versions access latest --project="$PROJECT" \
     --secret=greyhoundiq-prod-INTERNAL_API_SECRET)")"
STAGING_SECRET="$(gcloud secrets versions access latest --project="$PROJECT" \
  --secret=greyhoundiq-staging-CRON_SECRET)"

job_exists() {
  gcloud scheduler jobs describe "$1" --project="$PROJECT" --location="$LOC" \
    >/dev/null 2>&1
}

# create-or-update a plain HTTP job (header-secret auth, no OIDC)
upsert_http() {
  local name="$1" uri="$2" sched="$3" secret="$4" deadline="${5:-300s}"
  if job_exists "$name"; then
    gcloud scheduler jobs update http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --update-headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' --attempt-deadline="$deadline" \
      --time-zone="Australia/Sydney" --max-retry-attempts=3 \
      --min-backoff=30s --max-backoff=120s --max-doublings=2
  else
    gcloud scheduler jobs create http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' --attempt-deadline="$deadline" \
      --time-zone="Australia/Sydney" --max-retry-attempts=3 \
      --min-backoff=30s --max-backoff=120s --max-doublings=2
  fi
}

# create-or-update a job that also carries an OIDC token (media scanner requires
# IAM invoker in addition to the header secret)
upsert_oidc() {
  local name="$1" uri="$2" sched="$3" secret="$4" sa="$5" aud="$6" deadline="${7:-900s}"
  if job_exists "$name"; then
    gcloud scheduler jobs update http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --update-headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' \
      --attempt-deadline="$deadline" --time-zone="Australia/Sydney" \
      --max-retry-attempts=3 --min-backoff=30s --max-backoff=120s --max-doublings=2 \
      --oidc-service-account-email="$sa" --oidc-token-audience="$aud"
  else
    gcloud scheduler jobs create http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' \
      --attempt-deadline="$deadline" --time-zone="Australia/Sydney" \
      --max-retry-attempts=3 --min-backoff=30s --max-backoff=120s --max-doublings=2 \
      --oidc-service-account-email="$sa" --oidc-token-audience="$aud"
  fi
}

echo "== Prod job set (prod domain, prod secret) =="
upsert_http greyhoundiq-prod-live-sync-results     "$PROD_DOMAIN/api/internal/live-sync?scope=results&days=1"    "*/5 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-live-sync-results-catchup "$PROD_DOMAIN/api/internal/live-sync?scope=results&days=2" "7 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-aggregate-refresh     "$PROD_DOMAIN/api/internal/aggregate-refresh"                 "20 * * * *"  "$PROD_SECRET" "840s"
upsert_http greyhoundiq-prod-listing-maintenance   "$PROD_DOMAIN/api/internal/listing-expiry"                    "17 * * * *"  "$PROD_SECRET"
upsert_http greyhoundiq-prod-live-sync-upcoming    "$PROD_DOMAIN/api/internal/live-sync?scope=upcoming&days=31"  "*/5 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-notification-delivery "$PROD_DOMAIN/api/internal/notification-delivery"             "*/5 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-usage-delivery        "$PROD_DOMAIN/api/internal/usage-delivery"                    "* * * * *"   "$PROD_SECRET" "180s"
upsert_http greyhoundiq-prod-call-maintenance      "$PROD_DOMAIN/api/internal/call-maintenance"                  "*/5 * * * *" "$PROD_SECRET"
upsert_oidc greyhoundiq-prod-media-maintenance     "$PROD_SCANNER/api/internal/media-maintenance"                "*/5 * * * *" "$PROD_SECRET" "$PROD_INVOKER_SA" "$PROD_SCANNER"
upsert_http greyhoundiq-prod-account-deletion      "$PROD_DOMAIN/api/internal/account-deletion"                  "37 * * * *"   "$PROD_SECRET"
upsert_http greyhoundiq-prod-agent-cleanup         "$PROD_DOMAIN/api/internal/agent-cleanup"                     "47 * * * *"   "$PROD_SECRET"
upsert_http greyhoundiq-prod-community-readiness   "$PROD_DOMAIN/api/internal/community-readiness"               "*/10 * * * *" "$PROD_SECRET" "180s"
upsert_http greyhoundiq-prod-dog-profile-sync      "$PROD_DOMAIN/api/internal/dog-profile-sync"                  "*/2 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-memory-decay          "$PROD_DOMAIN/api/internal/memory-decay"                      "11 3 * * *"   "$PROD_SECRET"

echo "== Repoint staging jobs at staging URL (staging secret) =="
upsert_http greyhoundiq-staging-live-sync-results     "$STAGING_URL/api/internal/live-sync?scope=results&days=1"    "*/5 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-live-sync-results-catchup "$STAGING_URL/api/internal/live-sync?scope=results&days=2" "7 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-aggregate-refresh     "$STAGING_URL/api/internal/aggregate-refresh"                 "20 * * * *"  "$STAGING_SECRET" "840s"
upsert_http greyhoundiq-staging-listing-maintenance   "$STAGING_URL/api/internal/listing-expiry"                    "17 * * * *"  "$STAGING_SECRET"
upsert_http greyhoundiq-staging-live-sync-upcoming    "$STAGING_URL/api/internal/live-sync?scope=upcoming&days=31"  "*/5 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-notification-delivery "$STAGING_URL/api/internal/notification-delivery"             "*/5 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-usage-delivery        "$STAGING_URL/api/internal/usage-delivery"                    "* * * * *"   "$STAGING_SECRET" "180s"
upsert_http greyhoundiq-staging-call-maintenance      "$STAGING_URL/api/internal/call-maintenance"                  "*/5 * * * *" "$STAGING_SECRET"
upsert_oidc greyhoundiq-staging-media-maintenance     "$STAGING_SCANNER/api/internal/media-maintenance"              "*/5 * * * *" "$STAGING_SECRET" "$STAGING_INVOKER_SA" "$STAGING_SCANNER"
upsert_http greyhoundiq-staging-account-deletion      "$STAGING_URL/api/internal/account-deletion"                  "37 * * * *"   "$STAGING_SECRET"
upsert_http greyhoundiq-staging-agent-cleanup         "$STAGING_URL/api/internal/agent-cleanup"                     "47 * * * *"   "$STAGING_SECRET"
upsert_http greyhoundiq-staging-community-readiness   "$STAGING_URL/api/internal/community-readiness"               "*/10 * * * *" "$STAGING_SECRET" "180s"
upsert_http greyhoundiq-staging-dog-profile-sync      "$STAGING_URL/api/internal/dog-profile-sync"                  "*/2 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-memory-decay          "$STAGING_URL/api/internal/memory-decay"                      "11 3 * * *"   "$STAGING_SECRET"

echo "Scheduler sync complete."
