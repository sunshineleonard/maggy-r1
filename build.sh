#!/usr/bin/env bash
# Build the R1 version of Maggy into ./maggy/ (one bundled script, no CDN, no outside fonts).
# Needs: node + esbuild + three@0.169.0 available to node (run from a folder where they're installed: NODE_PATH).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p maggy/assets
STAMP=$(date +%Y%m%d%H%M)
npx esbuild src/main.js --bundle --minify --format=iife --target=chrome80 --outfile=maggy/app.js --log-level=warning
sed "s/app.js?v=BUILD/app.js?v=$STAMP/" src/index.html > maggy/index.html
echo "built maggy/ (app.js $(du -k maggy/app.js | cut -f1) KB, stamp $STAMP)"
