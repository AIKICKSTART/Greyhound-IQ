[CmdletBinding()]
param(
  [ValidateSet("staging", "prod")]
  [string]$Environment = "staging",
  [string]$ProjectId = "",
  [string]$Region = "australia-southeast1",
  [string]$WebServiceName = "",
  [string]$ScannerServiceName = "",
  [string]$SchedulerJobName = "",
  [string]$ReviewedInternalApiSecretName = "",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$gcloud = (Get-Command gcloud -ErrorAction Stop).Source
if (-not $ProjectId) {
  $ProjectId = (& $gcloud config get-value project 2>$null | Select-Object -First 1).Trim()
}
if ($ProjectId -notmatch '^[a-z][a-z0-9-]{4,28}[a-z0-9]$') {
  throw "ProjectId must be an exact Google Cloud project ID."
}
if ($Region -notmatch '^[a-z]+-[a-z]+[0-9]+$') {
  throw "Region must be an exact Google Cloud region."
}
$expectedWebServiceName = "greyhoundiq-web-$Environment"
$expectedScannerServiceName = "greyhoundiq-media-scanner-$Environment"
$expectedSchedulerJobName = "greyhoundiq-$Environment-media-maintenance"
if (-not $WebServiceName) { $WebServiceName = $expectedWebServiceName }
if (-not $ScannerServiceName) { $ScannerServiceName = $expectedScannerServiceName }
if (-not $SchedulerJobName) { $SchedulerJobName = $expectedSchedulerJobName }
if (
  $WebServiceName -ne $expectedWebServiceName -or
  $ScannerServiceName -ne $expectedScannerServiceName -or
  $SchedulerJobName -ne $expectedSchedulerJobName
) {
  throw "Service and Scheduler names must match the selected environment exactly."
}

$scannerServiceAccount = "giq-media-scanner-$Environment@$ProjectId.iam.gserviceaccount.com"
$scannerMember = "serviceAccount:$scannerServiceAccount"
$bucketNames = @(
  "giq-site-assets-$ProjectId",
  "giq-public-user-media-$ProjectId",
  "giq-private-user-media-$ProjectId"
)

function Invoke-Gcloud {
  param([string[]]$Arguments, [switch]$AllowFailure)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $gcloud @Arguments 2>$null
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    $summary = ($Arguments | Select-Object -First 4) -join " "
    throw "gcloud command failed: gcloud $summary"
  }
  return @{ ExitCode = $exitCode; Output = @($output) }
}

function Get-GcloudJson {
  param([string[]]$Arguments, [switch]$AllowMissing)

  $result = Invoke-Gcloud -Arguments ($Arguments + "--format=json") -AllowFailure:$AllowMissing
  if ($result.ExitCode -ne 0 -or $result.Output.Count -eq 0) { return $null }
  return ($result.Output -join "`n") | ConvertFrom-Json
}

function Get-CloudRunService {
  param([string]$Name, [switch]$AllowMissing)
  return Get-GcloudJson -Arguments @(
    "run", "services", "describe", $Name,
    "--region=$Region", "--project=$ProjectId"
  ) -AllowMissing:$AllowMissing
}

function Get-DirectSecretAccess {
  $result = Invoke-Gcloud -Arguments @(
    "secrets", "list", "--project=$ProjectId", "--format=value(name)"
  )
  $secretNames = @($result.Output | ForEach-Object { "$($_)".Trim() } | Where-Object { $_ })
  $accessible = @()
  foreach ($secretName in $secretNames) {
    if ($secretName -notmatch '^[A-Za-z0-9_-]+$') {
      throw "Secret Manager returned an unsafe secret identifier."
    }
    $policy = Get-GcloudJson -Arguments @(
      "secrets", "get-iam-policy", $secretName, "--project=$ProjectId"
    )
    $hasAccess = @($policy.bindings | Where-Object {
      $_.role -eq "roles/secretmanager.secretAccessor" -and
      @($_.members) -contains $scannerMember
    }).Count -gt 0
    if ($hasAccess) { $accessible += $secretName }
  }
  return @($accessible | Sort-Object -Unique)
}

function Test-ProjectSecretAccessor {
  $policy = Get-GcloudJson -Arguments @(
    "projects", "get-iam-policy", $ProjectId
  )
  return @($policy.bindings | Where-Object {
    $_.role -eq "roles/secretmanager.secretAccessor" -and
    @($_.members) -contains $scannerMember
  }).Count -gt 0
}

function Env-Map {
  param([object[]]$Entries)
  $map = @{}
  foreach ($entry in @($Entries)) { $map[$entry.name] = $entry }
  return $map
}

function Get-SecretReference {
  param([object]$Entry, [string]$EnvironmentName)

  $name = "$($Entry.valueFrom.secretKeyRef.name)"
  $version = "$($Entry.valueFrom.secretKeyRef.key)"
  if ($name -notmatch '^[A-Za-z0-9_-]+$' -or $version -notmatch '^(latest|[0-9]+)$') {
    throw "$EnvironmentName must be an exact Secret Manager reference."
  }
  $oppositeEnvironmentPattern = if ($Environment -eq "staging") { "prod|production" } else { "staging" }
  if ($name -match "(^|-)($oppositeEnvironmentPattern)(-|$)") {
    throw "$EnvironmentName points at the opposite environment."
  }
  return [ordered]@{ name = $name; version = $version }
}

function Get-NetworkContract {
  param([object]$Service, [string]$ServiceName)

  $annotations = $Service.spec.template.metadata.annotations
  $networkInterfaces = [string]$annotations.'run.googleapis.com/network-interfaces'
  $connector = [string]$annotations.'run.googleapis.com/vpc-access-connector'
  $egress = [string]$annotations.'run.googleapis.com/vpc-access-egress'
  if (($networkInterfaces -and $connector) -or (-not $networkInterfaces -and -not $connector)) {
    throw "$ServiceName must use exactly one reviewed VPC attachment mode."
  }
  if ($egress -notin @("private-ranges-only", "all-traffic")) {
    throw "$ServiceName has an unsupported VPC egress policy."
  }

  if ($networkInterfaces) {
    try {
      $interfaces = @($networkInterfaces | ConvertFrom-Json)
    } catch {
      throw "$ServiceName has invalid direct-VPC configuration."
    }
    if ($interfaces.Count -ne 1) {
      throw "$ServiceName must use exactly one direct-VPC interface."
    }
    $network = "$($interfaces[0].network)"
    $subnetwork = "$($interfaces[0].subnetwork)"
    $tags = @($interfaces[0].tags | Where-Object { -not [string]::IsNullOrWhiteSpace("$_") })
    if (
      $network -notmatch '^[A-Za-z0-9_.\/-]+$' -or
      $subnetwork -notmatch '^[A-Za-z0-9_.\/-]+$' -or
      @($tags | Where-Object { "$_" -notmatch '^[a-z0-9-]{1,63}$' }).Count -gt 0
    ) {
      throw "$ServiceName has unsafe direct-VPC identifiers."
    }
    $canonicalInterface = [ordered]@{
      network = $network
      subnetwork = $subnetwork
      tags = @($tags | ForEach-Object { "$_" } | Sort-Object)
    } | ConvertTo-Json -Depth 4 -Compress
    $arguments = @("--network=$network", "--subnet=$subnetwork", "--vpc-egress=$egress")
    if ($tags.Count -gt 0) { $arguments += "--network-tags=$($tags -join ',')" }
    return [ordered]@{
      fingerprint = "direct|$canonicalInterface|$egress"
      arguments = $arguments
    }
  }

  if ($connector -notmatch '^[A-Za-z0-9_.\/-]+$') {
    throw "$ServiceName has an unsafe VPC connector identifier."
  }
  return [ordered]@{
    fingerprint = "connector|$connector|$egress"
    arguments = @("--vpc-connector=$connector", "--vpc-egress=$egress")
  }
}

function Get-ScannerEnvironmentDrift {
  param(
    [object]$Container,
    [System.Collections.IDictionary]$ExpectedPlain,
    [System.Collections.IDictionary]$ExpectedSecrets
  )

  $findings = @()
  $entries = @($Container.env)
  $actual = Env-Map $entries
  $expectedNames = @($ExpectedPlain.Keys) + @($ExpectedSecrets.Keys)
  $actualNames = @($entries | ForEach-Object { "$($_.name)" })
  if (
    (Compare-Object ($expectedNames | Sort-Object) ($actualNames | Sort-Object)).Count -gt 0 -or
    $actualNames.Count -ne $expectedNames.Count
  ) {
    $findings += "$ScannerServiceName environment allowlist differs"
  }
  foreach ($name in $ExpectedPlain.Keys) {
    $entry = $actual[$name]
    if ($null -eq $entry -or $entry.value -ne $ExpectedPlain[$name] -or $entry.valueFrom) {
      $findings += "$ScannerServiceName plain environment binding $name differs"
    }
  }
  foreach ($name in $ExpectedSecrets.Keys) {
    $entry = $actual[$name]
    $expected = $ExpectedSecrets[$name]
    if (
      $null -eq $entry -or
      "$($entry.valueFrom.secretKeyRef.name)" -ne $expected.name -or
      "$($entry.valueFrom.secretKeyRef.key)" -ne $expected.version
    ) {
      $findings += "$ScannerServiceName secret reference $name differs"
    }
  }
  return @($findings)
}

$web = Get-CloudRunService -Name $WebServiceName
$webContainer = @($web.spec.template.spec.containers)[0]
if (-not $webContainer.image) { throw "$WebServiceName has no deployed image." }
$webServiceAccount = "$($web.spec.template.spec.serviceAccountName)"
if ($webServiceAccount -ne "giq-web-$Environment@$ProjectId.iam.gserviceaccount.com") {
  throw "$WebServiceName does not use the exact environment-scoped web identity."
}
$webEnv = Env-Map @($webContainer.env)
foreach ($required in @(
  "DATABASE_URL",
  "INTERNAL_API_SECRET",
  "OBJECT_STORAGE_PROVIDER",
  "GCS_SITE_ASSETS_BUCKET",
  "GCS_PUBLIC_USER_MEDIA_BUCKET",
  "GCS_PRIVATE_USER_MEDIA_BUCKET"
)) {
  if (-not $webEnv.ContainsKey($required)) {
    throw "$WebServiceName is missing required scanner environment binding $required."
  }
}
if ($webEnv.OBJECT_STORAGE_PROVIDER.value -ne "gcs") {
  throw "$WebServiceName is not using GCS object storage."
}
if (
  $webEnv.GCS_SITE_ASSETS_BUCKET.value -ne $bucketNames[0] -or
  $webEnv.GCS_PUBLIC_USER_MEDIA_BUCKET.value -ne $bucketNames[1] -or
  $webEnv.GCS_PRIVATE_USER_MEDIA_BUCKET.value -ne $bucketNames[2]
) {
  throw "$WebServiceName GCS bucket mappings do not match the exact project-derived names."
}
if (-not $webEnv.DATABASE_URL.valueFrom.secretKeyRef.name) {
  throw "DATABASE_URL must be a Secret Manager reference before scanner reconciliation."
}
if (-not $webEnv.INTERNAL_API_SECRET.valueFrom.secretKeyRef.name) {
  throw "INTERNAL_API_SECRET must be a Secret Manager reference before scanner reconciliation."
}
$databaseSecretRef = Get-SecretReference $webEnv.DATABASE_URL "DATABASE_URL"
$internalSecretRef = Get-SecretReference $webEnv.INTERNAL_API_SECRET "INTERNAL_API_SECRET"
if ($databaseSecretRef.name -ne "greyhoundiq-$Environment-DATABASE_URL") {
  throw "DATABASE_URL must use the exact environment-scoped Secret Manager secret."
}
$environmentInternalApiSecretName = "greyhoundiq-$Environment-INTERNAL_API_SECRET"
if ($ReviewedInternalApiSecretName -and $ReviewedInternalApiSecretName -notmatch '^[A-Za-z0-9_-]+$') {
  throw "ReviewedInternalApiSecretName must be an exact Secret Manager resource name."
}
if ($internalSecretRef.name -eq "giq-internal-api-secret") {
  if ($ReviewedInternalApiSecretName -ne $internalSecretRef.name) {
    throw "The generic INTERNAL_API_SECRET requires -ReviewedInternalApiSecretName giq-internal-api-secret."
  }
} elseif ($internalSecretRef.name -ne $environmentInternalApiSecretName) {
  throw "INTERNAL_API_SECRET must be environment-scoped or the explicitly reviewed generic secret."
}
if (
  $ReviewedInternalApiSecretName -and
  $ReviewedInternalApiSecretName -ne $internalSecretRef.name
) {
  throw "ReviewedInternalApiSecretName does not match the serving web secret reference."
}
$expectedPlainEnvironment = [ordered]@{
  NODE_ENV = "production"
  NEXT_TELEMETRY_DISABLED = "1"
  MEDIA_SCAN_MODE = "clamav"
  REALTIME_BROADCAST_DISABLED = "true"
  OBJECT_STORAGE_PROVIDER = "gcs"
  GCS_SITE_ASSETS_BUCKET = $bucketNames[0]
  GCS_PUBLIC_USER_MEDIA_BUCKET = $bucketNames[1]
  GCS_PRIVATE_USER_MEDIA_BUCKET = $bucketNames[2]
}
$expectedSecretEnvironment = [ordered]@{
  DATABASE_URL = $databaseSecretRef
  INTERNAL_API_SECRET = $internalSecretRef
}
$schedulerDescription = "GreyhoundIQ $Environment media maintenance; internal-secret=$($internalSecretRef.name):$($internalSecretRef.version)"
$webNetwork = Get-NetworkContract $web $WebServiceName
$allowedSecretNames = @(
  $expectedSecretEnvironment.Values | ForEach-Object { $_.name } | Sort-Object -Unique
)
$scannerAccountState = Invoke-Gcloud -Arguments @(
  "iam", "service-accounts", "describe", $scannerServiceAccount,
  "--project=$ProjectId"
) -AllowFailure
$scannerAccountPresent = $scannerAccountState.ExitCode -eq 0
$directSecretAccess = @()
if ($scannerAccountPresent) { $directSecretAccess = @(Get-DirectSecretAccess) }
$hasProjectSecretAccessor = if ($scannerAccountPresent) { Test-ProjectSecretAccessor } else { $false }

$scanner = Get-CloudRunService -Name $ScannerServiceName -AllowMissing
$scheduler = Get-GcloudJson -Arguments @(
  "scheduler", "jobs", "describe", $SchedulerJobName,
  "--location=$Region", "--project=$ProjectId"
) -AllowMissing
$drift = @()

if ($hasProjectSecretAccessor) {
  $drift += "$ScannerServiceName identity has project-wide Secret Manager access"
}
$unexpectedSecretAccess = @(
  Compare-Object $allowedSecretNames $directSecretAccess |
    Where-Object { $_.SideIndicator -eq "=>" } |
    ForEach-Object { "$($_.InputObject)" }
)
if ($unexpectedSecretAccess.Count -gt 0) {
  $drift += "$ScannerServiceName identity can access secrets outside its allowlist"
}
$missingSecretAccess = @(
  Compare-Object $allowedSecretNames $directSecretAccess |
    Where-Object { $_.SideIndicator -eq "<=" } |
    ForEach-Object { "$($_.InputObject)" }
)
if ($scannerAccountPresent -and $missingSecretAccess.Count -gt 0) {
  $drift += "$ScannerServiceName identity is missing an allowlisted secret grant"
}

if ($null -eq $scanner) {
  $drift += "$ScannerServiceName is missing"
} else {
  $scannerContainer = @($scanner.spec.template.spec.containers)[0]
  if ($scannerContainer.image -ne $webContainer.image) {
    $drift += "$ScannerServiceName image differs from the serving web image"
  }
  if ($scanner.spec.template.spec.serviceAccountName -ne $scannerServiceAccount) {
    $drift += "$ScannerServiceName does not use its dedicated service account"
  }
  $drift += @(Get-ScannerEnvironmentDrift `
    -Container $scannerContainer `
    -ExpectedPlain $expectedPlainEnvironment `
    -ExpectedSecrets $expectedSecretEnvironment)
  if ([int]$scanner.spec.template.spec.containerConcurrency -ne 1) {
    $drift += "$ScannerServiceName concurrency is not 1"
  }
  if ($scannerContainer.resources.limits.memory -ne "4Gi") {
    $drift += "$ScannerServiceName memory is not 4Gi"
  }
  try {
    $scannerNetwork = Get-NetworkContract $scanner $ScannerServiceName
    if ($scannerNetwork.fingerprint -ne $webNetwork.fingerprint) {
      $drift += "$ScannerServiceName network or egress differs from $WebServiceName"
    }
  } catch {
    $drift += "$ScannerServiceName network or egress is invalid"
  }
}

if ($null -eq $scheduler) {
  $drift += "$SchedulerJobName is missing"
} elseif ($null -ne $scanner) {
  $scannerUrl = "$($scanner.status.url)".TrimEnd("/")
  if ($scheduler.httpTarget.uri -ne "$scannerUrl/api/internal/media-maintenance") {
    $drift += "$SchedulerJobName does not target the private scanner"
  }
  if ($scheduler.schedule -ne "*/5 * * * *") {
    $drift += "$SchedulerJobName does not run every five minutes"
  }
  if ($scheduler.timeZone -ne "Australia/Sydney") {
    $drift += "$SchedulerJobName does not use the approved time zone"
  }
  if ($scheduler.description -ne $schedulerDescription) {
    $drift += "$SchedulerJobName secret-reference marker differs"
  }
  if ($scheduler.httpTarget.httpMethod -ne "POST") {
    $drift += "$SchedulerJobName does not use POST"
  }
  if ($scheduler.httpTarget.oidcToken.serviceAccountEmail -ne $webServiceAccount) {
    $drift += "$SchedulerJobName does not use the reviewed invoker identity"
  }
  if ($scheduler.httpTarget.oidcToken.audience -ne $scannerUrl) {
    $drift += "$SchedulerJobName OIDC audience does not match the scanner service"
  }
  if ($scheduler.attemptDeadline -ne "900s") {
    $drift += "$SchedulerJobName attempt deadline is not 900 seconds"
  }
  if ([int]$scheduler.retryConfig.retryCount -ne 3) {
    $drift += "$SchedulerJobName retry count is not 3"
  }
  if (
    -not $scheduler.httpTarget.headers.'x-internal-secret' -or
    $scheduler.httpTarget.headers.'Content-Type' -ne "application/json"
  ) {
    $drift += "$SchedulerJobName internal-auth headers differ"
  }
}

if (-not $Apply) {
  if ($drift.Count -gt 0) {
    Write-Host "Media scanner deployment drift found:"
    $drift | ForEach-Object { Write-Host "- $_" }
    exit 2
  }
  Write-Host "Media scanner service and scheduler match the deployed web revision."
  exit 0
}

if ($hasProjectSecretAccessor -or $unexpectedSecretAccess.Count -gt 0) {
  throw "Scanner identity has Secret Manager access outside the exact two-secret allowlist. Remove it before applying."
}
if (-not $scannerAccountPresent) {
  Invoke-Gcloud -Arguments @(
    "iam", "service-accounts", "create", "giq-media-scanner-$Environment",
    "--display-name=GreyhoundIQ media scanner ($Environment)",
    "--project=$ProjectId"
  ) | Out-Null
}

foreach ($role in @("roles/logging.logWriter", "roles/monitoring.metricWriter")) {
  Invoke-Gcloud -Arguments @(
    "projects", "add-iam-policy-binding", $ProjectId,
    "--member=$scannerMember", "--role=$role", "--condition=None", "--quiet"
  ) | Out-Null
}
foreach ($bucketName in $bucketNames) {
  Invoke-Gcloud -Arguments @(
    "storage", "buckets", "add-iam-policy-binding", "gs://$bucketName",
    "--member=$scannerMember", "--role=roles/storage.objectUser",
    "--project=$ProjectId", "--quiet"
  ) | Out-Null
}

$secretMappings = @()
$grantedSecretNames = @{}
foreach ($environmentName in $expectedSecretEnvironment.Keys) {
  $secretReference = $expectedSecretEnvironment[$environmentName]
  if (-not $grantedSecretNames.ContainsKey($secretReference.name)) {
    Invoke-Gcloud -Arguments @(
      "secrets", "add-iam-policy-binding", $secretReference.name,
      "--member=$scannerMember", "--role=roles/secretmanager.secretAccessor",
      "--condition=None", "--project=$ProjectId", "--quiet"
    ) | Out-Null
    $grantedSecretNames[$secretReference.name] = $true
  }
  $secretMappings += "$environmentName=$($secretReference.name)`:$($secretReference.version)"
}

$environmentFile = Join-Path $env:TEMP "greyhoundiq-media-scanner-env-$PID.json"
try {
  ConvertTo-Json -InputObject $expectedPlainEnvironment -Depth 4 |
    Set-Content -LiteralPath $environmentFile -Encoding utf8
  $deployArgs = @(
    "run", "deploy", $ScannerServiceName,
    "--image=$($webContainer.image)", "--region=$Region", "--platform=managed",
    "--service-account=$scannerServiceAccount", "--no-allow-unauthenticated",
    "--port=8080", "--cpu=1", "--memory=4Gi", "--concurrency=1",
    "--timeout=900", "--min-instances=0", "--max-instances=1",
    "--execution-environment=gen2", "--env-vars-file=$environmentFile",
    "--project=$ProjectId", "--quiet"
  ) + $webNetwork.arguments
  if ($secretMappings.Count -gt 0) {
    $deployArgs += "--set-secrets=$($secretMappings -join ',')"
  }
  Invoke-Gcloud -Arguments $deployArgs | Out-Null
} finally {
  Remove-Item -LiteralPath $environmentFile -Force -ErrorAction SilentlyContinue
}

Invoke-Gcloud -Arguments @(
  "run", "services", "add-iam-policy-binding", $ScannerServiceName,
  "--region=$Region", "--member=serviceAccount:$webServiceAccount",
  "--role=roles/run.invoker", "--project=$ProjectId", "--quiet"
) | Out-Null

$projectNumberResult = Invoke-Gcloud -Arguments @(
  "projects", "describe", $ProjectId, "--format=value(projectNumber)"
)
$projectNumber = ($projectNumberResult.Output | Select-Object -First 1).Trim()
$schedulerServiceAgent = "service-$projectNumber@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
Invoke-Gcloud -Arguments @(
  "iam", "service-accounts", "add-iam-policy-binding", $webServiceAccount,
  "--member=serviceAccount:$schedulerServiceAgent",
  "--role=roles/iam.serviceAccountTokenCreator", "--project=$ProjectId", "--quiet"
) | Out-Null

$scanner = Get-CloudRunService -Name $ScannerServiceName
$scannerUrl = "$($scanner.status.url)".TrimEnd("/")
if (-not $scannerUrl.StartsWith("https://")) { throw "Scanner URL is not HTTPS." }
$internalSecretRef = $webEnv.INTERNAL_API_SECRET.valueFrom.secretKeyRef
$secretResult = Invoke-Gcloud -Arguments @(
  "secrets", "versions", "access", "$($internalSecretRef.key)",
  "--secret=$($internalSecretRef.name)", "--project=$ProjectId"
)
$internalSecret = ($secretResult.Output -join "`n").Trim()
if ($internalSecret.Length -lt 20 -or $internalSecret -match '[\x00-\x1f\x7f,]') {
  throw "INTERNAL_API_SECRET is not safe for a Cloud Scheduler request header."
}

$schedulerAction = if ($null -eq $scheduler) { "create" } else { "update" }
$headerFlag = if ($schedulerAction -eq "create") { "--headers" } else { "--update-headers" }
Invoke-Gcloud -Arguments @(
  "scheduler", "jobs", $schedulerAction, "http", $SchedulerJobName,
  "--location=$Region", "--schedule=*/5 * * * *", "--time-zone=Australia/Sydney",
  "--description=$schedulerDescription",
  "--uri=$scannerUrl/api/internal/media-maintenance", "--http-method=POST",
  "$headerFlag=Content-Type=application/json,x-internal-secret=$internalSecret",
  "--message-body={}", "--oidc-service-account-email=$webServiceAccount",
  "--oidc-token-audience=$scannerUrl", "--attempt-deadline=900s",
  "--max-retry-attempts=3", "--min-backoff=30s", "--max-backoff=120s",
  "--max-doublings=2", "--project=$ProjectId", "--quiet"
) | Out-Null

$scanner = Get-CloudRunService -Name $ScannerServiceName
$scheduler = Get-GcloudJson -Arguments @(
  "scheduler", "jobs", "describe", $SchedulerJobName,
  "--location=$Region", "--project=$ProjectId"
)
if (Test-ProjectSecretAccessor) {
  throw "Scanner identity unexpectedly has project-wide Secret Manager access."
}
$verifiedSecretAccess = @(Get-DirectSecretAccess)
if ((Compare-Object $allowedSecretNames $verifiedSecretAccess).Count -ne 0) {
  throw "Scanner identity Secret Manager allowlist verification failed."
}
if ($scanner.spec.template.spec.serviceAccountName -ne $scannerServiceAccount) {
  throw "Scanner service-account verification failed."
}
$scannerContainer = @($scanner.spec.template.spec.containers)[0]
$environmentDrift = @(Get-ScannerEnvironmentDrift `
  -Container $scannerContainer `
  -ExpectedPlain $expectedPlainEnvironment `
  -ExpectedSecrets $expectedSecretEnvironment)
if ($environmentDrift.Count -gt 0) {
  throw "Scanner environment allowlist verification failed."
}
$scannerNetwork = Get-NetworkContract $scanner $ScannerServiceName
if ($scannerNetwork.fingerprint -ne $webNetwork.fingerprint) {
  throw "Scanner network and egress verification failed."
}
if ($scheduler.httpTarget.uri -ne "$scannerUrl/api/internal/media-maintenance") {
  throw "Scanner scheduler target verification failed."
}
if (
  $scheduler.httpTarget.httpMethod -ne "POST" -or
  $scheduler.httpTarget.oidcToken.serviceAccountEmail -ne $webServiceAccount -or
  $scheduler.httpTarget.oidcToken.audience -ne $scannerUrl -or
  $scheduler.attemptDeadline -ne "900s" -or
  $scheduler.description -ne $schedulerDescription
) {
  throw "Scanner scheduler authentication or deadline verification failed."
}
Write-Host "Media scanner and scheduler reconciled without redeploying $WebServiceName."
