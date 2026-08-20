#!/usr/bin/env bash
#
# VoiceForge — запуск всех сервисов (Linux / macOS)
#
# 1. Запускает Piper mini-service на порту 3005 (фон)
# 2. Запускает Next.js dev-сервер на порту 3000 (фон)
# 3. Проверяет здоровье сервисов и выводит ссылки
#
# Запуск: ./setup/start.sh
# Остановка: ./setup/stop.sh
#

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { echo -e "\n=== $1 ==="; }
ok()   { echo "  ✓ $1"; }
err()  { echo "  ✗ $1"; }

# Проверка что bun существует
if ! command -v bun >/dev/null 2>&1; then
    err "bun не найден. Установите: npm install -g bun"
    exit 1
fi

PIPER_PORT=3005
LOG_DIR="$ROOT/setup/logs"
mkdir -p "$LOG_DIR"

# ── 1. Piper mini-service ─────────────────────────────────────────
step "Запуск Piper mini-service (порт $PIPER_PORT)"

PIPER_RUNNING=false
if curl -sf "http://localhost:$PIPER_PORT/health" >/dev/null 2>&1; then
    PIPER_RUNNING=true
fi

if $PIPER_RUNNING; then
    ok "Piper mini-service уже работает (порт $PIPER_PORT)"
else
    PIPER_BIN="$ROOT/piper-tts/piper/piper"
    if [ ! -x "$PIPER_BIN" ]; then
        err "piper не найден: $PIPER_BIN"
        echo "  Сначала запустите установку:" 
        echo "    ./setup/setup.sh"
        exit 1
    fi

    # Запускаем фоном
    nohup bun run mini-services/piper-local/index.ts \
        > "$LOG_DIR/piper.log" 2> "$LOG_DIR/piper-err.log" &
    echo $! > "$LOG_DIR/piper.pid"

    # Ждём готовности (до 15 сек)
    ready=false
    for i in $(seq 1 15); do
        sleep 1
        if curl -sf "http://localhost:$PIPER_PORT/health" >/dev/null 2>&1; then
            ready=true
            break
        fi
    done

    if $ready; then
        ok "Piper mini-service запущен (порт $PIPER_PORT)"
    else
        err "Piper mini-service не смог запуститься. Лог: setup/logs/piper.log"
    fi
fi

# ── 2. Next.js dev-сервер ─────────────────────────────────────────
step "Запуск Next.js dev-сервера (порт 3000)"

NEXT_RUNNING=false
if curl -sf "http://localhost:3000/" >/dev/null 2>&1; then
    NEXT_RUNNING=true
fi

if $NEXT_RUNNING; then
    ok "Next.js уже работает (порт 3000)"
else
    nohup bun run dev \
        > "$LOG_DIR/next.log" 2> "$LOG_DIR/next-err.log" &
    echo $! > "$LOG_DIR/next.pid"

    # Ждём готовности (до 30 сек)
    ready=false
    for i in $(seq 1 30); do
        sleep 1
        if curl -sf "http://localhost:3000/" >/dev/null 2>&1; then
            ready=true
            break
        fi
    done

    if $ready; then
        ok "Next.js запущен (порт 3000)"
    else
        err "Next.js не смог запуститься. Лог: setup/logs/next.log"
    fi
fi

# ── 3. Итог ───────────────────────────────────────────────────────
step "Сервисы запущены"

echo ""
echo -e "  \033[32m🌐 Приложение:   http://localhost:3000\033[0m"
echo -e "  \033[32m🎙 Piper service: http://localhost:$PIPER_PORT/health\033[0m"
echo -e "  \033[90m📄 Логи:         setup/logs/\033[0m"
echo ""
echo -e "  \033[90mОстановка: ./setup/stop.sh\033[0m"
echo ""

# ── 4. Диагностика ────────────────────────────────────────────────
step "Проверка здоровья"

if curl -sf "http://localhost:3000/" >/dev/null 2>&1; then
    ok "Next.js (3000) — OK"
else
    err "Next.js (3000) — недоступен"
fi

if curl -sf "http://localhost:$PIPER_PORT/health" >/dev/null 2>&1; then
    ok "Piper ($PIPER_PORT) — OK"
else
    err "Piper ($PIPER_PORT) — недоступен"
fi

echo ""