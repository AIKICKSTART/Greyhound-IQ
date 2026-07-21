[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ArchiveDirectory,

  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,

  [string]$Database = 'giq_production_candidate_20260716_r1',
  [int]$Stage = 11,
  [string]$StageSha256 = 'f9771f6668f5be9ac8362aa6b26df644ac992e2537648545fe8ea69d49f305f2'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$archive = (Resolve-Path -LiteralPath $ArchiveDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $archive 'toc.dat') -PathType Leaf)) {
  throw "PostgreSQL directory archive is missing toc.dat: $archive"
}

$manifestFullPath = [System.IO.Path]::GetFullPath($ManifestPath)
$manifestDirectory = Split-Path -Parent $manifestFullPath
if (-not (Test-Path -LiteralPath $manifestDirectory -PathType Container)) {
  New-Item -ItemType Directory -Path $manifestDirectory | Out-Null
}

$statePath = "$manifestFullPath.state.jsonl"
$known = @{}
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
  foreach ($line in [System.IO.File]::ReadLines($statePath)) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }
    $entry = $line | ConvertFrom-Json
    $known[[string]$entry.path] = $entry
  }
}

$files = @(Get-ChildItem -LiteralPath $archive -File | Sort-Object Name)
$streamWriter = [System.IO.StreamWriter]::new($statePath, $true, [System.Text.UTF8Encoding]::new($false))
$streamWriter.AutoFlush = $true

try {
  $completed = 0
  foreach ($file in $files) {
    $relativePath = $file.Name
    $lastWriteUtcTicks = $file.LastWriteTimeUtc.Ticks
    $existing = $known[$relativePath]
    if (
      $null -ne $existing -and
      [int64]$existing.bytes -eq $file.Length -and
      [int64]$existing.lastWriteUtcTicks -eq $lastWriteUtcTicks -and
      [string]$existing.sha256 -match '^[0-9a-f]{64}$'
    ) {
      $completed += 1
      Write-Host "MANIFEST_PROGRESS files=$completed/$($files.Count) reused=$relativePath"
      continue
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $fileStream = [System.IO.FileStream]::new(
      $file.FullName,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::Read,
      8MB,
      [System.IO.FileOptions]::SequentialScan
    )
    try {
      $hash = [System.BitConverter]::ToString($sha256.ComputeHash($fileStream)).Replace('-', '').ToLowerInvariant()
    }
    finally {
      $fileStream.Dispose()
      $sha256.Dispose()
    }

    $entry = [pscustomobject]@{
      path = $relativePath
      bytes = $file.Length
      lastWriteUtcTicks = $lastWriteUtcTicks
      sha256 = $hash
    }
    $known[$relativePath] = $entry
    $streamWriter.WriteLine(($entry | ConvertTo-Json -Compress))
    $completed += 1
    Write-Host "MANIFEST_PROGRESS files=$completed/$($files.Count) hashed=$relativePath bytes=$($file.Length)"
  }
}
finally {
  $streamWriter.Dispose()
}

$entries = @(
  foreach ($file in $files) {
    $entry = $known[$file.Name]
    if (
      $null -eq $entry -or
      [int64]$entry.bytes -ne $file.Length -or
      [int64]$entry.lastWriteUtcTicks -ne $file.LastWriteTimeUtc.Ticks -or
      [string]$entry.sha256 -notmatch '^[0-9a-f]{64}$'
    ) {
      throw "Manifest state is incomplete or stale for $($file.Name)"
    }
    [pscustomobject]@{
      path = [string]$entry.path
      bytes = [int64]$entry.bytes
      sha256 = [string]$entry.sha256
    }
  }
)

$document = [ordered]@{
  schemaVersion = 1
  createdUtc = (Get-Date).ToUniversalTime().ToString('o')
  database = $Database
  stage = $Stage
  stageSha256 = $StageSha256
  archiveFormat = 'PostgreSQL directory'
  archiveFiles = $files.Count
  archiveBytes = [int64](($files | Measure-Object Length -Sum).Sum)
  files = $entries
}

$temporaryPath = "$manifestFullPath.tmp"
[System.IO.File]::WriteAllText(
  $temporaryPath,
  ($document | ConvertTo-Json -Depth 5),
  [System.Text.UTF8Encoding]::new($false)
)
Move-Item -LiteralPath $temporaryPath -Destination $manifestFullPath -Force

$manifestHash = (Get-FileHash -LiteralPath $manifestFullPath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "DIRECTORY_DUMP_MANIFEST_COMPLETE files=$($files.Count) bytes=$($document.archiveBytes) sha256=$manifestHash path=$manifestFullPath"
