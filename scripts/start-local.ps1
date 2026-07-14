$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is not installed. Run scripts/install-prerequisites.ps1 as Administrator first."
}

if (-not (Test-Path (Join-Path $root ".env"))) {
  & (Join-Path $PSScriptRoot "setup-local.ps1")
}

Push-Location $root
try {
  docker compose up --build -d
  docker compose ps
  Write-Host "Nest frontend: http://127.0.0.1:4178"
  Write-Host "Nest API health: http://127.0.0.1:8787/health"
} finally {
  Pop-Location
}
