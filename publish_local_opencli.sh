#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LOCK_FILE="$ROOT_DIR/package-lock.json"
STAMP_FILE="$ROOT_DIR/node_modules/.opencli_lockfile.sha256"
NEED_INSTALL=false

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  NEED_INSTALL=true
elif [ -f "$LOCK_FILE" ]; then
  CURRENT_HASH="$(shasum -a 256 "$LOCK_FILE" | awk '{print $1}')"
  SAVED_HASH="$(cat "$STAMP_FILE" 2>/dev/null || true)"
  if [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
    NEED_INSTALL=true
  fi
fi

if [ "$NEED_INSTALL" = true ]; then
  echo "==> Dependencies changed, running npm install..."
  npm install
  if [ -f "$LOCK_FILE" ]; then
    mkdir -p "$ROOT_DIR/node_modules"
    shasum -a 256 "$LOCK_FILE" | awk '{print $1}' > "$STAMP_FILE"
  fi
else
  echo "==> Dependencies unchanged, skipping npm install."
fi

echo "==> Building OpenCLI from local source..."
npm run build

echo "==> Linking local package globally..."
npm link

echo "==> Syncing adapters (clearing stale overrides)..."
OPENCLI_FETCH=1 node scripts/fetch-adapters.js

echo "==> opencli path: $(which opencli)"
echo "Use Example:"
echo "opencli jisilu cb-detail 128145 -f json"
