<#
.SYNOPSIS
  Install the "mobile DSH" remote-access setup on this machine.

.DESCRIPTION
  Creates a DSH profile (default: "remote") based on the clean "web" profile,
  installs the mobile-adapt client plugin into it, and writes a start script
  that publishes the web UI through Tailscale Serve.

  Safe by design:
    - never touches the existing "desktop" or "remote" profiles unless asked
    - refuses to overwrite an existing target profile without -Force
    - does not modify Tailscale serve settings unless -Serve is passed

.PARAMETER WorkDir
  Folder used as the DSH working directory (sessions live under it).
  Default: current directory.

.PARAMETER ProfileName
  DSH profile to create. Default: remote.

.PARAMETER Port
  Local port for the web UI. Default: 3080.

.PARAMETER DshPath
  Path to dsh.cmd. Auto-detected when omitted.

.PARAMETER TailscalePath
  Path to tailscale.exe. Auto-detected when omitted.

.PARAMETER Force
  Overwrite the target profile if it already exists.

.PARAMETER Serve
  Also run "tailscale serve --bg <Port>" (changes this machine's Tailscale config).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1 -WorkDir "D:\work\dsh" -Port 3080
#>
param(
  [string]$WorkDir = (Get-Location).Path,
  [string]$ProfileName = 'remote',
  [int]$Port = 3080,
  [string]$DshPath,
  [string]$TailscalePath,
  [switch]$Force,
  [switch]$Serve
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host "[+] $msg" -ForegroundColor Cyan }
function Write-Warn([string]$msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host "[x] $msg" -ForegroundColor Red; exit 1 }

# ---- 1. locate dsh ------------------------------------------------------
Write-Step 'Locating DeepSeek Harness (dsh.cmd)...'
$candidates = @()
if ($DshPath) { $candidates += $DshPath }
$candidates += @(
  (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'),
  (Join-Path $env:ProgramFiles 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd')
)
if (${env:ProgramFiles(x86)}) {
  $candidates += (Join-Path ${env:ProgramFiles(x86)} 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd')
}
$dsh = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $dsh) { Fail 'dsh.cmd not found. Install DeepSeek Harness first, or pass -DshPath.' }
Write-Host "    $dsh"

# ---- 2. locate tailscale / device domain --------------------------------
Write-Step 'Locating Tailscale...'
$tsCandidates = @()
if ($TailscalePath) { $tsCandidates += $TailscalePath }
$tsCandidates += @('C:\Program Files\Tailscale\tailscale.exe')
$cmd = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if ($cmd) { $tsCandidates += $cmd.Source }
$ts = $tsCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $ts) { Fail 'tailscale.exe not found. Install Tailscale and sign in first.' }

$domain = $null
try {
  $status = & $ts status --json 2>$null | ConvertFrom-Json
  if ($status -and $status.Self -and $status.Self.DNSName) {
    $domain = $status.Self.DNSName.TrimEnd('.')
  }
} catch { }
if (-not $domain) { Fail 'Tailscale is not signed in (no device DNS name). Run "tailscale up" first.' }
Write-Host "    device domain: $domain"

# ---- 3. resolve DSH_HOME -------------------------------------------------
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profiles = Join-Path $dshHome 'profiles'
if (-not (Test-Path $profiles)) { Fail "DSH profile directory not found: $profiles" }

$webProfile = Join-Path $profiles 'web'
if (-not (Test-Path (Join-Path $webProfile 'package.json'))) {
  Write-Step 'The clean "web" profile is missing; asking DSH to materialise it...'
  try { & $dsh --profile web --help 2>$null | Out-Null } catch { }
}
if (-not (Test-Path (Join-Path $webProfile 'package.json'))) {
  Fail 'Could not create the "web" profile. Run "dsh --profile web --help" manually, then re-run this installer.'
}

$target = Join-Path $profiles $ProfileName
if (Test-Path $target) {
  if (-not $Force) { Fail "Profile '$ProfileName' already exists at $target. Pass -Force to overwrite." }
  Write-Warn "Removing existing profile: $target"
  Remove-Item $target -Recurse -Force
}

# ---- 4. create profile from the clean web template ----------------------
Write-Step "Creating profile '$ProfileName' from the web template..."
New-Item -ItemType Directory -Path $target -Force | Out-Null
robocopy $webProfile $target /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "Failed to copy profile template (robocopy $LASTEXITCODE)." }

# ---- 5. install the mobile-adapt plugin ---------------------------------
$pluginSrc = Join-Path $PSScriptRoot 'plugin\dsh-agent-mobile-adapt'
if (-not (Test-Path (Join-Path $pluginSrc 'client.js'))) { Fail "Plugin source missing: $pluginSrc" }
$pluginDst = Join-Path $target 'node_modules\dsh-agent-mobile-adapt'
New-Item -ItemType Directory -Path (Split-Path $pluginDst -Parent) -Force | Out-Null
robocopy $pluginSrc $pluginDst /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "Failed to copy plugin (robocopy $LASTEXITCODE)." }
Write-Host "    $pluginDst"

# ---- 6. patch package.json ----------------------------------------------
Write-Step 'Registering the plugin in the profile manifest...'
$pkgPath = Join-Path $target 'package.json'
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $pkg.dsh) {
  $pkg | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{ profile = [pscustomobject]@{ bundles = @() } })
}
if (-not $pkg.dsh.profile) {
  $pkg.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{ bundles = @() })
}
$bundles = @($pkg.dsh.profile.bundles)
if ($bundles -notcontains 'dsh-agent-mobile-adapt') {
  $pkg.dsh.profile.bundles = @($bundles + 'dsh-agent-mobile-adapt')
}

if (-not $pkg.dependencies) {
  $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{})
}
$pluginUri = 'file:' + ($pluginDst -replace '\\', '/')
$pkg.dependencies | Add-Member -NotePropertyName 'dsh-agent-mobile-adapt' -NotePropertyValue $pluginUri -Force

$pkgJson = $pkg | ConvertTo-Json -Depth 20
[IO.File]::WriteAllText($pkgPath, $pkgJson, (New-Object System.Text.UTF8Encoding($false)))

# ---- 7. write the start script ------------------------------------------
Write-Step 'Writing start script...'
$startCmd = Join-Path $WorkDir 'start-remote.cmd'
$startScript = @"
@echo off
chcp 65001 >nul
title DSH remote host ($ProfileName)
cd /d "$WorkDir"

echo Starting DSH host on http://127.0.0.1:$Port
echo   published as https://$domain/
echo Close this window to stop the host.
echo.

netstat -ano | findstr ":$Port " | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [WARN] Port $Port is already in use.
  pause
  exit /b 1
)

"$dsh" --profile $ProfileName --host 127.0.0.1 --port $Port --trusted-host $domain --public-url https://$domain/

echo.
echo Host exited with code %ERRORLEVEL%.
pause
"@
[IO.File]::WriteAllText($startCmd, $startScript, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "    $startCmd"

# ---- 8. optional tailscale serve ----------------------------------------
if ($Serve) {
  Write-Step "Publishing through Tailscale (serve $Port)..."
  & $ts serve --bg $Port
  if ($LASTEXITCODE -ne 0) { Write-Warn 'tailscale serve failed; run it manually.' }
} else {
  Write-Host ''
  Write-Host 'Next step: publish this machine on your tailnet with:' -ForegroundColor Yellow
  Write-Host "    `"$ts`" serve --bg $Port"
}

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "  profile : $target"
Write-Host "  start   : $startCmd"
Write-Host "  open    : https://$domain/"
Write-Host ''
Write-Host 'Phone: install Tailscale, sign in with the same account, open the URL above.'
Write-Host 'The first visit needs the ?token= URL printed by the start script (cookie lasts 30 days).'