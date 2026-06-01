param(
  [int]$RealAccountId = 2,
  [string]$Filter = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPaths = @(
  (Join-Path $projectRoot ".env.local"),
  (Join-Path $projectRoot ".env"),
  (Join-Path $projectRoot "apps\web\.env.local"),
  (Join-Path $projectRoot "apps\web\.env")
)

foreach ($envPath in $envPaths) {
  if (-not (Test-Path $envPath)) {
    continue
  }

  Get-Content $envPath | ForEach-Object {
    if ($_ -match "^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$") {
      $key = $Matches[1]
      if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
        [Environment]::SetEnvironmentVariable($key, $Matches[2].Trim('"'), "Process")
      }
    }
  }
}

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is not set. Add it to .env.local/.env or set it in the shell."
}

$env:CRM_AGENT_V2_REAL_E2E = "1"
$env:CRM_AGENT_V2_REAL_ACCOUNT_ID = [string]$RealAccountId
if ($Filter) {
  $env:CRM_AGENT_V2_REAL_E2E_FILTER = $Filter
} else {
  [Environment]::SetEnvironmentVariable("CRM_AGENT_V2_REAL_E2E_FILTER", $null, "Process")
}
$env:JITI_FS_CACHE = "false"
$env:JITI_MODULE_CACHE = "false"
$env:JITI_REBUILD_FS_CACHE = "true"

Write-Host "Running CRM Agent v2 real agent E2E tests"
node scripts/crm-agent-v2-real-agent-e2e-tests.mjs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
