 <#
.SYNOPSIS
  VoiceForge — автоматическая установка всех компонентов
.DESCRIPTION
  1. bun install — зависимости проекта
  2. Скачивание Piper TTS бинарника (Windows amd64)
  3. Скачивание 7 голосовых моделей (.onnx + .json)
 4. Проверка установки
.NOTES
  Запуск: powershell -ExecutionPolicy Bypass -File setup/setup.ps1
#>

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

# ── 1. Bun / зависимости ──────────────────────────────────────────
Write-Step "Установка зависимостей (bun install)"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Warn "bun не найден — устанавливаю через npm"
    npm install -g bun
}

bun install
Write-OK "Зависимости установлены"

# ── 2. Piper бинарник ─────────────────────────────────────────────
Write-Step "Установка Piper TTS"

$piperDir = Join-Path $root "piper-tts"
$piperBin = Join-Path $piperDir "piper\piper.exe"
$voicesDir = Join-Path $piperDir "voices"

if (Test-Path $piperBin) {
    Write-OK "Piper уже установлен: $piperBin"
} else {
    New-Item -ItemType Directory -Force -Path $piperDir | Out-Null

    $url = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
    $zip = Join-Path $piperDir "piper.zip"

    Write-Host "  Скачиваю $url ..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 300

    Write-Host "  Распаковываю..."
    Expand-Archive -Path $zip -DestinationPath $piperDir -Force
    Remove-Item $zip -Force

    if (Test-Path $piperBin) {
        Write-OK "Piper установлен: $piperBin"
    } else {
        Write-Err "piper.exe не найден после распаковки!"
        Write-Host "  Содержимое $piperDir :"
        Get-ChildItem $piperDir -Recurse | Select-Object FullName
        exit 1
    }
}

# ── 3. Голосовые модели ───────────────────────────────────────────
Write-Step "Установка голосовых моделей"

New-Item -ItemType Directory -Force -Path $voicesDir | Out-Null

$base = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"

$voices = @(
    # Russian
    @{ name = "ru_RU-dmitri-medium"; lang = "ru"; voice = "dmitri";  quality = "medium" }
    @{ name = "ru_RU-irina-medium";  lang = "ru"; voice = "irina";   quality = "medium" }
    @{ name = "ru_RU-denis-medium";  lang = "ru"; voice = "denis";   quality = "medium" }
    @{ name = "ru_RU-ruslan-medium"; lang = "ru"; voice = "ruslan";  quality = "medium" }
    # English (high quality)
    @{ name = "en_US-lessac-high";   lang = "en"; voice = "lessac";  quality = "high" }
    @{ name = "en_US-libritts-high"; lang = "en"; voice = "libritts"; quality = "high" }
    @{ name = "en_GB-alan-medium";   lang = "en"; voice = "alan";    quality = "medium" }
)

$downloaded = 0
$skipped = 0

foreach ($v in $voices) {
    $onnxFile = Join-Path $voicesDir "$($v.name).onnx"
    $jsonFile = Join-Path $voicesDir "$($v.name).onnx.json"

    if ((Test-Path $onnxFile) -and (Test-Path $jsonFile)) {
        Write-OK "$($v.name) — уже есть"
        $skipped++
        continue
    }

    # HuggingFace URL encoding: ru_RU -> ru%5FRU
    $langEnc = $v.lang + "_" + $v.name.Split("-")[0].Split("_")[1]
    $langEnc = $langEnc -replace "_", "%5F"
    $voiceEnc = $v.voice

    $onnxUrl = "$base/$($v.lang)/$langEnc/$voiceEnc/$($v.quality)/$($v.name).onnx?download=true"
    $jsonUrl = "$base/$($v.lang)/$langEnc/$voiceEnc/$($v.quality)/$($v.name).onnx.json?download=true"

    try {
        Write-Host "  Скачиваю $($v.name)..."
        Invoke-WebRequest -Uri $onnxUrl -OutFile $onnxFile -UseBasicParsing -TimeoutSec 600
        Invoke-WebRequest -Uri $jsonUrl -OutFile $jsonFile -UseBasicParsing -TimeoutSec 60
        $sizeMB = [math]::Round((Get-Item $onnxFile).Length / 1MB, 1)
        Write-OK "$($v.name) — $sizeMB МБ"
        $downloaded++
    } catch {
        Write-Err "$($v.name) — ошибка: $($_.Exception.Message)"
        Write-Warn "  URL: $onnxUrl"
    }
}

Write-Host "`n  Итого: $downloaded скачано, $skipped уже было"

# ── 4. Проверка ───────────────────────────────────────────────────
Write-Step "Проверка установки"

$allOK = $true

if (Test-Path $piperBin) {
    Write-OK "Piper binary: $piperBin"
} else {
    Write-Err "Piper binary не найден"
    $allOK = $false
}

$voiceFiles = Get-ChildItem $voicesDir -Filter "*.onnx" -ErrorAction SilentlyContinue
if ($voiceFiles.Count -ge 7) {
    Write-OK "Голосовые модели: $($voiceFiles.Count) шт."
} else {
    Write-Warn "Голосовые модели: только $($voiceFiles.Count) шт. (ожидалось 7)"
}

# ── 5. Итог ───────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allOK) {
    Write-Host "  Установка завершена успешно!" -ForegroundColor Green
} else {
    Write-Host "  Установка завершена с предупреждениями" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Запуск проекта:" -ForegroundColor White
Write-Host "    powershell -ExecutionPolicy Bypass -File setup/start.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "  Или вручную:" -ForegroundColor White
Write-Host "    1. bun run mini-services/piper-local/index.ts  (порт 3005)" -ForegroundColor Gray
Write-Host "    2. bun run dev                                 (порт 3000)" -ForegroundColor Gray
Write-Host ""
