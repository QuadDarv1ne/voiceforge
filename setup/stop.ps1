<#
.SYNOPSIS
  VoiceForge — остановка всех сервисов (Windows)
.DESCRIPTION
  Останавливает:
  1. Next.js dev-сервер (порт 3000)
  2. Piper mini-service (порт 3005)
.NOTES
  Запуск: powershell -ExecutionPolicy Bypass -File setup/stop.ps1
#>

$ErrorActionPreference = "SilentlyContinue"
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

Write-Step "Остановка VoiceForge сервисов"

# ── 1. Next.js (порт 3000) ────────────────────────────────────────
$stoppedNext = $false
$nextProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "next" }
if ($nextProcs) {
    $nextProcs | Stop-Process -Force
    Write-OK "Next.js остановлен"
    $stoppedNext = $true
} else {
    Write-Warn "Next.js не запущен"
}

# ── 2. Piper mini-service (порт 3005) ─────────────────────────────
$stoppedPiper = $false
$piperProcs = Get-Process -Name "bun" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "piper-local" }
if ($piperProcs) {
    $piperProcs | Stop-Process -Force
    Write-OK "Piper mini-service остановлен"
    $stoppedPiper = $true
} else {
    Write-Warn "Piper mini-service не запущен"
}

# ── 3. Итог ───────────────────────────────────────────────────────
Write-Host ""
if ($stoppedNext -or $stoppedPiper) {
    Write-Host "  Все сервисы остановлены." -ForegroundColor Green
} else {
    Write-Host "  Нечего останавливать — сервисы не были запущены." -ForegroundColor Yellow
}
Write-Host ""