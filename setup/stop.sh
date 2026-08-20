#!/usr/bin/env bash
#
# VoiceForge — остановка всех сервисов (Linux / macOS)
#
# Останавливает:
# 1. Next.js dev-сервер (порт 3000)
# 2. Piper mini-service (порт 3005)
#
# Запуск: ./setup/stop.sh
#

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { echo -e "\n=== $1 ==="; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ! $1"; }

step "Остановка VoiceForge сервисов"

LOG_DIR="$ROOT/setup/logs"
stopped=false

# ── 1. Next.js ────────────────────────────────────────────────────
if [ -f "$LOG_DIR/next.pid" ]; then
    PID="$(cat "$LOG_DIR/next.pid" 2>/dev/null)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        sleep 2
        kill -9 "$PID" 2>/dev/null || true
        ok "Next.js остановлен"
        stopped=true
    else
        warn "Next.js процесс не найден (PID $PID)"
    fi
    rm -f "$LOG_DIR/next.pid"
else
    # Fallback: ищем по имени процесса
    PIDS="$(pgrep -f 'next dev' 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill 2>/dev/null || true
        sleep 2
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        ok "Next.js остановлен"
        stopped=true
    else
        warn "Next.js не запущен"
    fi
fi

# ── 2. Piper mini-service ─────────────────────────────────────────
if [ -f "$LOG_DIR/piper.pid" ]; then
    PID="$(cat "$LOG_DIR/piper.pid" 2>/dev/null)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        sleep 1
        kill -9 "$PID" 2>/dev/null || true
        ok "Piper mini-service остановлен"
        stopped=true
    else
        warn "Piper процесс не найден (PID $PID)"
    fi
    rm -f "$LOG_DIR/piper.pid"
else
    PIDS="$(pgrep -f 'piper-local' 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill 2>/dev/null || true
        sleep 1
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        ok "Piper mini-service остановлен"
        stopped=true
    else
        warn "Piper mini-service не запущен"
    fi
fi

# ── 3. Итог ───────────────────────────────────────────────────────
echo ""
if $stopped; then
    echo "  Все сервисы остановлены."
else
    echo "  Нечего останавливать — сервисы не были запущены."
fi
echo ""