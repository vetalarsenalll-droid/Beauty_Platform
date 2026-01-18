$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\Nadin\BeautyPlatform"
Set-Location $projectRoot

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

npx prisma@6.19.1 studio --schema packages/db/prisma/schema.prisma
