# E2E / Detox Testing (Local & CI)

This project includes a basic Detox E2E scaffold to run a smoke test on iOS and Android emulators.

Local requirements
- macOS + Xcode for iOS
- Android Studio + SDK + AVD for Android
- Node 18+ and project dependencies installed

Local commands (recommended):

1) Install dependencies
```
npm ci --legacy-peer-deps
```

2) Build native projects (Expo prebuild)
```
npm run e2e:build:ios        # prebuild + build iOS debug
npm run e2e:build:android    # prebuild + assemble Android debug
```

3) Run tests
```
npm run e2e:run:ios
npm run e2e:run:android
```

CI: GitHub Actions
- The workflow `.github/workflows/emulator-tests.yml` contains two jobs:
  - `ios-emulator` — macOS runner: prebuild, pod install, xcodebuild, install to simulator, run Detox tests.
  - `android-emulator` — ubuntu runner: setup emulator, prebuild, gradle build, install apk, run Detox tests.

Secrets required in GitHub repo (Settings → Secrets → Actions):
- `EXPO_TOKEN` (used during prebuild in macOS job)

Note: Detox + native testing can be finicky; CI runs sometimes require minor adjustments for simulator device names and build settings. If a CI run fails, paste the failing logs and I will iterate on the workflow.
