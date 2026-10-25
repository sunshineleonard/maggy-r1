# Maggy for the Rabbit R1

Maggy (Magnolia) is a sassy Southern fairy who lives in a mason jar on your Rabbit R1.

This repository holds the web files the R1 installs, served by GitHub Pages:

- `maggy/` is Maggy herself (built output: `index.html`, `app.js`, `assets/`). Install URL: https://sunshineleonard.github.io/maggy-r1/maggy/
- `src/` is her source; `./build.sh` rebuilds `maggy/` (needs node, esbuild 0.24 and three 0.169).
- `probe/` checks what this R1's firmware supports (3D drawing, motion sensor, wheel, side button, camera) before Maggy is ported.

Only R1 web files live here: no keys, no personal data.

## Controls on the R1

- Tap the glass: poke her (tap four times fast and she gets testy).
- Scroll wheel: peek around her.
- Hold the side button: a gentle hello, or wake her nicely.
- Shake gently: wake her. Shake hard: she gets mad.
