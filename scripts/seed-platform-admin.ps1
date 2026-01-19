param(
  [string]$ContainerName = "beauty_platform_postgres"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$seedPath = Join-Path $projectRoot "scripts\\seed-platform-admin.sql"
$envPath = Join-Path $projectRoot ".env"
$env:PGCLIENTENCODING = "UTF8"

if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match "^POSTGRES_DB=(.+)$") { $env:POSTGRES_DB = $Matches[1] }
    if ($_ -match "^POSTGRES_USER=(.+)$") { $env:POSTGRES_USER = $Matches[1] }
  }
}

if (-not $env:POSTGRES_DB -or -not $env:POSTGRES_USER) {
  Write-Error "POSTGRES_DB or POSTGRES_USER not set. Add them to .env."
}

if (-not (Test-Path $seedPath)) {
  Write-Error "Seed file not found: $seedPath"
}

Get-Content -Encoding UTF8 $seedPath | docker exec -i $ContainerName `
  psql -v ON_ERROR_STOP=1 -U $env:POSTGRES_USER -d $env:POSTGRES_DB
