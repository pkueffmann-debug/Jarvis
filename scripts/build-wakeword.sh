#!/bin/bash
# Builds the OpenWakeWord standalone binary using PyInstaller.
# Output: resources/wakeword  (picked up by Electron extraResources)
# Run: npm run build:wakeword

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/services/oww-venv"
PY_SCRIPT="$PROJECT_DIR/services/wakeword-oww.py"
OUT_DIR="$PROJECT_DIR/resources"

echo "=== JARVIS Wake Word Builder ==="

# ── Ensure Python 3.11 ────────────────────────────────────────────────────
if command -v python3.11 &>/dev/null; then
  PYTHON="python3.11"
elif command -v python3.12 &>/dev/null; then
  PYTHON="python3.12"
elif command -v python3.10 &>/dev/null; then
  PYTHON="python3.10"
else
  echo "ERROR: Python 3.10/3.11/3.12 not found. Install via: brew install python@3.11"
  exit 1
fi
echo "Using $PYTHON ($($PYTHON --version))"

# ── Create venv if needed ─────────────────────────────────────────────────
if [ ! -f "$VENV_DIR/bin/pip" ]; then
  echo "Creating virtual environment..."
  $PYTHON -m venv "$VENV_DIR"
fi
PIP="$VENV_DIR/bin/pip"
PYINSTALLER="$VENV_DIR/bin/pyinstaller"

# ── Install dependencies ──────────────────────────────────────────────────
echo "Installing dependencies (this may take a few minutes on first run)..."
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet openwakeword pyaudio pyinstaller

# ── Download OWW models ───────────────────────────────────────────────────
echo "Downloading OpenWakeWord models..."
"$VENV_DIR/bin/python" -c "
import openwakeword
openwakeword.utils.download_models()
" 2>/dev/null || true

# ── Build binary ──────────────────────────────────────────────────────────
echo "Building standalone binary with PyInstaller..."
mkdir -p "$OUT_DIR"
cd "$PROJECT_DIR"

"$PYINSTALLER" \
  --onefile \
  --name wakeword \
  --distpath "$OUT_DIR" \
  --workpath /tmp/jarvis-pyinstaller-work \
  --specpath /tmp/jarvis-pyinstaller-spec \
  --noconfirm \
  --clean \
  "$PY_SCRIPT"

if [ -f "$OUT_DIR/wakeword" ]; then
  chmod +x "$OUT_DIR/wakeword"
  SIZE=$(du -sh "$OUT_DIR/wakeword" | cut -f1)
  echo ""
  echo "✓ Built: $OUT_DIR/wakeword ($SIZE)"
  echo "✓ Test:  $OUT_DIR/wakeword  (should print READY:model_name)"
else
  echo "ERROR: Build failed — wakeword binary not found in $OUT_DIR"
  exit 1
fi
