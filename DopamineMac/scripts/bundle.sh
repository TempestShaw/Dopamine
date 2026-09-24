#!/usr/bin/env bash
# Builds Dopamine.app (universal binary + bundled web dashboard) into DopamineMac/dist/.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
APP="$ROOT/dist/Dopamine.app"
WEB="$ROOT/../DopamineWeb"

if [[ "${SKIP_WEB:-0}" != "1" ]]; then
  echo "▸ Building web dashboard"
  (cd "$WEB" && bun install --frozen-lockfile && bun run build)
fi

echo "▸ Building agent"
if swift build -c release --arch arm64 --arch x86_64 >/dev/null 2>&1; then
  BIN="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/DopamineMac"
else
  swift build -c release
  BIN="$(swift build -c release --show-bin-path)/DopamineMac"
fi

echo "▸ Assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Dopamine"
cp Resources/Info.plist "$APP/Contents/Info.plist"
if [[ -d "$WEB/out" ]]; then cp -R "$WEB/out" "$APP/Contents/Resources/web"; fi

# Ad-hoc signature so macOS will run it locally. macOS ties the Accessibility permission to the
# signature, so after rebuilding you may need to re-enable Dopamine in Privacy & Security.
codesign --force --deep --sign - "$APP"

(cd "$ROOT/dist" && ditto -c -k --keepParent Dopamine.app Dopamine-mac.zip)
echo "✓ $APP"
