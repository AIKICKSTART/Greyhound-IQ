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
  [ValidateSet("metadata", "clamav")]
  [string]$MediaScannerMode = "clamav",
  [string]$MediaScannerMemory = "4Gi",
  [switch]$AllowMissingSecrets
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
      Name = "greyhoundiq-$Environment-listing-maintenance"
      Schedule = "17 * * * *"
      Uri = "$baseUrl/api/internal/listing-expiry"
      Description = "GreyhoundIQ $Environment listing expiry maintenance"
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
      Name = "greyhoundiq-$Environment-notification-delivery"
      Schedule = "*/5 * * * *"
      Uri = "$baseUrl/api/internal/notification-delivery"
      Description = "GreyhoundIQ $Environment notification delivery maintenance"
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
if (-not $WorkosCookieDomain) {
  $WorkosCookieDomain = DotEnv-Value "WORKOS_COOKIE_DOMAIN"
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
if (-not $WorkosCookieDomain) {
  $WorkosCookieDomain = Get-SharedCookieDomain $NextAuthUrl
}

$requiredSecrets = @(
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "AUTH_SECRET",
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "WORKOS_COOKIE_PASSWORD",
  "INTERNAL_API_SECRET",
  "REALTIME_CHANNEL_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

$optionalSecrets = @(
  "LAGO_API_KEY",
  "LAGO_WEBHOOK_SECRET",
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

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/greyhoundiq-web:$Environment-$timestamp"
$substitutions = @(
  "_IMAGE=$image",
  "_NEXT_PUBLIC_SUPABASE_URL=$NextPublicSupabaseUrl",
  "_NEXT_PUBLIC_SUPABASE_ANON_KEY=$NextPublicSupabaseAnonKey",
  "_NEXT_PUBLIC_WORKOS_REDIRECT_URI=$NextPublicWorkosRedirectUri",
  "_NEXT_PUBLIC_LIVEKIT_URL=$NextPublicLivekitUrl"
) -join ","

Invoke-Gcloud builds submit . `
  --config cloudbuild.yaml `
  "--substitutions=$substitutions" `
  --project $ProjectId

$runtimeServiceAccount = "giq-web-$Environment@$ProjectId.iam.gserviceaccount.com"
$allSecretMappings = @($requiredSecrets + $enabledOptionalSecrets)
$secretMappings = ($allSecretMappings | ForEach-Object {
  "$_=greyhoundiq-$Environment-$($_):latest"
}) -join ","

$plainEnvItems = @(
  "NODE_ENV=production",
  "NEXT_TELEMETRY_DISABLED=1",
  "NEXTAUTH_URL=$NextAuthUrl",
  "AUTH_URL=$NextAuthUrl",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI=$NextPublicWorkosRedirectUri",
  "NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA=false",
  "NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT=false",
  "MEDIA_SCAN_MODE=disabled"
)
if ($WorkosCookieDomain) {
  $plainEnvItems += "WORKOS_COOKIE_DOMAIN=$WorkosCookieDomain"
}
if ($LagoApiUrl) {
  $plainEnvItems += "LAGO_API_URL=$LagoApiUrl"
}
if ($LagoFrontUrl) {
  $plainEnvItems += "LAGO_FRONT_URL=$LagoFrontUrl"
}
$plainEnv = $plainEnvItems -join ","

$minInstances = "3"
$maxInstances = "10"

$deployArgs = @(
  "run",
  "deploy",
  $ServiceName,
  "--image=$image",
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
  "--timeout=300",
  "--min-instances=$minInstances",
  "--max-instances=$maxInstances",
  "--network=default",
  "--subnet=default",
  "--vpc-egress=private-ranges-only",
  "--set-env-vars=$plainEnv"
)
if ($secretMappings) {
  $deployArgs += "--update-secrets=$secretMappings"
}
$deployArgs += @("--project", $ProjectId)
Invoke-Gcloud @deployArgs
Invoke-Gcloud run services update-traffic $ServiceName `
  "--region=$Region" `
  --to-latest `
  --project $ProjectId

$mediaMaintenanceBaseUrl = ""
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
    "--image=$image",
    "--region=$Region",
    "--platform=managed",
    "--service-account=$runtimeServiceAccount",
    "--no-allow-unauthenticated",
    "--port=8080",
    "--cpu=1",
    "--memory=$MediaScannerMemory",
    "--concurrency=1",
    "--timeout=900",
    "--min-instances=0",
    "--max-instances=1",
    "--network=default",
    "--subnet=default",
    "--vpc-egress=private-ranges-only",
    "--set-env-vars=$scannerEnv"
  )
  if ($secretMappings) {
    $scannerDeployArgs += "--update-secrets=$secretMappings"
  }
  $scannerDeployArgs += @("--project", $ProjectId)
  Invoke-Gcloud @scannerDeployArgs
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

Ensure-SchedulerJobs `
  -MediaMaintenanceBaseUrl $mediaMaintenanceBaseUrl `
  -MediaMaintenanceOidcServiceAccount $(if ($mediaMaintenanceBaseUrl) { $runtimeServiceAccount } else { "" })

Write-Host "Cloud Run deploy completed for $ServiceName."
Write-Host "Image: $image"
if ($mediaMaintenanceBaseUrl) {
  Write-Host "Media scanner service: $MediaScannerServiceName"
}
