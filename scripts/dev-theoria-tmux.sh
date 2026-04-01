#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TMUX_SESSION="${THEORIA_TMUX_SESSION:-$(tmux display-message -p '#S' 2>/dev/null || true)}"
PORT="${THEORIA_PORT:-3876}"
VITE_PORT="5175"
WINDOW_NAME="theoria-app-${PORT}"
TARGET="${TMUX_SESSION}:${WINDOW_NAME}"
SERVER_CMD="cd \"${REPO_ROOT}\" && PORT=${PORT} bun run app:theoria"
VITE_CMD="cd \"${REPO_ROOT}/apps/theoria\" && THEORIA_PORT=${PORT} bun run dev:web"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health/live"

if [[ -z "${TMUX_SESSION}" ]]; then
  echo "No active tmux session detected. Start tmux first, then re-run this command."
  exit 1
fi

window_exists() {
  tmux list-windows -t "${TMUX_SESSION}" -F "#{window_name}" | grep -Fxq "${WINDOW_NAME}"
}

wait_for_server() {
  local max_attempts="${1:-120}"
  local attempt="1"

  while (( attempt <= max_attempts )); do
    if curl --silent --fail --output /dev/null "${HEALTH_URL}"; then
      return 0
    fi

    sleep 0.25
    attempt=$((attempt + 1))
  done

  echo "Backend did not become healthy at ${HEALTH_URL}."
  echo "Backend pane output:"
  tmux capture-pane -p -S - -t "${TARGET}.0"
  return 1
}

start() {
  if window_exists; then
    tmux kill-window -t "${TARGET}"
  fi

  # Create window with backend server in pane 0
  tmux new-window -t "${TMUX_SESSION}" -n "${WINDOW_NAME}" -d
  tmux send-keys -t "${TARGET}.0" "${SERVER_CMD}" C-m

  wait_for_server

  # Split horizontally: Vite dev server in pane 1
  tmux split-window -t "${TARGET}" -v -d
  tmux send-keys -t "${TARGET}.1" "${VITE_CMD}" C-m

  echo "Started Theoria dev in tmux session '${TMUX_SESSION}', window '${WINDOW_NAME}'."
  echo "  Pane 0: API server  → http://127.0.0.1:${PORT}"
  echo "  Pane 1: Vite (HMR)  → http://localhost:${VITE_PORT}"
  echo ""
  echo "Open http://localhost:${VITE_PORT} in your browser."
}

logs() {
  if ! window_exists; then
    echo "Window '${WINDOW_NAME}' is not running."
    exit 1
  fi

  tmux capture-pane -p -t "${TARGET}"
}

logs_full() {
  if ! window_exists; then
    echo "Window '${WINDOW_NAME}' is not running."
    exit 1
  fi

  tmux capture-pane -p -S - -t "${TARGET}"
}

stop() {
  if ! window_exists; then
    echo "Window '${WINDOW_NAME}' is not running."
    exit 0
  fi

  tmux kill-window -t "${TARGET}"
  echo "Stopped Theoria app window '${WINDOW_NAME}'."
}

usage() {
  cat <<'EOF'
Usage: scripts/dev-theoria-tmux.sh <start|logs|logs-full|stop>

Environment variables:
  THEORIA_PORT          API server port (default: 3876)
  THEORIA_TMUX_SESSION  Explicit tmux session name (default: current session)
EOF
}

case "${1:-}" in
  start)
    start
    ;;
  logs)
    logs
    ;;
  logs-full)
    logs_full
    ;;
  stop)
    stop
    ;;
  *)
    usage
    exit 1
    ;;
esac
