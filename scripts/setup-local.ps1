$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"
$examplePath = Join-Path $root ".env.example"

if (-not (Test-Path $envPath)) {
  Copy-Item -LiteralPath $examplePath -Destination $envPath
  Write-Host "Created .env from template."
} else {
  Write-Host ".env already exists; existing configured values will be preserved."
}

$content = Get-Content -Raw $envPath
if ($content.Contains("replace-with-at-least-32-random-characters")) {
  $secretBytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
  $secret = ([BitConverter]::ToString($secretBytes)).Replace("-", "").ToLowerInvariant()
  $content = $content.Replace("replace-with-at-least-32-random-characters", $secret)
  Set-Content -LiteralPath $envPath -Value $content -Encoding UTF8
  Write-Host "Created .env with a random local session secret."
}

Write-Host "Local setup is ready. Add Pinata/OpenSea keys to .env when required."
