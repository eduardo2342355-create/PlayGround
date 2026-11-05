#!/usr/bin/env bash
set -euo pipefail

# Static site launcher for THE HOLLOW HOUR.
# Source and the built output stay inside PROJECT_DIR; worker metadata and
# deployment discovery live under OPENCODE_WEB_DIR.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
export PORT

WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
DEPLOYMENT_FILE="$WEB_DIR/deployment-output.json"
SERVE_DIR="$PROJECT_DIR"

/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p printf '%s' "{\"project\":\"$PROJECT_DIR\",\"directory\":\"$SERVE_DIR\"}" > "$DEPLOYMENT_FILE"

# Install dependencies and build only when this becomes a package project.
# The game itself is a pre-built static site (index.html + js/ + css/ + vendor/).
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi

  if [[ -x "$PROJECT_DIR/node_modules/.bin/vite" ]]; then
    /usr/bin/time -p "$PROJECT_DIR/node_modules/.bin/vite" build --base ./
    SERVE_DIR="$PROJECT_DIR/dist"
  elif /usr/bin/time -p npm run build --if-present; then
    if [[ -f "$PROJECT_DIR/dist/index.html" ]]; then
      SERVE_DIR="$PROJECT_DIR/dist"
    fi
  fi
fi

/usr/bin/time -p test -f "$SERVE_DIR/index.html"
/usr/bin/time -p printf '%s' "{\"project\":\"$PROJECT_DIR\",\"directory\":\"$SERVE_DIR\"}" > "$DEPLOYMENT_FILE"

# Keep the runtime's deployment writer away from the authoritative file above.
START_META_DIR="${RUNNER_TEMP:-/tmp}/omgithub-start-metadata"
/usr/bin/time -p mkdir -p "$START_META_DIR"
cd "$SERVE_DIR"

if [[ -n "${RUNTIME_DIR:-}" && -f "$RUNTIME_DIR/scripts/default-start.mjs" ]]; then
  exec /usr/bin/time -p env OPENCODE_WEB_DIR="$START_META_DIR" PORT="$PORT" node "$RUNTIME_DIR/scripts/default-start.mjs"
fi

# Portable fallback when the worker runtime is unavailable.
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$SERVE_DIR"
