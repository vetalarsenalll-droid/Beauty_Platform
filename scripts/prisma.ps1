param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("studio","migrate-dev","migrate-deploy","generate","validate")]
  [string]$Command
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$schemaPath = Join-Path $projectRoot "packages\db\prisma\schema.prisma"

if (-not $env:DATABASE_URL) {
  $envPath = Join-Path $projectRoot ".env"
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
      if ($_ -match "^DATABASE_URL=(.+)$") {
        $env:DATABASE_URL = $Matches[1]
      }
    }
  }
}

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is not set. Add it to .env or set it in the shell."
}

switch ($Command) {
  "studio" { npx prisma@6.19.1 studio --schema $schemaPath }
  "migrate-dev" { npx prisma@6.19.1 migrate dev --schema $schemaPath }
  "migrate-deploy" { npx prisma@6.19.1 migrate deploy --schema $schemaPath }
  "generate" { npx prisma@6.19.1 generate --schema $schemaPath }
  "validate" { npx prisma@6.19.1 validate --schema $schemaPath }
}
