param(
  [string]$ProjectId = "",
  [string]$Region = "australia-southeast1",
  [string]$Zone = "australia-southeast1-b",
  [string]$Repository = "greyhoundiq",
  [string]$DockerHostName = "greyhoundiq-docker-host",
  [string[]]$Environments = @("staging", "prod")
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Add-GcloudToPath {
  $paths = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin"
  )
  foreach ($path in $paths) {
    $candidate = Join-Path $path "gcloud.cmd"
    if (Test-Path $candidate) {
      $env:PATH = "$path;$env:PATH"
      $script:GcloudCmd = $candidate
      return
    }
  }
  $script:GcloudCmd = "gcloud"
}

function Invoke-Gcloud {
  & $script:GcloudCmd @args
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud command failed: gcloud $($args -join ' ')"
  }
}

function Gcloud-Value {
  try {
    $value = & $script:GcloudCmd @args 2>$null
  } catch {
    return ""
  }
  if ($LASTEXITCODE -ne 0) { return "" }
  return ($value | Select-Object -First 1)
}

function Gcloud-ConfigValue {
  param([string]$Section, [string]$Name)

  $json = & $script:GcloudCmd config list --format=json 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $json) { return "" }
  $config = $json | ConvertFrom-Json
  return $config.$Section.$Name
}

function Gcloud-ActiveAccount {
  $json = & $script:GcloudCmd auth list --format=json 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $json) { return "" }
  $accounts = $json | ConvertFrom-Json
  return ($accounts | Select-Object -First 1).account
}

function Ensure-Account {
  $account = Gcloud-ActiveAccount
  if (-not $account) {
    throw "No active gcloud account. Run: gcloud auth login"
  }
}

function Ensure-Project {
  if (-not $ProjectId) {
    $script:ProjectId = Gcloud-ConfigValue "core" "project"
  }
  if (-not $ProjectId) {
    throw "No GCP project selected. Pass -ProjectId or run: gcloud config set project PROJECT_ID"
  }
  Invoke-Gcloud config set project $ProjectId --quiet
}

function Ensure-ServiceAccount {
  param(
    [string]$AccountId,
    [string]$DisplayName
  )

  $email = "$AccountId@$ProjectId.iam.gserviceaccount.com"
  $exists = Gcloud-Value iam service-accounts describe $email "--format=value(email)"
  if (-not $exists) {
    Invoke-Gcloud iam service-accounts create $AccountId "--display-name=$DisplayName" --project $ProjectId
  }
  return $email
}

function Ensure-ProjectRole {
  param(
    [string]$Member,
    [string]$Role
  )

  Invoke-Gcloud projects add-iam-policy-binding $ProjectId "--member=$Member" "--role=$Role" "--condition=None" --quiet | Out-Null
}

function Ensure-SecretShell {
  param([string]$Name)

  $exists = Gcloud-Value secrets describe $Name "--format=value(name)"
  if (-not $exists) {
    Invoke-Gcloud secrets create $Name --replication-policy=automatic --project $ProjectId
  }
}

function Ensure-SecretAccessor {
  param(
    [string]$SecretName,
    [string]$Member
  )

  Invoke-Gcloud secrets add-iam-policy-binding $SecretName "--member=$Member" "--role=roles/secretmanager.secretAccessor" --project $ProjectId --quiet | Out-Null
}

function Ensure-Bucket {
  param([string]$Name)

  try {
    $exists = & $script:GcloudCmd storage buckets describe "gs://$Name" --project $ProjectId 2>$null
  } catch {
    $exists = ""
  }
  if ($LASTEXITCODE -ne 0 -or -not $exists) {
    Invoke-Gcloud storage buckets create "gs://$Name" "--location=$Region" --uniform-bucket-level-access --project $ProjectId
  }
  Invoke-Gcloud storage buckets update "gs://$Name" --public-access-prevention --project $ProjectId
}

function Ensure-MediaProcessingLifecycle {
  param([string]$Name)

  $path = Join-Path $env:TEMP "greyhoundiq-media-processing-lifecycle.json"
  @'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 7 }
    }
  ]
}
'@ | Set-Content -LiteralPath $path -Encoding utf8
  try {
    Invoke-Gcloud storage buckets update "gs://$Name" "--lifecycle-file=$path" --project $ProjectId
  } finally {
    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  }
}

Add-GcloudToPath
Ensure-Account
Ensure-Project

$services = @(
  "run.googleapis.com",
  "artifactregistry.googleapis.com",
  "secretmanager.googleapis.com",
  "cloudbuild.googleapis.com",
  "iamcredentials.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "cloudscheduler.googleapis.com",
  "cloudtasks.googleapis.com",
  "storage.googleapis.com",
  "certificatemanager.googleapis.com",
  "dns.googleapis.com",
  "compute.googleapis.com"
)
Invoke-Gcloud services enable @services --project $ProjectId

$repoExists = Gcloud-Value artifacts repositories describe $Repository "--location=$Region" "--format=value(name)" --project $ProjectId
if (-not $repoExists) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $repoCreate = & $script:GcloudCmd artifacts repositories create $Repository `
      --repository-format=docker `
      "--location=$Region" `
      --description="GreyhoundIQ container images" `
      --project $ProjectId 2>&1
    $repoCreateExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($repoCreateExitCode -ne 0 -and ($repoCreate -notmatch "ALREADY_EXISTS")) {
    throw $repoCreate
  }
}

$buildSa = Ensure-ServiceAccount "giq-build" "GreyhoundIQ image build"
Ensure-ProjectRole "serviceAccount:$buildSa" "roles/cloudbuild.builds.editor"
Ensure-ProjectRole "serviceAccount:$buildSa" "roles/artifactregistry.writer"

$projectNumber = Gcloud-Value projects describe $ProjectId "--format=value(projectNumber)"
if ($projectNumber) {
  $computeDefaultSa = "serviceAccount:$projectNumber-compute@developer.gserviceaccount.com"
  Ensure-ProjectRole $computeDefaultSa "roles/cloudbuild.builds.builder"
  Ensure-ProjectRole $computeDefaultSa "roles/artifactregistry.writer"
  Ensure-ProjectRole $computeDefaultSa "roles/storage.objectViewer"
}

foreach ($envName in $Environments) {
  $runtimeSa = Ensure-ServiceAccount "giq-web-$envName" "GreyhoundIQ Cloud Run $envName runtime"
  $deploySa = Ensure-ServiceAccount "giq-deploy-$envName" "GreyhoundIQ Cloud Run $envName deploy"

  Ensure-ProjectRole "serviceAccount:$runtimeSa" "roles/logging.logWriter"
  Ensure-ProjectRole "serviceAccount:$runtimeSa" "roles/monitoring.metricWriter"
  Ensure-ProjectRole "serviceAccount:$deploySa" "roles/run.admin"
  Ensure-ProjectRole "serviceAccount:$deploySa" "roles/artifactregistry.reader"
  Invoke-Gcloud iam service-accounts add-iam-policy-binding $runtimeSa `
    "--member=serviceAccount:$deploySa" `
    "--role=roles/iam.serviceAccountUser" `
    --project $ProjectId | Out-Null

  $secretNames = @(
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXTAUTH_SECRET",
    "AUTH_SECRET",
    "REPLAY_PROXY_SECRET",
    "WORKOS_CLIENT_ID",
    "WORKOS_API_KEY",
    "WORKOS_COOKIE_PASSWORD",
    "LAGO_API_KEY",
    "LAGO_WEBHOOK_SECRET",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_PRICE_PRO_PLUS_MONTHLY",
    "STRIPE_PRICE_PRO_PLUS_YEARLY",
    "INTERNAL_API_SECRET",
    "CRON_SECRET",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "NOTIFICATION_WEBHOOK_URL",
    "NOTIFICATION_WEBHOOK_SECRET"
  )

  foreach ($secretName in $secretNames) {
    $fullSecretName = "greyhoundiq-$envName-$secretName"
    Ensure-SecretShell $fullSecretName
    Ensure-SecretAccessor $fullSecretName "serviceAccount:$runtimeSa"
  }

  foreach ($suffix in @("media-processing", "exports", "backups")) {
    $bucketName = "$ProjectId-greyhoundiq-$envName-$suffix"
    Ensure-Bucket $bucketName
    if ($suffix -eq "media-processing") {
      Ensure-MediaProcessingLifecycle $bucketName
    }
  }
}

$dockerSa = Ensure-ServiceAccount "giq-docker-host" "GreyhoundIQ Docker host"
Ensure-ProjectRole "serviceAccount:$dockerSa" "roles/artifactregistry.reader"
Ensure-ProjectRole "serviceAccount:$dockerSa" "roles/logging.logWriter"
Ensure-ProjectRole "serviceAccount:$dockerSa" "roles/monitoring.metricWriter"

$dockerHostExists = Gcloud-Value compute instances describe $DockerHostName "--zone=$Zone" "--format=value(name)"
function Write-DockerStartupScript {
  $path = Join-Path $env:TEMP "greyhoundiq-docker-startup.sh"
  $script = @'
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
'@
  Set-Content -LiteralPath $path -Value $script -Encoding ascii
  return $path
}

$startupScriptPath = Write-DockerStartupScript
if (-not $dockerHostExists) {

  Invoke-Gcloud compute instances create $DockerHostName `
    "--zone=$Zone" `
    --machine-type=e2-small `
    --image-family=debian-12 `
    --image-project=debian-cloud `
    --boot-disk-size=30GB `
    "--service-account=$dockerSa" `
    --scopes=https://www.googleapis.com/auth/cloud-platform `
    "--metadata-from-file=startup-script=$startupScriptPath" `
    --project $ProjectId
} else {
  Invoke-Gcloud compute instances add-metadata $DockerHostName `
    "--zone=$Zone" `
    "--metadata-from-file=startup-script=$startupScriptPath" `
    --project $ProjectId | Out-Null
}

function Test-DockerReady {
  try {
    $serialOutput = & $script:GcloudCmd compute instances get-serial-port-output $DockerHostName "--zone=$Zone" --project $ProjectId 2>$null
  } catch {
    return $false
  }
  $readyLine = $serialOutput | Select-String "greyhoundiq-docker-ready" | Select-Object -Last 1
  if ($readyLine) {
    $readyLine.Line
    return $true
  }
  return $false
}

$dockerReady = $false
for ($i = 0; $i -lt 24; $i++) {
  if (Test-DockerReady) {
    $dockerReady = $true
    break
  }
  Start-Sleep -Seconds 10
}

Write-Host "GCP bootstrap completed for project $ProjectId in $Region."
if (-not $dockerReady) {
  Write-Host "Docker host was created, but Docker readiness was not observed yet. Check serial logs for $DockerHostName in $Zone."
}
Write-Host "Secret shells were created without values. Add secret versions before deploying."
