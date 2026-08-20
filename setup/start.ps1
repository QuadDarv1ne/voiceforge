<#
.SYNOPSIS
  VoiceForge — запуск всех сервисов (Windows)
.DESCRIPTION
  1. Запускает Piper mini-service на порту 3005 (фон)
  2. Запускает Next.js dev-сервер на порту 3000 (фон)
  3. Проверяет здоровье сервисов и выводит ссылки
.NOTES
  Запуск: powershell -ExecutionPolicy Bypass -File setup/start.ps1
  Остановка: powershell -ExecutionPolicy Bypass -File setup/stop.ps1
#>

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

# Проверка что bun существует
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Err "bun не найден. Установите: npm install -g bun"
    exit 1
}

# ── 1. Piper mini-service (порт 3005) ─────────────────────────────
Write-Step "Запуск Piper mini-service (порт 3005)"

$piperPort = 3005
$piperRunning = $false
try {
    $h = Invoke-RestMethod -Uri "http://localhost:$piperPort/health" -TimeoutSec 3
    if ($h.ok) { $piperRunning = $true }
} catch {
    $piperRunning = $false
}

if ($piperRunning) {
    Write-OK "Piper mini-service уже работает (порт $piperPort)"
} else {
    # Проверка что piper.exe установлен
    $piperExe = Join-Path $root "piper-tts\piper\piper.exe"
    if (-not (Test-Path $piperExe)) {
        Write-Err "piper.exe не найден: $piperExe"
        Write-Host "  Сначала запустите установку:" -ForegroundColor Yellow
        Write-Host "    powershell -ExecutionPolicy Bypass -File setup/setup.ps1" -ForegroundColor Gray
        exit 1
    }

    $logDir = Join-Path $root "setup\logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    # Запускаем фоном
    Start-Process -FilePath "bun.cmd" `
        -ArgumentList "run", "index.ts" `
        -WorkingDirectory (Join-Path $root "mini-services\piper-local") `
        -RedirectStandardOutput (Join-Path $logDir "piper.log") `
        -RedirectStandardError (Join-Path $logDir "piper-err.log") `
        -WindowStyle Hidden

    # Ждём готовности (до 15 сек)
    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $h = Invoke-RestMethod -Uri "http://localhost:$piperPort/health" -TimeoutSec 2
            if ($h.ok) { $ready = $true; break }
        } catch {}
    }

    if ($ready) {
        Write-OK "Piper mini-service запущен (порт $piperPort)"
    } else {
        Write-Err "Piper mini-service не смог запуститься. Лог: setup\logs\piper.log"
    }
}

# ── 2. Next.js dev-сервер (порт 3000) ─────────────────────────────
Write-Step "Запуск Next.js dev-сервера (порт 3000)"

$nextRunning = $false
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $nextRunning = $true }
} catch {
    $nextRunning = $false
}

if ($nextRunning) {
    Write-OK "Next.js уже работает (порт 3000)"
} else {
    $logDir = Join-Path $root "setup\logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    # Запускаем фоном
    Start-Process -FilePath "bun.cmd" `
        -ArgumentList "run", "dev" `
        -WorkingDirectory $root `
        -RedirectStandardOutput (Join-Path $logDir "next.log") `
        -RedirectStandardError (Join-Path $logDir "next-err.log") `
        -WindowStyle Hidden

    # Ждём готовности (до 30 сек)
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
    }

    if ($ready) {
        Write-OK "Next.js запущен (порт 3000)"
    } else {
        Write-Err "Next.js не смог запуститься. Лог: setup\logs\next.log"
    }
}

# ── 3. Итог ───────────────────────────────────────────────────────
Write-Step "Сервисы запущены"

Write-Host "`n  🌐 Приложение:   http://localhost:3000" -ForegroundColor Green
Write-Host "  🎙 Piper service: http://localhost:$piperPort/health" -ForegroundColor Green
Write-Host "  📄 Логи:         setup\logs\" -ForegroundColor Gray
Write-Host ""
Write-Host "  Остановка: powershell -ExecutionPolicy Bypass -File setup/stop.ps1" -ForegroundColor Gray
Write-Host ""

# ── 4. Диагностика (не блокирует) ────────────────────────────────
Write-Step "Проверка здоровья"

$checks = @(
    @{ Name = "Next.js (3000)"; Url = "http://localhost:3000/" },
    @{ Name = "Piper (3005)";   Url = "http://localhost:$piperPort/health" }
)

foreach ($c in $checks) {
    try {
        $r = Invoke-WebRequest -Uri $c.Url -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) {
            Write-OK "$($c.Name) — OK"
        } else {
            Write-Err "$($c.Name) — HTTP $($r.StatusCode)"
        }
    } catch {
        Write-Err "$($c.Name) — недоступен"
    }
}

Write-Host ""