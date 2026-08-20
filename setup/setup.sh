#!/usr/bin/env bash
#
# VoiceForge — автоматическая установка (Linux / macOS)
#
# 1. bun install — зависимости проекта
# 2. Скачивание Piper TTS бинарника (linux / darwin)
# 3. Скачивание 7 голосовых моделей (.onnx + .json)
# 4. Проверка установки
#
# Запуск: chmod +x setup/setup.sh && ./setup/setup.sh
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { echo -e "\n=== $1 ==="; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ! $1"; }
err()  { echo "  ✗ $1"; }

# ── 1. Bun / зависимости ──────────────────────────────────────────
step "Установка зависимостей (bun install)"

if ! command -v bun >/dev/null 2>&1; then
    warn "bun не найден — устанавливаю через npm"
    npm install -g bun
fi

bun install
ok "Зависимости установлены"

# ── 2. Piper бинарник ─────────────────────────────────────────────
step "Установка Piper TTS"

PIPER_DIR="$ROOT/piper-tts"
VOICES_DIR="$PIPER_DIR/voices"
PIPER_BIN="$PIPER_DIR/piper/piper"

if [ -x "$PIPER_BIN" ]; then
    ok "Piper уже установлен: $PIPER_BIN"
else
    mkdir -p "$PIPER_DIR"

    OS="$(uname -s)"
    case "$OS" in
        Linux*)
            URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
            EXT="tar.gz"
            ;;
        Darwin*)
            URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz"
            EXT="tar.gz"
            ;;
        *)
            err "Неподдерживаемая ОС: $OS"
            exit 1
            ;;
    esac

    ARCHIVE="$PIPER_DIR/piper.$EXT"
    echo "  Скачиваю $URL ..."
    curl -L -o "$ARCHIVE" "$URL" --fail --silent --show-error

    echo "  Распаковываю..."
    case "$EXT" in
        tar.gz) tar -xzf "$ARCHIVE" -C "$PIPER_DIR" ;;
        *)      err "Неизвестный формат архива" && exit 1 ;;
    esac
    rm -f "$ARCHIVE"

    # На случай если распаковалось в подпапку
    if [ ! -x "$PIPER_BIN" ]; then
        FOUND="$(find "$PIPER_DIR" -name piper -type f 2>/dev/null | head -1)"
        if [ -n "$FOUND" ]; then
            PIPER_BIN="$FOUND"
        fi
    fi

    if [ -x "$PIPER_BIN" ]; then
        chmod +x "$PIPER_BIN"
        ok "Piper установлен: $PIPER_BIN"
    else
        err "piper не найден после распаковки!"
        exit 1
    fi
fi

# ── 3. Голосовые модели ───────────────────────────────────────────
step "Установка голосовых моделей"

mkdir -p "$VOICES_DIR"

BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"

# Параметры: lang voice quality
VOICES=(
    "ru ru_RU dmitri medium"
    "ru ru_RU irina medium"
    "ru ru_RU denis medium"
    "ru ru_RU ruslan medium"
    "en en_US lessac high"
    "en en_US libritts high"
    "en en_GB alan medium"
)

downloaded=0
skipped=0

for v in "${VOICES[@]}"; do
    read -r lang langCode voice quality <<< "$v"
    NAME="${langCode}-${voice}-${quality}"

    ONNX="$VOICES_DIR/$NAME.onnx"
    JSON="$VOICES_DIR/$NAME.onnx.json"

    if [ -f "$ONNX" ] && [ -f "$JSON" ]; then
        ok "$NAME — уже есть"
        skipped=$((skipped + 1))
        continue
    fi

    # URL encoding: ru_RU -> ru%5FRU, en_GB -> en%5FGB
    LANG_ENC="${langCode//_/%5F}"

    ONNX_URL="$BASE/$lang/$LANG_ENC/$voice/$quality/$NAME.onnx?download=true"
    JSON_URL="$BASE/$lang/$LANG_ENC/$voice/$quality/$NAME.onnx.json?download=true"

    echo "  Скачиваю $NAME ..."
    if curl -L -o "$ONNX" "$ONNX_URL" --fail --silent --show-error \
        && curl -L -o "$JSON" "$JSON_URL" --fail --silent --show-error; then
        SIZE_MB="$(du -m "$ONNX" | cut -f1)"
        ok "$NAME — ${SIZE_MB} МБ"
        downloaded=$((downloaded + 1))
    else
        err "$NAME — ошибка скачивания"
        warn "  URL: $ONNX_URL"
    fi
done

echo ""
echo "  Итого: $downloaded скачано, $skipped уже было"

# ── 4. Проверка ───────────────────────────────────────────────────
step "Проверка установки"

ALL_OK=true

if [ -x "$PIPER_BIN" ]; then
    ok "Piper binary: $PIPER_BIN"
else
    err "Piper binary не найден"
    ALL_OK=false
fi

VOICE_COUNT="$(find "$VOICES_DIR" -name '*.onnx' 2>/dev/null | wc -l | tr -d ' ')"
if [ "$VOICE_COUNT" -ge 7 ]; then
    ok "Голосовые модели: $VOICE_COUNT шт."
else
    warn "Голосовые модели: только $VOICE_COUNT шт. (ожидалось 7)"
fi

# ── 5. Итог ───────────────────────────────────────────────────────
echo ""
echo "========================================"
if $ALL_OK; then
    echo "  Установка завершена успешно!"
else
    echo "  Установка завершена с предупреждениями"
fi
echo "========================================"
echo ""
echo "  Запуск проекта:"
echo "    ./setup/start.sh"
echo ""
echo "  Или вручную:"
echo "    1. bun run mini-services/piper-local/index.ts  (порт 3005)"
echo "    2. bun run dev                                 (порт 3000)"
echo ""