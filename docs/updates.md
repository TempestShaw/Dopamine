# Automatic updates

Dopamine uses Sparkle 2.10.0 on macOS and Velopack 1.2.161 on Windows. Updates download in the background and install on quit. A ready update exposes **Update and restart** in the native menu and dashboard. The dashboard uses paired `POST /update`; unpaired requests return 401, and an update that is not ready returns 409.

The first version containing these updaters must be installed manually by users of v0.0.4 or earlier. From then on, neither archive extraction nor manual app replacement is required. Configuration and SQLite history live outside the app bundle / installation directory.

## Release pipeline

- macOS bundles Sparkle and its helpers. `DopamineMac/scripts/feed.sh` signs the ZIP with the repository secret `SPARKLE_PRIVATE_KEY` and writes `appcast.xml`, with download links under the versioned release (`releases/download/v<version>/`). It also downloads the latest release's ZIP and lets Sparkle write a signed `.delta` from that build, so people on the previous version download only what changed. It fails if the new build is missing from the feed or left unsigned (a key that doesn't match `SUPublicEDKey`). Sparkle updates from the ZIP; `Dopamine-mac.dmg` (built by `DopamineMac/scripts/dmg.sh` with dmgbuild) is the drag-to-Applications download for new installs. The public key is in `Info.plist`. Preserve the private key across releases; never commit it. The feed points to `https://github.com/TempestShaw/Dopamine/releases/latest/download/appcast.xml`.
- Windows builds Native AOT, then runs `vpk pack`. Releases include `Dopamine-win.zip` (the complete Velopack portable layout), `Dopamine-win-Setup.exe`, a full `.nupkg`, and `releases.win.json`. Do not distribute just the bare EXE: it has no Velopack installation metadata or update helper.
- Increment all app versions, including macOS `CFBundleVersion`; Sparkle compares the build version. Add `docs/release-notes/v<version>.md` and publish through the existing Build workflow. Publication fails if the update feed or packages are absent.
- Updates are incremental on both platforms. Each release carries one full package and one delta from the release before it: `Dopamine<new>-<old>.delta` for Sparkle, `Dopamine-<version>-delta.nupkg` for Velopack. Windows CI runs `vpk download github` before `vpk pack` to get the base package, then keeps only this version's packages in the release and in its `releases.win.json`; Velopack's GitHub source walks back through earlier releases to chain deltas. Someone further behind, a modified installation, or a failed patch falls back to the full package. A build with the same version as the latest release, or no release yet, gets no delta.

The existing automatic-update switch stops future checks and downloads. Sparkle may still install an already prepared update when the app quits. macOS builds are not notarized. When the secrets `MACOS_CERT_P12` and `MACOS_CERT_PASSWORD` hold the self-signed certificate from `DopamineMac/scripts/make-signing-cert.sh`, every build carries the same signature and keeps its Accessibility permission across updates; without them CI signs ad hoc and the permission must be switched on again after each update. Keep that certificate across releases like the Sparkle key. Sparkle archive signatures verify update authenticity; they do not replace Developer ID signing or notarization. Windows installers currently have no Authenticode certificate.

## Verification

`cd DopamineWeb && bun test src && bun run build` checks the dashboard and update protocol. `cd DopamineMac && swift test` checks pairing and ready-state boundaries.

`tests/windows-updater/run.ps1` runs in Windows CI after Velopack packaging. It builds two AOT probe versions linked to the production updater, serves a local feed, and verifies background download, replacement and restart for both installed and portable apps. It uses a separate app identity and result file, without touching Dopamine data.

`DopamineMac/Tests/UpdaterSmoke/main.swift` is an isolated probe linked to the production updater. Package versions 1.0.0 and 2.0.0 with Sparkle, an EdDSA-signed local feed, a separate bundle identity and `SmokeResultPath`. A successful run records `launched 1.0.0`, `verified download`, and `launched 2.0.0`. It never starts the tracker or opens Dopamine's database.

For a real release check, install the updater-enabled version, publish a newer signed version, leave automatic checks enabled, and verify **Update and restart**, the new `/identify` version, unchanged pairing code and retained history. Test Gatekeeper and Accessibility permissions on real machines separately from CI.
