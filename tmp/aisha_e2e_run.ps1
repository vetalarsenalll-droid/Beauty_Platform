$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:3000'
$account = 'beauty-salon'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$email = "autotest_$(Get-Date -Format 'yyyyMMdd_HHmmss')@example.com"
$pass = 'Passw0rd!123'
$regBody = @{ email=$email; password=$pass; accountSlug=$account; firstName='Auto'; lastName='Tester'; phone='+79990000000' } | ConvertTo-Json
$null = Invoke-WebRequest -Uri "$base/api/v1/auth/client/register" -Method POST -Body $regBody -ContentType 'application/json' -WebSession $session -UseBasicParsing

function Send-Chat([string]$msg,[int]$threadId){
  $body = @{ message=$msg; threadId=$threadId } | ConvertTo-Json
  $res = Invoke-WebRequest -Uri "$base/api/v1/public/ai/chat?account=$account" -Method POST -Body $body -ContentType 'application/json' -WebSession $session -UseBasicParsing
  $json = $res.Content | ConvertFrom-Json
  return $json.data
}

$scenarios = @(
  @('greeting', @('привет','как дела?','кто ты?')),
  @('client_actions', @('кака€ у мен€ ближайша€ запись?','кака€ у мен€ последн€€ запись?','отмени ее')),
  @('availability', @('на сегодн€ есть свободные окошки?','в центр на 19:00','женска€ стрижка'))
)

foreach($sc in $scenarios){
  $name = $sc[0]
  $msgs = $sc[1]
  $threadId = 0
  Write-Host "\n=== $name ==="
  foreach($m in $msgs){
    $out = Send-Chat $m $threadId
    if(-not $threadId){ $threadId = [int]$out.threadId }
    $reply = ($out.reply -replace "`r`n"," ")
    Write-Host "> $m"
    Write-Host "< $reply"
  }
}
