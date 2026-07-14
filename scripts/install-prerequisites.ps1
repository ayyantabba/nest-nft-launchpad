$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script from PowerShell opened as Administrator."
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "Windows Package Manager (winget) is required. Install or update App Installer from Microsoft Store."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  winget install --exact --id Git.Git --accept-package-agreements --accept-source-agreements
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  winget install --exact --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
}

Write-Host "Git and Docker Desktop installation commands completed. Restart PowerShell before continuing."
