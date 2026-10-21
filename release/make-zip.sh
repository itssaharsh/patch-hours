#!/usr/bin/env bash
# Builds the release packages and makes patch-hours-fire-tv.zip (run.sh, README.txt, the three .vpkg files).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/release/dist}"
(cd "$ROOT/tv" && npm run build:release)
STAGE="$(mktemp -d)/patch-hours-fire-tv"
mkdir -p "$STAGE/tv"
cp "$ROOT/release/run.sh" "$ROOT/release/README.txt" "$STAGE/"
for a in x86_64 aarch64 armv7; do cp "$ROOT/tv/build/$a-release/patchhours_$a.vpkg" "$STAGE/tv/"; done
chmod +x "$STAGE/run.sh"
mkdir -p "$OUT"
rm -f "$OUT/patch-hours-fire-tv.zip"
(cd "$(dirname "$STAGE")" && zip -qr "$OUT/patch-hours-fire-tv.zip" patch-hours-fire-tv)
echo "$OUT/patch-hours-fire-tv.zip"
