param(
  [int]$RealAccountId = 2
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPaths = @(
  (Join-Path $projectRoot ".env.local"),
  (Join-Path $projectRoot ".env")
)

if (-not $env:DATABASE_URL) {
  foreach ($envPath in $envPaths) {
    if (-not (Test-Path $envPath)) {
      continue
    }

    Get-Content $envPath | ForEach-Object {
      if ($_ -match "^\s*DATABASE_URL\s*=\s*(.+)\s*$") {
        $env:DATABASE_URL = $Matches[1].Trim('"')
      }
    }

    if ($env:DATABASE_URL) {
      break
    }
  }
}

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is not set. Add it to .env.local/.env or set it in the shell."
}

$env:CRM_AGENT_V2_INTEGRATION = "1"
$env:CRM_AGENT_V2_REAL_ACCOUNT_ID = [string]$RealAccountId

Write-Host "Running CRM Agent v2 integration tests with CRM_AGENT_V2_REAL_ACCOUNT_ID=$RealAccountId"
npm run test:crm-agent-v2:integration
