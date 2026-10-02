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
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"
cp "$BIN" "$APP/Contents/MacOS/Dopamine"
# Local symbols only matter in a debugger; stripping them roughly halves the binary.
strip -x "$APP/Contents/MacOS/Dopamine"
SPARKLE="$APP/Contents/Frameworks/Sparkle.framework"
ditto "$ROOT/.build/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework" "$SPARKLE"
# Keep only what runs: no headers or module maps, no XPC services (those are for sandboxed apps,
# and Dopamine isn't one), and only the languages Dopamine speaks.
rm -rf "$SPARKLE"/{Headers,PrivateHeaders,Modules,XPCServices} "$SPARKLE"/Versions/B/{Headers,PrivateHeaders,Modules,XPCServices}
for lproj in "$SPARKLE"/Versions/B/Resources/*.lproj; do
  case "$(basename "$lproj")" in Base.lproj | en.lproj | zh_CN.lproj | zh_TW.lproj | zh_HK.lproj) ;; *) rm -rf "$lproj" ;; esac
done
cp Resources/Info.plist "$APP/Contents/Info.plist"
cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
if [[ -d "$WEB/out" ]]; then cp -R "$WEB/out" "$APP/Contents/Resources/web"; fi

# macOS ties the Accessibility permission to the signature. A stable certificate (CODESIGN_IDENTITY,
# or the one scripts/make-signing-cert.sh creates) keeps it across builds; ad hoc signing changes
# every build, so Dopamine has to be switched on again in Privacy & Security after each one.
IDENTITY="${CODESIGN_IDENTITY:-}"
if [[ -z "$IDENTITY" ]] && security find-certificate -c "Dopamine Self-Signed" >/dev/null 2>&1; then
  IDENTITY="Dopamine Self-Signed"
fi
echo "▸ Signing with ${IDENTITY:-ad hoc signature}"
codesign --force --deep --sign "${IDENTITY:--}" "$APP"
codesign --verify --deep --strict "$APP"

(cd "$ROOT/dist" && ditto -c -k --keepParent Dopamine.app Dopamine-mac.zip)
echo "✓ $APP"
