#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-australia-southeast1}"
ZONE="${ZONE:-australia-southeast1-b}"
REPOSITORY="${REPOSITORY:-greyhoundiq}"
DOCKER_HOST_NAME="${DOCKER_HOST_NAME:-greyhoundiq-docker-host}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required. Example: PROJECT_ID=cosmic-reserve-500915-u1 bash scripts/gcp-cloud-run-bootstrap.sh" >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID" --quiet

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  storage.googleapis.com \
  certificatemanager.googleapis.com \
  dns.googleapis.com \
  compute.googleapis.com \
  --project "$PROJECT_ID"

ensure_sa() {
  local id="$1"
  local name="$2"
  local email="$id@$PROJECT_ID.iam.gserviceaccount.com"

  if ! gcloud iam service-accounts describe "$email" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$id" --display-name="$name" --project "$PROJECT_ID"
  fi

  printf '%s\n' "$email"
}

ensure_project_role() {
  local member="$1"
  local role="$2"

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$member" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
}

ensure_secret() {
  local name="$1"

  if ! gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic --project "$PROJECT_ID"
  fi
}

ensure_secret_accessor() {
  local name="$1"
  local member="$2"

  gcloud secrets add-iam-policy-binding "$name" \
    --member="$member" \
    --role=roles/secretmanager.secretAccessor \
    --project "$PROJECT_ID" \
    --quiet >/dev/null
}

ensure_bucket() {
  local name="$1"

  if ! gcloud storage buckets describe "gs://$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://$name" \
      --location="$REGION" \
      --uniform-bucket-level-access \
      --project "$PROJECT_ID"
  fi
}

ensure_media_processing_lifecycle() {
  local name="$1"
  local lifecycle_file
  lifecycle_file="$(mktemp)"
  cat >"$lifecycle_file" <<'JSON'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 7 }
    }
  ]
}
JSON
  gcloud storage buckets update "gs://$name" \
    --lifecycle-file="$lifecycle_file" \
    --project "$PROJECT_ID"
  rm -f "$lifecycle_file"
}

if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="GreyhoundIQ container images" \
    --project "$PROJECT_ID"
fi

build_sa="$(ensure_sa giq-build "GreyhoundIQ image build")"
ensure_project_role "serviceAccount:$build_sa" roles/cloudbuild.builds.editor
ensure_project_role "serviceAccount:$build_sa" roles/artifactregistry.writer

project_number="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
if [[ -n "$project_number" ]]; then
  compute_default_sa="serviceAccount:$project_number-compute@developer.gserviceaccount.com"
  ensure_project_role "$compute_default_sa" roles/cloudbuild.builds.builder
  ensure_project_role "$compute_default_sa" roles/artifactregistry.writer
  ensure_project_role "$compute_default_sa" roles/storage.objectViewer
fi

secret_names=(
  DATABASE_URL
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_JWT_SECRET
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXTAUTH_SECRET
  AUTH_SECRET
  REPLAY_PROXY_SECRET
  WORKOS_CLIENT_ID
  WORKOS_API_KEY
  WORKOS_COOKIE_PASSWORD
  LAGO_API_KEY
  LAGO_WEBHOOK_SECRET
  STRIPE_SECRET_KEY
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_PRO_MONTHLY
  STRIPE_PRICE_PRO_YEARLY
  INTERNAL_API_SECRET
  CRON_SECRET
  LIVEKIT_URL
  LIVEKIT_API_KEY
  LIVEKIT_API_SECRET
  NOTIFICATION_WEBHOOK_URL
  NOTIFICATION_WEBHOOK_SECRET
)

for env_name in staging prod; do
  runtime_sa="$(ensure_sa "giq-web-$env_name" "GreyhoundIQ Cloud Run $env_name runtime")"
  deploy_sa="$(ensure_sa "giq-deploy-$env_name" "GreyhoundIQ Cloud Run $env_name deploy")"

  ensure_project_role "serviceAccount:$runtime_sa" roles/logging.logWriter
  ensure_project_role "serviceAccount:$runtime_sa" roles/monitoring.metricWriter
  ensure_project_role "serviceAccount:$deploy_sa" roles/run.admin
  ensure_project_role "serviceAccount:$deploy_sa" roles/artifactregistry.reader

  gcloud iam service-accounts add-iam-policy-binding "$runtime_sa" \
    --member="serviceAccount:$deploy_sa" \
    --role=roles/iam.serviceAccountUser \
    --project "$PROJECT_ID" \
    --quiet >/dev/null

  for secret_name in "${secret_names[@]}"; do
    full_secret_name="greyhoundiq-$env_name-$secret_name"
    ensure_secret "$full_secret_name"
    ensure_secret_accessor "$full_secret_name" "serviceAccount:$runtime_sa"
  done

  for suffix in media-processing exports backups; do
    bucket_name="$PROJECT_ID-greyhoundiq-$env_name-$suffix"
    ensure_bucket "$bucket_name"
    if [[ "$suffix" == "media-processing" ]]; then
      ensure_media_processing_lifecycle "$bucket_name"
    fi
  done
done

docker_sa="$(ensure_sa giq-docker-host "GreyhoundIQ Docker host")"
ensure_project_role "serviceAccount:$docker_sa" roles/artifactregistry.reader
ensure_project_role "serviceAccount:$docker_sa" roles/logging.logWriter
ensure_project_role "serviceAccount:$docker_sa" roles/monitoring.metricWriter

startup_script_file="$(mktemp)"
trap 'rm -f "$startup_script_file"' EXIT
cat >"$startup_script_file" <<'STARTUP'
#!/usr/bin/env bash
set -euxo pipefail
apt-get update
apt-get install -y ca-certificates curl gnupg docker.io
if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
else
  apt-get install -y docker-compose || true
fi
systemctl enable --now docker
usermod -aG docker debian || true
echo "greyhoundiq-docker-ready $(docker --version)" | tee /dev/console /var/log/greyhoundiq-docker-ready.log
STARTUP

if ! gcloud compute instances describe "$DOCKER_HOST_NAME" --zone="$ZONE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute instances create "$DOCKER_HOST_NAME" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --boot-disk-size=30GB \
    --service-account="$docker_sa" \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --metadata-from-file=startup-script="$startup_script_file" \
    --project "$PROJECT_ID"
else
  gcloud compute instances add-metadata "$DOCKER_HOST_NAME" \
    --zone="$ZONE" \
    --metadata-from-file=startup-script="$startup_script_file" \
    --project "$PROJECT_ID" >/dev/null
fi

echo "Waiting for Docker on $DOCKER_HOST_NAME..."
for _ in {1..24}; do
  serial_output="$(gcloud compute instances get-serial-port-output "$DOCKER_HOST_NAME" --zone="$ZONE" --project "$PROJECT_ID" 2>/dev/null || true)"
  if grep -q "greyhoundiq-docker-ready" <<<"$serial_output"; then
    grep "greyhoundiq-docker-ready" <<<"$serial_output" | tail -n 1
    echo "GCP bootstrap completed for $PROJECT_ID in $REGION."
    echo "Add Secret Manager versions before deploying the app."
    exit 0
  fi
  sleep 10
done

echo "GCP bootstrap completed, but Docker readiness was not observed yet."
echo "Check VM serial logs for $DOCKER_HOST_NAME in $ZONE."
