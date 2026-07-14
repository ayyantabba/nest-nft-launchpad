$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$portableGit = Join-Path $root ".tools\mingit\cmd\git.exe"
$portableBin = Join-Path $root ".tools\mingit\mingw64\bin"
$git = Get-Command git -ErrorAction SilentlyContinue

if ($git) {
  $gitPath = $git.Source
} elseif (Test-Path $portableGit) {
  $gitPath = $portableGit
  $env:PATH = (Split-Path $portableGit) + ";" + $portableBin + ";" + $env:PATH
  $env:GIT_EXEC_PATH = $portableBin
} else {
  throw "Git is not installed. Run scripts/install-prerequisites.ps1 first."
}

$secureToken = Read-Host "GitHub fine-grained token (Contents: Read and write)" -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $env:NEST_GITHUB_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $env:GIT_ASKPASS = Join-Path $PSScriptRoot "git-askpass.cmd"
  $env:GIT_TERMINAL_PROMPT = "0"

  Push-Location $root
  try {
    & $gitPath --git-dir=.repo-git --work-tree=. -c credential.helper= -c http.sslBackend=openssl push -u origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed." }
  } finally {
    Pop-Location
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  Remove-Item Env:NEST_GITHUB_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_ASKPASS -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_TERMINAL_PROMPT -ErrorAction SilentlyContinue
}

Write-Host "Nest pushed to https://github.com/ayyantabba/nest-nft"
