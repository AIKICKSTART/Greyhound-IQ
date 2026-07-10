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
      --message-body='{}' --attempt-deadline="$deadline"
  else
    gcloud scheduler jobs create http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' --attempt-deadline="$deadline"
  fi
}

# create-or-update a job that also carries an OIDC token (media scanner requires
# IAM invoker in addition to the header secret)
upsert_oidc() {
  local name="$1" uri="$2" sched="$3" secret="$4" sa="$5" aud="$6"
  if job_exists "$name"; then
    gcloud scheduler jobs update http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --update-headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' \
      --oidc-service-account-email="$sa" --oidc-token-audience="$aud"
  else
    gcloud scheduler jobs create http "$name" --project="$PROJECT" --location="$LOC" \
      --schedule="$sched" --uri="$uri" --http-method=POST \
      --headers="Content-Type=application/json,x-internal-secret=$secret" \
      --message-body='{}' \
      --oidc-service-account-email="$sa" --oidc-token-audience="$aud"
  fi
}

echo "== Prod job set (prod domain, prod secret) =="
upsert_http greyhoundiq-prod-live-sync-results     "$PROD_DOMAIN/api/internal/live-sync?scope=results"           "7 * * * *"   "$PROD_SECRET"
upsert_http greyhoundiq-prod-aggregate-refresh     "$PROD_DOMAIN/api/internal/aggregate-refresh"                 "20 * * * *"  "$PROD_SECRET" "900s"
upsert_http greyhoundiq-prod-listing-maintenance   "$PROD_DOMAIN/api/internal/listing-expiry"                    "17 * * * *"  "$PROD_SECRET"
upsert_http greyhoundiq-prod-live-sync-upcoming    "$PROD_DOMAIN/api/internal/live-sync?scope=upcoming&days=31"  "*/5 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-notification-delivery "$PROD_DOMAIN/api/internal/notification-delivery"             "*/5 * * * *" "$PROD_SECRET"
upsert_http greyhoundiq-prod-call-maintenance      "$PROD_DOMAIN/api/internal/call-maintenance"                  "*/5 * * * *" "$PROD_SECRET"
upsert_oidc greyhoundiq-prod-media-maintenance     "$PROD_SCANNER/api/internal/media-maintenance"                "*/5 * * * *" "$PROD_SECRET" "$PROD_INVOKER_SA" "$PROD_SCANNER"

echo "== Repoint staging jobs at staging URL (staging secret) =="
upsert_http greyhoundiq-staging-live-sync-results     "$STAGING_URL/api/internal/live-sync?scope=results"           "7 * * * *"   "$STAGING_SECRET"
upsert_http greyhoundiq-staging-aggregate-refresh     "$STAGING_URL/api/internal/aggregate-refresh"                 "20 * * * *"  "$STAGING_SECRET" "900s"
upsert_http greyhoundiq-staging-listing-maintenance   "$STAGING_URL/api/internal/listing-expiry"                    "17 * * * *"  "$STAGING_SECRET"
upsert_http greyhoundiq-staging-live-sync-upcoming    "$STAGING_URL/api/internal/live-sync?scope=upcoming&days=31"  "*/5 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-notification-delivery "$STAGING_URL/api/internal/notification-delivery"             "*/5 * * * *" "$STAGING_SECRET"
upsert_http greyhoundiq-staging-call-maintenance      "$STAGING_URL/api/internal/call-maintenance"                  "*/5 * * * *" "$STAGING_SECRET"
# staging-media-maintenance already correctly targets the staging scanner via OIDC; left as-is.

echo "Scheduler sync complete."
