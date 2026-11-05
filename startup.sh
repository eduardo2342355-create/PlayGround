#!/usr/bin/env bash
set -euo pipefail

# Once-per-worker prerequisite for capture.sh: the shared Playwright runtime.
# The platform normally provisions it; repair it only when it is missing.
PLAYWRIGHT_ROOT="${OMGITHUB_PLAYWRIGHT_ROOT:-$HOME/.local/share/omgithub-playwright}"
if [[ ! -d "$PLAYWRIGHT_ROOT/node_modules/playwright" ]]; then
  if [[ -n "${RUNTIME_DIR:-}" ]]; then
    case "${RUNNER_OS:-Linux}" in
      macOS) setup_script="$RUNTIME_DIR/scripts/setup-mac-playwright.sh" ;;
      *) setup_script="$RUNTIME_DIR/scripts/setup-linux-playwright.sh" ;;
    esac
    if [[ -f "$setup_script" ]]; then
      /usr/bin/time -p bash "$setup_script"
    else
      echo "Playwright runtime missing and setup script not found: $setup_script" >&2
      exit 1
    fi
  else
    echo "Playwright runtime missing and RUNTIME_DIR is not set." >&2
    exit 1
  fi
fi
