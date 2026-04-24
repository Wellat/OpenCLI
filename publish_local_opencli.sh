#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> Building OpenCLI from local source..."
npm run build

echo "==> Linking local package globally..."
npm link

echo "==> opencli path: $(which opencli)"
echo "Use Example:"
echo "opencli jisilu cb-detail 128145 -f json"

