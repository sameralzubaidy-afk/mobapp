# CI / E2E Setup (macOS)

This project includes a GitHub Actions workflow to run Detox iOS E2E tests on macOS runners: `.github/workflows/e2e-ios-macos.yml`.

Before running E2E on CI you must provide the following:

- EXPO_TOKEN (optional) — If you call Expo services in your tests. Add under repo Settings → Secrets.
- Ensure macOS CI runner has Xcode and CocoaPods (the workflow uses macOS hosted runners that already have these).

Notes / suggestions:

1. The e2e workflow runs `npx expo prebuild --platform ios --no-install` which generates `ios/` and native build artifacts. If you prefer a purely managed workflow you can instead run e2e on a development client.
2. If you hit `xcodebuild` or `pod` issues on CI, increase `timeout-minutes` in the workflow and check CocoaPods repo updates.
3. Many device/simulator build issues are environmental — if CI fails, open logs and ensure `pod install` succeeded and `xcodebuild` found the scheme.

If you want, I can also add a separate small workflow to run prebuild + `pod install` and upload the iOS build artifact for debugging (useful to fast-fail and inspect logs separately).
