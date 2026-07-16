[CmdletBinding()]
param(
  [string]$ProjectId = "",
  [string]$Region = "australia-southeast1",
  [switch]$Apply,
  [string]$BackupDirectory = "",
  [string]$RestoreDirectory = ""
)

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

if ($Apply -and $RestoreDirectory) {
  throw "Use either -Apply or -RestoreDirectory, not both."
}
if ($Apply -and -not $BackupDirectory) {
  throw "-BackupDirectory is required with -Apply so the previous CORS state can be restored."
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

$repoRoot = Split-Path -Parent $PSScriptRoot
$corsFile = Join-Path $repoRoot "config\gcs-object-storage-cors.json"
if (-not (Test-Path -LiteralPath $corsFile -PathType Leaf)) {
  throw "Canonical GCS CORS configuration is missing: $corsFile"
}
$expectedCors = Get-Content -Raw -LiteralPath $corsFile | ConvertFrom-Json
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

function Get-BucketState {
  param([string]$BucketName)

  $result = Invoke-Gcloud -Arguments @(
    "storage", "buckets", "describe", "gs://$BucketName",
    "--project=$ProjectId", "--format=json"
  ) -AllowFailure
  if ($result.ExitCode -ne 0 -or $result.Output.Count -eq 0) { return $null }
  return ($result.Output -join "`n") | ConvertFrom-Json
}

function ConvertTo-CanonicalCorsJson {
  param([object]$Rules)

  $normalized = @($Rules) | ForEach-Object {
    [ordered]@{
      origin = @($_.origin | Sort-Object)
      method = @($_.method | Sort-Object)
      responseHeader = @($_.responseHeader | ForEach-Object { "$($_)".ToLowerInvariant() } | Sort-Object)
      maxAgeSeconds = [int]$_.maxAgeSeconds
    }
  }
  return ConvertTo-Json -InputObject @($normalized) -Depth 8 -Compress
}

function Write-CorsBackup {
  param([string]$BucketName, [object]$State)

  New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
  $path = Join-Path $BackupDirectory "$BucketName.cors.json"
  $rules = if ($null -eq $State.cors_config) { @() } else { @($State.cors_config) }
  ConvertTo-Json -InputObject $rules -Depth 8 | Set-Content -LiteralPath $path -Encoding utf8
}

function Assert-BucketState {
  param([string]$BucketName, [object]$State)

  if ($null -eq $State) { throw "$BucketName was not found after reconciliation." }
  if ("$($State.location)".ToLowerInvariant() -ne $Region.ToLowerInvariant()) {
    throw "$BucketName is outside the approved region $Region."
  }
  if ($State.uniform_bucket_level_access -ne $true) {
    throw "$BucketName does not enforce uniform bucket-level access."
  }
  if ($State.public_access_prevention -ne "enforced") {
    throw "$BucketName does not enforce public access prevention."
  }
  if (
    (ConvertTo-CanonicalCorsJson $State.cors_config) -ne
    (ConvertTo-CanonicalCorsJson $expectedCors)
  ) {
    throw "$BucketName does not match the canonical CORS configuration."
  }
}

if ($RestoreDirectory) {
  foreach ($bucketName in $bucketNames) {
    $backup = Join-Path $RestoreDirectory "$bucketName.cors.json"
    if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) {
      throw "Missing CORS rollback file: $backup"
    }
    if ($null -eq (Get-BucketState $bucketName)) {
      throw "Cannot restore CORS because $bucketName does not exist."
    }
    Invoke-Gcloud -Arguments @(
      "storage", "buckets", "update", "gs://$bucketName",
      "--cors-file=$backup", "--project=$ProjectId"
    ) | Out-Null
    Write-Host "$bucketName CORS restored from reviewed backup."
  }
  exit 0
}

$drift = @()
foreach ($bucketName in $bucketNames) {
  $state = Get-BucketState $bucketName
  if ($null -eq $state) {
    $drift += "$bucketName is missing or unreadable"
    if (-not $Apply) { continue }
    Invoke-Gcloud -Arguments @(
      "storage", "buckets", "create", "gs://$bucketName",
      "--location=$Region", "--uniform-bucket-level-access", "--project=$ProjectId"
    ) | Out-Null
    $state = Get-BucketState $bucketName
  }

  if ("$($state.location)".ToLowerInvariant() -ne $Region.ToLowerInvariant()) {
    throw "$bucketName is in $($state.location), not the approved region $Region."
  }

  $hardeningDrift =
    $state.uniform_bucket_level_access -ne $true -or
    $state.public_access_prevention -ne "enforced"
  $corsDrift =
    (ConvertTo-CanonicalCorsJson $state.cors_config) -ne
    (ConvertTo-CanonicalCorsJson $expectedCors)

  if ($hardeningDrift) { $drift += "$bucketName bucket hardening differs" }
  if ($corsDrift) { $drift += "$bucketName CORS differs" }

  if ($Apply -and ($hardeningDrift -or $corsDrift)) {
    Write-CorsBackup -BucketName $bucketName -State $state
    $arguments = @(
      "storage", "buckets", "update", "gs://$bucketName",
      "--uniform-bucket-level-access", "--public-access-prevention",
      "--project=$ProjectId"
    )
    if ($corsDrift) { $arguments += "--cors-file=$corsFile" }
    Invoke-Gcloud -Arguments $arguments | Out-Null
  }

  if ($Apply) {
    Assert-BucketState -BucketName $bucketName -State (Get-BucketState $bucketName)
    Write-Host "$bucketName matches the Australian GCS contract."
  } elseif (-not $hardeningDrift -and -not $corsDrift) {
    Write-Host "$bucketName matches the Australian GCS contract."
  }
}

if (-not $Apply -and $drift.Count -gt 0) {
  Write-Host "GCS object-storage drift found:"
  $drift | ForEach-Object { Write-Host "- $_" }
  exit 2
}

Write-Host "GCS object-storage reconciliation complete for $ProjectId."
