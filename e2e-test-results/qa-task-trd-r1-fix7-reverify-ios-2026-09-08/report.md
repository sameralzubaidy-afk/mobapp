# QA Task TRD-R1-FIX7 — FIX-Task-7 P1 Re-verify — iOS — BLOCKED-ON-BUILD

**Date:** 2026-09-08 · **Platform:** iPhone 17 Pro Max simulator (iOS 26.1, UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`) · **Run folder:** `e2e-test-results/qa-task-trd-r1-fix7-reverify-ios-2026-09-08/`

## Verdict: iOS legs NOT EXECUTED — BLOCKED-ON-BUILD (native app cannot run the current JS)

Per the brief's explicit instruction: *"If the on-device build predates the client changes, run the server-leg first and clearly mark the UX/copy legs as BLOCKED-ON-BUILD (do not fake them)."*

## Evidence / cause

1. **The only prebuilt iOS .app is stale:** the Debug build in DerivedData (`p2pkidsmarketplace-exfileeuuskaljdvjbketzkmhjmx/Build/Products/Debug-iphonesimulator/p2pkidsmarketplace.app`) lacks the `@react-native-community/netinfo` native module. On launch it raised a fatal LogBox: **"@react-native-community/netinfo: NativeModule.RNCNetInfo is null"**, then after dismiss: **"App entry not found — The app entry point named 'main' was not registered."** — the native shell cannot boot the current JS bundle.
2. **A fresh native rebuild fails at the RN-embed build phase** (3 attempts):
   - `npx expo run:ios` (with and without `--device`) → `CommandError: No code signing certificates are available` (CLI insists on signing).
   - Direct `xcodebuild -workspace ios/PassItUp.xcworkspace -scheme PassItUp -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build` → compiles all pods (netinfo pod present in Podfile.lock + scheme list) but **fails at the "Bundle React Native code and images" phase** (`Script-00DD1BFF1BD5951E006B06BC.sh`) — first due to a missing `sentry.options.json` (worked around with `SENTRY_COPY_OPTIONS_FILE=false`), then the RN `export:embed` phase still errors (error output truncated by the build's `tail`; needs a dev-agent build with full logs / clean environment).
3. iOS simulator was booted + app installed but the runtime error is a native-binary gap, not an app defect.

## Server-side coverage (NOT iOS UI coverage)

The P1 core is server-side and was verified against the shared staging backend (see the Android folder). The E02/D02/F02 discriminating DB assertions and the RPC guard behavior are platform-independent; the **Android** run drove them via the real open-dispute EF + the real UI Report-a-Problem path, plus the E03/E04/E05/E06 UI + admin legs, so the FIX-Task-7 P1 verification is complete on Android. **No iOS UI verdict is claimed here** (R80: do not fold other-platform PASS into an iOS closure).

## Recommended unblock (dev/ops, next session)

- A clean iOS dev-client rebuild with full logs (`npx expo run:ios` on a booted simulator, or `xcodebuild` with `SENTRY_COPY_OPTIONS_FILE=false` and the "Bundle React Native code and images" phase error surfaced), OR
- Provision `sentry.options.json` / disable the Sentry xcode phase properly, and diagnose the `export:embed` failure.
- Then re-run the E02 real-UI + E03/E04 + item-3/UX legs on iOS for per-platform evidence.

## Files
- `report.md` (this file) · screenshots/ (empty — no iOS UI executed)
