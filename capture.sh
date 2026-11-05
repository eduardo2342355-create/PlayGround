#!/usr/bin/env bash
set -euo pipefail

# Capture the deployed preview without touching the running app.
# Usage:
#   CAPTURE_URL=https://... CAPTURE_DIR=/path/outside/source bash capture.sh
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project}"

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p test -f "$PROJECT_DIR/scripts/capture.mjs"
/usr/bin/time -p env \
  CAPTURE_URL="$CAPTURE_URL" \
  CAPTURE_DIR="$CAPTURE_DIR" \
  PROJECT_DIR="$PROJECT_DIR" \
  node "$PROJECT_DIR/scripts/capture.mjs"
