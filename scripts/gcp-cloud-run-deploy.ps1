param(
  [ValidateSet("staging", "prod")]
  [string]$Environment = "staging",
  [string]$ProjectId = "",
  [string]$Region = "australia-southeast1",
  [string]$Repository = "greyhoundiq",
  [string]$ServiceName = "",
  [string]$NextAuthUrl = "",
  [string]$NextPublicSupabaseUrl = "",
  [string]$NextPublicSupabaseAnonKey = "",
  [string]$NextPublicWorkosRedirectUri = "",
  [string]$NextPublicLivekitUrl = "",
  [string]$WorkosCookieDomain = "",
  [string]$LagoApiUrl = "",
  [string]$LagoFrontUrl = "",
  [switch]$SkipMediaScanner,
  [string]$MediaScannerServiceName = "",
  [string]$WebCpu = "2",
  [string]$WebMemory = "4Gi",
  [int]$WebConcurrency = 20,
  [int]$WebMinInstances = 3,
  [int]$WebMaxInstances = 10,
  [string]$Network = "default",
  [string]$Subnet = "default",
  [ValidateSet("metadata", "clamav")]
  [string]$MediaScannerMode = "clamav",
  [switch]$SkipSchedulerJobs,
  [ValidateSet("true", "false")]
  [string]$ActorConversationMultiplexEnabled = "false",
  [ValidateSet("true", "false", IgnoreCase = $false)]
  [string]$EnableDevicePreviews = "false",
  [ValidateSet("true", "false", IgnoreCase = $false)]
  [string]$SearchDisabled = "false",
  [ValidateSet("true", "false", IgnoreCase = $false)]
  [string]$UploadDisabled = "false",
  [ValidateSet("true", "false", IgnoreCase = $false)]
  [string]$ExportDisabled = "false",
  [ValidateSet("true", "false", IgnoreCase = $false)]
  [string]$AiDisabled = "false",
  [ValidateSet("true", "false", IgnoreCase = $false)]
  [string]$RealtimeBroadcastDisabled = "false",
  [string]$MediaScannerMemory = "4Gi",
  [switch]$AllowMissingSecrets
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

if ($Environment -eq "prod") {
  throw "Local production deployment is disabled. Promote an exact Design Lab-approved commit through the protected Cloud Run Deploy GitHub workflow."
}

function Add-GcloudToPath {
  $paths = @(
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin"
  )
  foreach ($path in $paths) {
    $candidate = Join-Path $path "gcloud.ps1"
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
    $summary = ($args | Select-Object -First 3) -join " "
    throw "gcloud command failed: gcloud $summary"
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

function DotEnv-Value {
  param([string]$Name)

  $fromEnv = [Environment]::GetEnvironmentVariable($Name)
  if ($fromEnv) { return $fromEnv }
  if (-not (Test-Path ".env")) { return "" }

  $line = Get-Content ".env" | Where-Object {
    $_ -match "^\s*$([regex]::Escape($Name))\s*="
  } | Select-Object -First 1
  if (-not $line) { return "" }

  $value = ($line -split "=", 2)[1].Trim()
  if (
    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
    ($value.StartsWith("'") -and $value.EndsWith("'"))
  ) {
    return $value.Substring(1, $value.Length - 2)
  }
  return $value
}

function Required-Value {
  param(
    [string]$Value,
    [string]$Name
  )

  if ($Value) { return $Value }
  throw "$Name is required. Pass it as a script parameter or set it in the environment."
}

function Test-LocalUrl {
  param([string]$Value)

  if (-not $Value) { return $false }
  try {
    $uri = [uri]$Value
    return $uri.Host -in @("localhost", "127.0.0.1", "::1")
  } catch {
    return $false
  }
}

function Get-SharedCookieDomain {
  param([string]$Value)

  if (-not $Value -or (Test-LocalUrl $Value)) { return "" }
  try {
    $uri = [uri]$Value
    if ($uri.Scheme -ne "https") { return "" }
    $host = $uri.Host.ToLowerInvariant()
    if ($host.EndsWith(".run.app")) { return "" }
    if ($host.StartsWith("www.")) { return $host.Substring(4) }
    return $host
  } catch {
    return ""
  }
}

function Secret-HasVersion {
  param([string]$Name)

  $version = Gcloud-Value secrets versions list $Name `
    "--filter=state:ENABLED" `
    "--format=value(name)" `
    "--limit=1" `
    --project $ProjectId
  return [bool]$version
}

function Secret-LatestValue {
  param([string]$Name)

  $value = & $script:GcloudCmd secrets versions access latest --secret $Name --project $ProjectId 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not access latest version for secret $Name."
  }
  return (($value | Out-String).Trim())
}

function Invoke-GcloudQuiet {
  & $script:GcloudCmd @args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud command failed."
  }
}

function Ensure-SchedulerJob {
  param(
    [string]$Name,
    [string]$Schedule,
    [string]$Uri,
    [string]$Description,
    [string]$CronSecret,
    [string]$AttemptDeadline = "300s",
    [int]$MaxRetryAttempts = 3,
    [string]$OidcServiceAccount = "",
    [string]$OidcAudience = ""
  )

  $oidcArgs = @()
  if ($OidcServiceAccount) {
    $oidcArgs += "--oidc-service-account-email=$OidcServiceAccount"
    if ($OidcAudience) {
      $oidcArgs += "--oidc-token-audience=$OidcAudience"
    }
  }

  $exists = Gcloud-Value scheduler jobs describe $Name "--location=$Region" "--format=value(name)" --project $ProjectId
  if ($exists) {
    Invoke-GcloudQuiet scheduler jobs update http $Name `
      "--location=$Region" `
      --project $ProjectId `
      "--schedule=$Schedule" `
      "--time-zone=Australia/Sydney" `
      "--uri=$Uri" `
      --http-method=POST `
      "--update-headers=x-internal-secret=$CronSecret" `
      "--attempt-deadline=$AttemptDeadline" `
      "--max-retry-attempts=$MaxRetryAttempts" `
      --min-backoff=30s `
      --max-backoff=120s `
      --max-doublings=2 `
      @oidcArgs `
      "--description=$Description" `
      --quiet
    return
  }

  Invoke-GcloudQuiet scheduler jobs create http $Name `
    "--location=$Region" `
    --project $ProjectId `
    "--schedule=$Schedule" `
    "--time-zone=Australia/Sydney" `
    "--uri=$Uri" `
    --http-method=POST `
    "--headers=x-internal-secret=$CronSecret" `
    "--attempt-deadline=$AttemptDeadline" `
    "--max-retry-attempts=$MaxRetryAttempts" `
    --min-backoff=30s `
    --max-backoff=120s `
    --max-doublings=2 `
    @oidcArgs `
    "--description=$Description" `
    --quiet
}

function Ensure-SchedulerJobs {
  param(
    [string]$MediaMaintenanceBaseUrl = "",
    [string]$MediaMaintenanceOidcServiceAccount = ""
  )

  $cronSecretName = "greyhoundiq-$Environment-CRON_SECRET"
  if (-not (Secret-HasVersion $cronSecretName)) {
    Write-Host "Skipping Cloud Scheduler jobs because $cronSecretName has no enabled version."
    return
  }

  $cronSecret = Secret-LatestValue $cronSecretName
  if ($cronSecret -notmatch "^[A-Za-z0-9._~-]+$") {
    throw "$cronSecretName must be URL-safe for Cloud Scheduler header setup."
  }

  $baseUrl = $NextAuthUrl.TrimEnd("/")
  $mediaMaintenanceBaseUrl = if ($MediaMaintenanceBaseUrl) {
    $MediaMaintenanceBaseUrl.TrimEnd("/")
  } else {
    $baseUrl
  }
  # ponytail: header auth is enough for launch staging; replace with OIDC JWT verification before stricter prod hardening.
  $jobs = @(
    @{
      Name = "greyhoundiq-$Environment-live-sync-upcoming"
      Schedule = "*/5 * * * *"
      Uri = "$baseUrl/api/internal/live-sync?scope=upcoming&days=31"
      Description = "GreyhoundIQ $Environment live race upcoming sync"
    },
    @{
      Name = "greyhoundiq-$Environment-live-sync-results"
      Schedule = "7 * * * *"
      Uri = "$baseUrl/api/internal/live-sync?scope=results"
      Description = "GreyhoundIQ $Environment live race result sync"
    },
    @{
      Name = "greyhoundiq-$Environment-aggregate-refresh"
      Schedule = "20 * * * *"
      Uri = "$baseUrl/api/internal/aggregate-refresh"
      Description = "GreyhoundIQ $Environment aggregate racing view refresh"
      AttemptDeadline = "840s"
    },
    @{
      Name = "greyhoundiq-$Environment-listing-maintenance"
      Schedule = "17 * * * *"
      Uri = "$baseUrl/api/internal/listing-expiry"
      Description = "GreyhoundIQ $Environment listing expiry maintenance"
    },
    @{
      Name = "greyhoundiq-$Environment-account-deletion"
      Schedule = "37 * * * *"
      Uri = "$baseUrl/api/internal/account-deletion"
      Description = "GreyhoundIQ $Environment account deletion maintenance"
    },
    @{
      Name = "greyhoundiq-$Environment-agent-cleanup"
      Schedule = "47 * * * *"
      Uri = "$baseUrl/api/internal/agent-cleanup"
      Description = "GreyhoundIQ $Environment stale agent-run cleanup"
    },
    @{
      Name = "greyhoundiq-$Environment-media-maintenance"
      Schedule = "*/5 * * * *"
      Uri = "$mediaMaintenanceBaseUrl/api/internal/media-maintenance"
      Description = "GreyhoundIQ $Environment pending media cleanup maintenance"
      AttemptDeadline = "900s"
      OidcServiceAccount = $MediaMaintenanceOidcServiceAccount
      OidcAudience = $mediaMaintenanceBaseUrl
    },
    @{
      Name = "greyhoundiq-$Environment-call-maintenance"
      Schedule = "*/5 * * * *"
      Uri = "$baseUrl/api/internal/call-maintenance"
      Description = "GreyhoundIQ $Environment call room and invite maintenance"
    },
    @{
      Name = "greyhoundiq-$Environment-community-readiness"
      Schedule = "*/10 * * * *"
      Uri = "$baseUrl/api/internal/community-readiness"
      Description = "GreyhoundIQ $Environment community dependency readiness"
      AttemptDeadline = "180s"
    },
    @{
      Name = "greyhoundiq-$Environment-notification-delivery"
      Schedule = "*/5 * * * *"
      Uri = "$baseUrl/api/internal/notification-delivery"
      Description = "GreyhoundIQ $Environment notification delivery maintenance"
    },
    @{
      Name = "greyhoundiq-$Environment-usage-delivery"
      Schedule = "* * * * *"
      Uri = "$baseUrl/api/internal/usage-delivery"
      Description = "GreyhoundIQ $Environment metered usage delivery"
      AttemptDeadline = "180s"
    },
    @{
      Name = "greyhoundiq-$Environment-dog-profile-sync"
      Schedule = "*/2 * * * *"
      Uri = "$baseUrl/api/internal/dog-profile-sync"
      Description = "GreyhoundIQ $Environment raced-dog profile completeness sync"
    },
    @{
      Name = "greyhoundiq-$Environment-memory-decay"
      Schedule = "11 3 * * *"
      Uri = "$baseUrl/api/internal/memory-decay"
      Description = "GreyhoundIQ $Environment memory relevance maintenance"
    }
  )

  foreach ($job in $jobs) {
    $attemptDeadline = "300s"
    if ($job.ContainsKey("AttemptDeadline") -and $job["AttemptDeadline"]) {
      $attemptDeadline = $job["AttemptDeadline"]
    }
    $oidcServiceAccount = ""
    if ($job.ContainsKey("OidcServiceAccount") -and $job["OidcServiceAccount"]) {
      $oidcServiceAccount = $job["OidcServiceAccount"]
    }
    $oidcAudience = ""
    if ($job.ContainsKey("OidcAudience") -and $job["OidcAudience"]) {
      $oidcAudience = $job["OidcAudience"]
    }

    Ensure-SchedulerJob `
      -Name $job["Name"] `
      -Schedule $job["Schedule"] `
      -Uri $job["Uri"] `
      -Description $job["Description"] `
      -CronSecret $cronSecret `
      -AttemptDeadline $attemptDeadline `
      -OidcServiceAccount $oidcServiceAccount `
      -OidcAudience $oidcAudience
  }
}

Add-GcloudToPath

if (-not (Gcloud-ActiveAccount)) {
  throw "No active gcloud account. Run: gcloud auth login"
}

if (-not $ProjectId) {
  $ProjectId = Gcloud-ConfigValue "core" "project"
}
if (-not $ProjectId) {
  throw "No GCP project selected. Pass -ProjectId or run: gcloud config set project PROJECT_ID"
}
Invoke-Gcloud config set project $ProjectId --quiet

if (-not $ServiceName) {
  $ServiceName = "greyhoundiq-web-$Environment"
}
if (-not $MediaScannerServiceName) {
  $MediaScannerServiceName = "greyhoundiq-media-scanner-$Environment"
}

if (-not $NextAuthUrl) {
  $NextAuthUrl = DotEnv-Value "NEXTAUTH_URL"
}
if (-not $NextPublicSupabaseUrl) {
  $NextPublicSupabaseUrl = DotEnv-Value "NEXT_PUBLIC_SUPABASE_URL"
}
if (-not $NextPublicSupabaseAnonKey) {
  $NextPublicSupabaseAnonKey = DotEnv-Value "NEXT_PUBLIC_SUPABASE_ANON_KEY"
}
if (-not $NextPublicWorkosRedirectUri) {
  $NextPublicWorkosRedirectUri = DotEnv-Value "NEXT_PUBLIC_WORKOS_REDIRECT_URI"
}
if (-not $NextPublicLivekitUrl) {
  $NextPublicLivekitUrl = DotEnv-Value "NEXT_PUBLIC_LIVEKIT_URL"
}
if (-not $LagoApiUrl) {
  $LagoApiUrl = DotEnv-Value "LAGO_API_URL"
}
if (-not $LagoFrontUrl) {
  $LagoFrontUrl = DotEnv-Value "LAGO_FRONT_URL"
}

$NextAuthUrl = Required-Value $NextAuthUrl "NEXTAUTH_URL"
$NextPublicSupabaseUrl = Required-Value $NextPublicSupabaseUrl "NEXT_PUBLIC_SUPABASE_URL"
$NextPublicSupabaseAnonKey = Required-Value $NextPublicSupabaseAnonKey "NEXT_PUBLIC_SUPABASE_ANON_KEY"
if (Test-LocalUrl $NextPublicSupabaseUrl) {
  throw "NEXT_PUBLIC_SUPABASE_URL must be a public Supabase URL for Cloud Run deploys."
}
$derivedWorkosRedirectUri = "$($NextAuthUrl.TrimEnd('/'))/callback"
if (
  -not $NextPublicWorkosRedirectUri -or
  ((Test-LocalUrl $NextPublicWorkosRedirectUri) -and -not (Test-LocalUrl $NextAuthUrl))
) {
  $NextPublicWorkosRedirectUri = $derivedWorkosRedirectUri
}
$requiredSecrets = @(
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "AUTH_SECRET",
  "REPLAY_PROXY_SECRET",
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "WORKOS_COOKIE_PASSWORD",
  "INTERNAL_API_SECRET",
  "REALTIME_CHANNEL_SECRET",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY"
)

$optionalSecrets = @(
  "LAGO_API_KEY",
  "LAGO_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_PLUS_MONTHLY",
  "STRIPE_PRICE_PRO_PLUS_YEARLY",
  "CRON_SECRET",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "NOTIFICATION_WEBHOOK_URL",
  "NOTIFICATION_WEBHOOK_SECRET"
)

$missing = @()
foreach ($name in $requiredSecrets) {
  $secretName = "greyhoundiq-$Environment-$name"
  if (-not (Secret-HasVersion $secretName)) {
    $missing += $secretName
  }
}

if ($missing.Count -gt 0 -and -not $AllowMissingSecrets) {
  throw "Missing enabled Secret Manager versions: $($missing -join ', ')"
}

$enabledOptionalSecrets = @()
foreach ($name in $optionalSecrets) {
  $secretName = "greyhoundiq-$Environment-$name"
  if (Secret-HasVersion $secretName) {
    $enabledOptionalSecrets += $name
  }
}

if (-not $SkipMediaScanner -and $MediaScannerMode -eq "clamav") {
  $scannerRequiredSecrets = @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
  $availableScannerSecrets = @($requiredSecrets + $enabledOptionalSecrets)
  $missingScannerSecrets = $scannerRequiredSecrets | Where-Object {
    $availableScannerSecrets -notcontains $_
  } | ForEach-Object {
    "greyhoundiq-$Environment-$($_)"
  }
  if ($missingScannerSecrets.Count -gt 0 -and -not $AllowMissingSecrets) {
    throw "Missing enabled Secret Manager versions for ClamAV scanner: $($missingScannerSecrets -join ', ')"
  }
}

if (-not $NextPublicLivekitUrl -and $enabledOptionalSecrets -contains "LIVEKIT_URL") {
  throw "NEXT_PUBLIC_LIVEKIT_URL is required when LiveKit secrets are enabled (CSP connect-src + browser connect origin). Set it in .env or pass -NextPublicLivekitUrl."
}

$sourceSha = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceSha -notmatch "^[0-9a-f]{40}$") {
  throw "Could not resolve the exact source commit for deployment."
}
if (& git status --porcelain) {
  throw "The staging deployment worktree must be clean."
}
$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/greyhoundiq-web:$sourceSha"
$candidateTag = "candidate-$($sourceSha.Substring(0, 12))"
$substitutions = @(
  "_IMAGE=$image",
  "_NEXT_PUBLIC_SUPABASE_URL=$NextPublicSupabaseUrl",
  "_NEXT_PUBLIC_SUPABASE_ANON_KEY=$NextPublicSupabaseAnonKey",
  "_NEXT_PUBLIC_WORKOS_REDIRECT_URI=$NextPublicWorkosRedirectUri",
  "_NEXT_PUBLIC_LIVEKIT_URL=$NextPublicLivekitUrl",
  "_ENABLE_DEVICE_PREVIEWS=$EnableDevicePreviews"
) -join ","

Invoke-Gcloud builds submit . `
  --config cloudbuild.yaml `
  "--substitutions=$substitutions" `
  --project $ProjectId

$imageDigest = Gcloud-Value artifacts docker images describe $image `
  "--format=value(image_summary.digest)" `
  --project $ProjectId
if ($imageDigest -notmatch "^sha256:[0-9a-f]{64}$") {
  throw "Could not resolve an immutable container image digest."
}
$immutableImage = "$($image.Substring(0, $image.LastIndexOf(':')))@$imageDigest"

$runtimeServiceAccount = "giq-web-$Environment@$ProjectId.iam.gserviceaccount.com"
$scannerServiceAccount = "giq-media-scanner-$Environment@$ProjectId.iam.gserviceaccount.com"
$availableRequiredSecrets = $requiredSecrets
if ($AllowMissingSecrets) {
  # Mounting a secret with no version fails the revision; skip absent ones.
  $availableRequiredSecrets = @($requiredSecrets | Where-Object {
    Secret-HasVersion "greyhoundiq-$Environment-$($_)"
  })
}
$allSecretMappings = @($availableRequiredSecrets + $enabledOptionalSecrets)
$secretMappings = ($allSecretMappings | ForEach-Object {
  "$_=greyhoundiq-$Environment-$($_):latest"
}) -join ","

$plainEnvItems = @(
  "NODE_ENV=production",
  "NEXT_TELEMETRY_DISABLED=1",
  "NEXTAUTH_URL=$NextAuthUrl",
  "AUTH_URL=$NextAuthUrl",
  "STRIPE_APP_URL=$NextAuthUrl",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI=$NextPublicWorkosRedirectUri",
  "NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA=false",
  "NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT=false",
  "ACTOR_CONVERSATION_MULTIPLEX_ENABLED=$ActorConversationMultiplexEnabled",
  "MEDIA_SCAN_MODE=disabled",
  "SEARCH_DISABLED=$SearchDisabled",
  "UPLOAD_DISABLED=$UploadDisabled",
  "EXPORT_DISABLED=$ExportDisabled",
  "AI_DISABLED=$AiDisabled",
  "REALTIME_BROADCAST_DISABLED=$RealtimeBroadcastDisabled"
)
if ($LagoApiUrl) {
  $plainEnvItems += "LAGO_API_URL=$LagoApiUrl"
}
if ($LagoFrontUrl) {
  $plainEnvItems += "LAGO_FRONT_URL=$LagoFrontUrl"
}
$plainEnv = $plainEnvItems -join ","

if ($WebMinInstances -lt 0 -or $WebMaxInstances -lt 1 -or $WebMinInstances -gt $WebMaxInstances) {
  throw "Web instance bounds must satisfy 0 <= min <= max."
}
$minInstances = "3"
$maxInstances = "10"
if ($Environment -eq "staging") {
  $minInstances = [string]$WebMinInstances
  $maxInstances = [string]$WebMaxInstances
}

$deployArgs = @(
  "run",
  "deploy",
  $ServiceName,
  "--image=$immutableImage",
  "--region=$Region",
  "--platform=managed",
  "--service-account=$runtimeServiceAccount",
  "--allow-unauthenticated",
  "--no-invoker-iam-check",
  "--port=8080",
  "--cpu=$WebCpu",
  "--cpu-boost",
  "--memory=$WebMemory",
  "--concurrency=$WebConcurrency",
  "--timeout=900",
  "--min-instances=$minInstances",
  "--max-instances=$maxInstances",
  "--no-traffic",
  "--tag=$candidateTag",
  "--network=$Network",
  "--subnet=$Subnet",
  "--vpc-egress=private-ranges-only",
  "--update-env-vars=$plainEnv",
  "--remove-env-vars=WORKOS_COOKIE_DOMAIN"
)
if ($secretMappings) {
  $deployArgs += "--update-secrets=$secretMappings"
}
$deployArgs += @("--project", $ProjectId)
Invoke-Gcloud @deployArgs

$webRevision = Gcloud-Value run services describe $ServiceName `
  "--region=$Region" `
  "--format=value(status.latestCreatedRevisionName)" `
  --project $ProjectId
if (-not $webRevision) {
  throw "Could not resolve the candidate web revision."
}
$serviceJson = & $script:GcloudCmd run services describe $ServiceName `
  "--region=$Region" `
  --format=json `
  --project $ProjectId 2>$null
if ($LASTEXITCODE -ne 0 -or -not $serviceJson) {
  throw "Could not resolve the candidate web URL."
}
$serviceState = $serviceJson | ConvertFrom-Json
$candidateTraffic = $serviceState.status.traffic | Where-Object {
  $_.tag -eq $candidateTag
} | Select-Object -First 1
$candidateUrl = [string]$candidateTraffic.url
if (-not $candidateUrl.StartsWith("https://")) {
  throw "Could not resolve a secure candidate web URL."
}

$mediaMaintenanceBaseUrl = ""
$scannerRevision = ""
if (-not $SkipMediaScanner) {
  $scannerEnvItems = @(
    $plainEnvItems | Where-Object { $_ -ne "MEDIA_SCAN_MODE=disabled" }
  )
  $scannerEnvItems += "MEDIA_SCAN_MODE=$MediaScannerMode"
  $scannerEnv = $scannerEnvItems -join ","

  $scannerDeployArgs = @(
    "run",
    "deploy",
    $MediaScannerServiceName,
    "--image=$immutableImage",
    "--region=$Region",
    "--platform=managed",
    "--service-account=$scannerServiceAccount",
    "--no-allow-unauthenticated",
    "--port=8080",
    "--cpu=1",
    "--memory=$MediaScannerMemory",
    "--concurrency=1",
    "--timeout=900",
    "--min-instances=0",
    "--max-instances=1",
    "--no-traffic",
    "--network=$Network",
    "--subnet=$Subnet",
    "--vpc-egress=private-ranges-only",
    "--update-env-vars=$scannerEnv",
    "--remove-env-vars=WORKOS_COOKIE_DOMAIN"
  )
  if ($secretMappings) {
    $scannerDeployArgs += "--update-secrets=$secretMappings"
  }
  $scannerDeployArgs += @("--project", $ProjectId)
  Invoke-Gcloud @scannerDeployArgs
  $scannerRevision = Gcloud-Value run services describe $MediaScannerServiceName `
    "--region=$Region" `
    "--format=value(status.latestCreatedRevisionName)" `
    --project $ProjectId
  if (-not $scannerRevision) {
    throw "Could not resolve the candidate media-scanner revision."
  }
  Invoke-Gcloud run services add-iam-policy-binding $MediaScannerServiceName `
    "--region=$Region" `
    "--member=serviceAccount:$runtimeServiceAccount" `
    "--role=roles/run.invoker" `
    --project $ProjectId `
    --quiet | Out-Null
  $mediaMaintenanceBaseUrl = Gcloud-Value run services describe $MediaScannerServiceName `
    "--region=$Region" `
    "--format=value(status.url)" `
    --project $ProjectId
}

# Smoke the tagged no-traffic candidate before any revision receives service traffic.
$env:SMOKE_BASE_URL = $candidateUrl
npm run test:smoke
if ($LASTEXITCODE -ne 0) {
  throw "Candidate smoke test failed; traffic was not changed."
}

Invoke-Gcloud run services update-traffic $ServiceName `
  "--region=$Region" `
  "--to-revisions=$webRevision=100" `
  "--remove-tags=$candidateTag" `
  --project $ProjectId
if ($scannerRevision) {
  Invoke-Gcloud run services update-traffic $MediaScannerServiceName `
    "--region=$Region" `
    "--to-revisions=$scannerRevision=100" `
    --project $ProjectId
}

if (-not $SkipSchedulerJobs) {
  Ensure-SchedulerJobs `
    -MediaMaintenanceBaseUrl $mediaMaintenanceBaseUrl `
    -MediaMaintenanceOidcServiceAccount $(if ($mediaMaintenanceBaseUrl) { $runtimeServiceAccount } else { "" })
}

Write-Host "Cloud Run deploy completed for $ServiceName."
Write-Host "Image: $immutableImage"
if ($mediaMaintenanceBaseUrl) {
  Write-Host "Media scanner service: $MediaScannerServiceName"
}
