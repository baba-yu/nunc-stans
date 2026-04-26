#!/usr/bin/env bash
# ============================================================
#  Daily update script — POSIX equivalent of update_pages.bat.
#  Parses report/ + future-prediction/ markdown, recomputes
#  analytics, and writes docs/data/*.json for GitHub Pages.
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  PY="python"
fi

echo "[update_pages] $(date -Iseconds) running $PY -m src.cli update"
"$PY" -m src.cli update
echo "[update_pages] OK"
