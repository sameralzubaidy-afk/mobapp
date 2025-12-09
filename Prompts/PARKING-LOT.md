## Parking Lot - Deferred / Optional Tasks

This file is a short living list of tasks we want to keep handy and trigger later. Each entry should include a short title, detailed acceptance criteria, and steps to run locally or in CI.

### TASK: INFRA-EMULATOR-SETUP (parking)

Purpose: Provide a tracked task for setting up iOS and Android SDKs and CI-friendly emulator jobs so we can run emulator-based E2E tests locally and in GitHub Actions.

When to run: Keep this in the parking lot until we're ready to fully automate local toolkit installation or allocate a macOS CI runner dedicated to iOS/Android builds.

Acceptance criteria (what 'done' looks like):
- Local macOS developer can run iOS simulator and Android emulator and run E2E tests (Detox) locally using the provided npm scripts.
- GitHub Actions `emulator-tests` workflow runs successfully on push / workflow_dispatch and completes Detox E2E tests on macOS (iOS) and ubuntu (Android) runners.
- Clear docs exist explaining how to configure and install Xcode, CocoaPods, Android Studio, SDKs, and AVDs.

Steps to run (local):
1. Install Xcode from App Store (macOS). Open Xcode once to accept licenses.
2. Install Xcode Command Line Tools and ensure `xcode-select` points at Xcode:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   xcrun simctl list devices
   ```
3. Install CocoaPods and run `pod install` in `ios/` after running `npx expo prebuild`.
4. Install Android Studio & SDK, create an AVD, ensure ANDROID_SDK_ROOT/ANDROID_HOME env vars are set and `adb` is on PATH.
5. From project root run:
   ```bash
   npm ci --legacy-peer-deps
   npm run e2e:build:ios
   npm run e2e:run:ios
   # AND / OR
   npm run e2e:build:android
   npm run e2e:run:android
   ```

CI notes (GitHub Actions):
- Ensure `EXPO_TOKEN` secret is added in the repository Secrets → Actions (used by ios prebuild step).
- The `emulator-tests.yml` workflow will prebuild and build for both iOS and Android then run Detox E2E tests. If the first run fails, review logs and adjust simulator/AVD names or SDK versions used by the jobs.

Open questions / follow-ups:
- Do we want CI jobs to run on every push to `main` or only via workflow_dispatch/PR gating? (parking until decide)
- Should we run E2E tests as part of the main PR checks or keep them in a separate, optional pipeline due to resource/time cost? (parking)

When ready, we can move this task from the parking lot and iterate on the CI runner or local instructions.
