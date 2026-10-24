#!/usr/bin/env bash
# Packs dist/Dopamine.app into dist/Dopamine-mac.dmg with the drag-to-Applications window.
# Needs dmgbuild (pip install dmgbuild). Run scripts/bundle.sh first.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
APP="$ROOT/dist/Dopamine.app"
DMG="$ROOT/dist/Dopamine-mac.dmg"

[[ -d "$APP" ]] || { echo "Missing $APP — run scripts/bundle.sh first" >&2; exit 1; }
command -v dmgbuild >/dev/null || { echo "dmgbuild not found — pip install dmgbuild" >&2; exit 1; }

WORK="$(mktemp -d)"
MOUNT="$WORK/mounted"
mounted=false
cleanup() {
  if "$mounted"; then hdiutil detach "$MOUNT" >/dev/null || return; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

# The background is soft gradients over paper grain, which PNG can't compress: as a JPEG it's a
# tenth of the size and looks the same. One 2x image marked 144 dpi stays sharp on Retina screens.
sips -s format jpeg -s formatOptions 85 -s dpiWidth 144 -s dpiHeight 144 \
  "$ROOT/Resources/dmg/background@2x.png" --out "$WORK/background.jpg" >/dev/null

# The mounted disk's icon never shows larger than 256 pt, so it drops the 512 and 1024 px images.
iconutil -c iconset "$APP/Contents/Resources/AppIcon.icns" -o "$WORK/volume.iconset"
rm -f "$WORK"/volume.iconset/icon_{512x512,512x512@2x,256x256@2x,48x48}.png
iconutil -c icns "$WORK/volume.iconset" -o "$WORK/volume.icns"

echo "▸ Packing $DMG"
rm -f "$DMG"
dmgbuild -s scripts/dmg-settings.py \
  -D app="$APP" \
  -D background="$WORK/background.jpg" \
  -D icon="$WORK/volume.icns" \
  Dopamine "$DMG"
hdiutil verify "$DMG" >/dev/null
# Verify the delivered bundle, since Finder customizations can alter it after signing.
hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT" "$DMG" >/dev/null
mounted=true
codesign --verify --deep --strict "$MOUNT/$(basename "$APP")"
hdiutil detach "$MOUNT" >/dev/null
mounted=false
echo "✓ $DMG"
