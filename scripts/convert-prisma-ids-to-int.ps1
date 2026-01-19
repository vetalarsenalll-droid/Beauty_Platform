param(
  [string]$SchemaPath = "C:\Users\Nadin\BeautyPlatform\packages\db\prisma\schema.prisma"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SchemaPath)) {
  Write-Error "Schema not found: $SchemaPath"
}

$raw = Get-Content -Path $SchemaPath -Raw -Encoding UTF8
$lines = $raw -split "`r?`n"
$relationFields = @{}

foreach ($line in $lines) {
  if ($line -match "@relation" -and $line -match "fields:") {
    if ($line -match "fields:\s*\[([^\]]+)\]") {
      $fields = $matches[1].Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
      foreach ($f in $fields) { $relationFields[$f] = $true }
    }
  }
}

Write-Host "Relation fields detected: $($relationFields.Keys.Count)"

$idReplacements = 0
$fkReplacements = 0

$out = foreach ($line in $lines) {
  if ($line -match "^(\s*)id\s+String\s+@id\b") {
    "$($matches[1])id Int @id @default(autoincrement())"
    $idReplacements++
    continue
  }
  if ($line -match "^(\s*)id\s+String\s+@id\s+@default\([^\)]*\)") {
    "$($matches[1])id Int @id @default(autoincrement())"
    $idReplacements++
    continue
  }

  $changed = $false
  foreach ($f in $relationFields.Keys) {
    if ($line -match "^\\s*$f\\s+String\\?") {
      ($line -replace "^(\\s*$f\\s+)String\\?", "`$1Int?")
      $changed = $true
      $fkReplacements++
      break
    }
    if ($line -match "^\\s*$f\\s+String\\b") {
      ($line -replace "^(\\s*$f\\s+)String\\b", "`$1Int")
      $changed = $true
      $fkReplacements++
      break
    }
  }
  if (-not $changed) { $line }
}

$text = $out -join "`r`n"
foreach ($f in $relationFields.Keys) {
  $escaped = [regex]::Escape($f)
  $patternNullable = "(?m)^(\\s*)$escaped\\s+String\\?"
  $patternRequired = "(?m)^(\\s*)$escaped\\s+String\\b"

  $matchesNullable = [regex]::Matches($text, $patternNullable).Count
  if ($matchesNullable -gt 0) {
    $text = [regex]::Replace($text, $patternNullable, "`$1$f Int?")
    $fkReplacements += $matchesNullable
  }

  $matchesRequired = [regex]::Matches($text, $patternRequired).Count
  if ($matchesRequired -gt 0) {
    $text = [regex]::Replace($text, $patternRequired, "`$1$f Int")
    $fkReplacements += $matchesRequired
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($SchemaPath, $text, $utf8NoBom)
Write-Host "Done: IDs switched: $idReplacements, FKs switched: $fkReplacements in $SchemaPath (UTF-8 without BOM)"
