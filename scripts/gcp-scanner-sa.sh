#!/usr/bin/env bash
# GreyhoundIQ media-scanner dedicated service accounts (P7-B).
#
# Before: both greyhoundiq-media-scanner-{staging,prod} ran as the shared
# giq-web-<env>@ SA (same identity as the public web service). This gives the
# scanner the web service's full blast radius. After: each scanner runs as its
# own giq-media-scanner-<env>@ SA holding only:
#   - secretmanager.secretAccessor on exactly the secrets that scanner mounts
#   - logging.logWriter + monitoring.metricWriter (Cloud Run runtime needs these;
#     the shared SA had them, so this is parity, not an escalation)
#
# The media-maintenance cron invokes the scanner with an OIDC token minted as
# giq-web-<env>@ (the CALLER identity). That invoker binding is unaffected by the
# scanner's RUNTIME SA, so no run.invoker change is needed here.
#
# DATABASE_URL is Supabase (external Postgres) reached via the mounted secret,
# not Cloud SQL, so no cloudsql.client / GCS roles are required.
#
# Rollback: gcloud run services update <svc> --service-account=giq-web-<env>@...
set -euo pipefail

PROJECT="cosmic-reserve-500915-u1"
LOC="australia-southeast1"

# Secret sets are derived from each scanner's live env at authoring time. If the
# scanner's mounted secrets change, re-derive with:
#   gcloud run services describe greyhoundiq-media-scanner-<env> --format=json \
#     | jq -r '.spec.template.spec.containers[0].env[]?.valueFrom.secretKeyRef.name' | sort -u
STAGING_SECRETS=(
  greyhoundiq-staging-AUTH_SECRET greyhoundiq-staging-CRON_SECRET
  greyhoundiq-staging-DATABASE_URL greyhoundiq-staging-INTERNAL_API_SECRET
  greyhoundiq-staging-LAGO_WEBHOOK_SECRET greyhoundiq-staging-LIVEKIT_API_KEY
  greyhoundiq-staging-LIVEKIT_API_SECRET greyhoundiq-staging-LIVEKIT_URL
  greyhoundiq-staging-NEXTAUTH_SECRET greyhoundiq-staging-NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  greyhoundiq-staging-NEXT_PUBLIC_SUPABASE_ANON_KEY greyhoundiq-staging-NEXT_PUBLIC_SUPABASE_URL
  greyhoundiq-staging-REALTIME_CHANNEL_SECRET greyhoundiq-staging-STRIPE_PRICE_PRO_MONTHLY
  greyhoundiq-staging-STRIPE_PRICE_PRO_YEARLY greyhoundiq-staging-STRIPE_SECRET_KEY
  greyhoundiq-staging-STRIPE_WEBHOOK_SECRET greyhoundiq-staging-SUPABASE_SERVICE_ROLE_KEY
  greyhoundiq-staging-SUPABASE_JWT_SECRET greyhoundiq-staging-SUPABASE_URL greyhoundiq-staging-WORKOS_API_KEY
  greyhoundiq-staging-WORKOS_CLIENT_ID greyhoundiq-staging-WORKOS_COOKIE_PASSWORD
)
PROD_SECRETS=(
  greyhoundiq-prod-AUTH_SECRET greyhoundiq-prod-DATABASE_URL
  greyhoundiq-prod-INTERNAL_API_SECRET greyhoundiq-prod-LIVEKIT_API_KEY
  greyhoundiq-prod-LIVEKIT_API_SECRET greyhoundiq-prod-LIVEKIT_URL
  greyhoundiq-prod-NEXTAUTH_SECRET greyhoundiq-prod-NEXT_PUBLIC_SUPABASE_ANON_KEY
  greyhoundiq-prod-NEXT_PUBLIC_SUPABASE_URL greyhoundiq-prod-REALTIME_CHANNEL_SECRET
  greyhoundiq-prod-SUPABASE_JWT_SECRET greyhoundiq-prod-SUPABASE_SERVICE_ROLE_KEY greyhoundiq-prod-SUPABASE_URL
  greyhoundiq-prod-WORKOS_API_KEY greyhoundiq-prod-WORKOS_CLIENT_ID
  greyhoundiq-prod-WORKOS_COOKIE_PASSWORD
)

setup_env() {
  local env="$1"; shift
  local secrets=("$@")
  local sa="giq-media-scanner-$env@$PROJECT.iam.gserviceaccount.com"
  local svc="greyhoundiq-media-scanner-$env"

  if ! gcloud iam service-accounts describe "$sa" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud iam service-accounts create "giq-media-scanner-$env" --project="$PROJECT" \
      --display-name="GreyhoundIQ media scanner ($env)" \
      --description="Dedicated runtime SA for $svc"
  fi

  for s in "${secrets[@]}"; do
    gcloud secrets add-iam-policy-binding "$s" --project="$PROJECT" \
      --member="serviceAccount:$sa" --role="roles/secretmanager.secretAccessor" \
      --condition=None >/dev/null
  done

  for role in roles/logging.logWriter roles/monitoring.metricWriter; do
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="serviceAccount:$sa" --role="$role" --condition=None >/dev/null
  done

  gcloud run services update "$svc" --project="$PROJECT" --region="$LOC" \
    --service-account="$sa"

  local ready
  ready="$(gcloud run services describe "$svc" --project="$PROJECT" --region="$LOC" \
    --format='value(status.conditions[0].status)')"
  echo "$svc Ready=$ready (SA=$sa)"
  [ "$ready" = "True" ] || { echo "WARNING: $svc not Ready — roll back with --service-account=giq-web-$env@$PROJECT.iam.gserviceaccount.com"; exit 1; }
}

setup_env staging "${STAGING_SECRETS[@]}"
setup_env prod "${PROD_SECRETS[@]}"
echo "Scanner SA migration complete."
