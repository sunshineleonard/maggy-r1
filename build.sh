#!/usr/bin/env bash
# Build the R1 version of Maggy into ./maggy/ (one bundled script, no CDN, no outside fonts).
# Needs: node + esbuild + three@0.169.0 available to node (run from a folder where they're installed: NODE_PATH).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p maggy/assets
STAMP=$(date +%Y%m%d%H%M)
npx esbuild src/main.js --bundle --minify --format=iife --target=chrome80 --outfile=maggy/app.js --log-level=warning
# head tracking: separate bundle, only downloaded when the user turns tracking on (MediaPipe face detector, vendored: no CDN)
npx esbuild src/face.js --bundle --minify --format=iife --target=chrome80 --outfile=maggy/face.js --log-level=warning
MP="${NODE_PATH%%:*}/@mediapipe/tasks-vision"; [ -d "$MP/wasm" ] || { echo "mediapipe not found in NODE_PATH"; exit 1; }
mkdir -p maggy/vendor/mediapipe && cp "$MP"/wasm/vision_wasm_internal.{js,wasm} "$MP"/wasm/vision_wasm_nosimd_internal.{js,wasm} maggy/vendor/mediapipe/
[ -f vendor/blaze_face_short_range.tflite ] && cp vendor/blaze_face_short_range.tflite maggy/vendor/
sed "s/BUILD_STAMP/$STAMP/g" src/index.html > maggy/index.html
echo "built maggy/ (app.js $(du -k maggy/app.js | cut -f1) KB, stamp $STAMP)"
