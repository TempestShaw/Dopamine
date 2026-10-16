#!/usr/bin/env bash
# Writes the signed Sparkle feed for dist/Dopamine-mac.zip into dist/: appcast.xml, plus a small
# .delta patch from the previous release so most people download only what changed.
# Usage: SPARKLE_PRIVATE_KEY=… scripts/feed.sh <Sparkle bin directory>
# PREVIOUS_ZIP may name a local archive or URL to diff against; it defaults to the latest release.
# Run scripts/bundle.sh first.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TOOLS="${1:?Usage: scripts/feed.sh <Sparkle bin directory>}"
: "${SPARKLE_PRIVATE_KEY:?SPARKLE_PRIVATE_KEY must hold the Sparkle EdDSA private key}"
REPO="https://github.com/TempestShaw/Dopamine"
PREVIOUS_ZIP="${PREVIOUS_ZIP:-$REPO/releases/latest/download/Dopamine-mac.zip}"

plist_value() { /usr/libexec/PlistBuddy -c "Print $1" "$2"; }
VERSION="$(plist_value CFBundleShortVersionString "$ROOT/Resources/Info.plist")"
BUILD="$(plist_value CFBundleVersion "$ROOT/Resources/Info.plist")"

FEED="$(mktemp -d)"
trap 'rm -rf "$FEED"' EXIT
cp "$ROOT/dist/Dopamine-mac.zip" "$FEED/"

# Sparkle builds a delta from every older archive it finds beside the new one. A missing previous
# release, or one with this same build number, just means no delta: everyone gets the full ZIP.
if [[ "$PREVIOUS_ZIP" == http* ]]; then
  curl -fsSL "$PREVIOUS_ZIP" -o "$FEED/Dopamine-previous.zip" || rm -f "$FEED/Dopamine-previous.zip"
else
  cp "$PREVIOUS_ZIP" "$FEED/Dopamine-previous.zip" 2>/dev/null || true
fi
if [[ -f "$FEED/Dopamine-previous.zip" ]]; then
  unzip -p "$FEED/Dopamine-previous.zip" Dopamine.app/Contents/Info.plist > "$FEED/previous.plist" || true
  PREVIOUS_BUILD="$(plist_value CFBundleVersion "$FEED/previous.plist" 2>/dev/null || true)"
  rm -f "$FEED/previous.plist"
  if [[ -z "$PREVIOUS_BUILD" || "$PREVIOUS_BUILD" == "$BUILD" ]]; then
    echo "▸ Previous release is build '${PREVIOUS_BUILD:-unknown}': no delta"
    rm -f "$FEED/Dopamine-previous.zip"
  else
    echo "▸ Diffing build $BUILD against $PREVIOUS_BUILD"
  fi
else
  echo "▸ No previous release found: no delta"
fi

# Advertise only the new build; the previous archive is a delta input, not a download.
printf '%s' "$SPARKLE_PRIVATE_KEY" | "$TOOLS/generate_appcast" --ed-key-file - \
  --versions "$BUILD" --maximum-versions 1 --maximum-deltas 1 \
  --download-url-prefix "$REPO/releases/download/v$VERSION/" \
  --link "$REPO/releases/tag/v$VERSION" \
  "$FEED"
# generate_appcast skips an archive it can't use (bad code signature), or leaves it unsigned when the
# key doesn't match SUPublicEDKey, and still succeeds. Sparkle would refuse either feed.
grep -q "<sparkle:version>$BUILD</sparkle:version>" "$FEED/appcast.xml" || { echo "appcast.xml has no entry for build $BUILD" >&2; exit 1; }
grep -q 'Dopamine-mac.zip"[^>]*sparkle:edSignature=' "$FEED/appcast.xml" || { echo "Dopamine-mac.zip is not signed: does SPARKLE_PRIVATE_KEY match SUPublicEDKey?" >&2; exit 1; }

rm -f "$ROOT"/dist/*.delta
cp "$FEED/appcast.xml" "$ROOT/dist/"
cp "$FEED"/*.delta "$ROOT/dist/" 2>/dev/null || true
ls -l "$ROOT"/dist/appcast.xml "$ROOT"/dist/*.delta 2>/dev/null || true
