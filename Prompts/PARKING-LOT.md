## Parking Lot - Deferred / Optional Tasks test PR

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

### NOTE: Temporary Supabase client defensive fix (added)

Purpose: Record a small defensive change made to allow the Expo app to start when Supabase env vars are missing in local development.

Details / rationale:
- File modified: `src/services/supabase/client.ts`
- Change: client now exports a minimal no-op stub when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set so the app won't crash on startup (previously threw `supabaseUrl is required`).
- Why: This enables frontend development (UI, navigation, E2E skeletons) on machines that don't yet have Supabase configured, and prevents noisy runtime crashes during early infra work.
- Next steps: When ready, remove the stub and rely on real env variables (or guard calls more precisely). Add an in-app dev banner that indicates Supabase is not configured for clarity.

Status: ✅ noted — safe to continue with Android/iOS verification and E2E work.

When ready, we can move this task from the parking lot and iterate on the CI runner or local instructions.

### TASK: SUPABASE-CLIENT-DEV-FALLBACK (cleanup & developer experience)

Purpose: Replace the temporary chainable no-op Supabase client stub with a robust, clearly-documented developer fallback that is safe, testable, and easy to detect during development. This avoids accidental outages or confusion and ensures the app clearly indicates whether it's running against a real Supabase backend.

Acceptance criteria (what 'done' looks like):
- Add a feature-flag / environment variable (e.g., EXPO_DEV_SUPABASE_STUB=true) to explicitly enable the stub in development only.
- Add a non-ambiguous in-app dev banner or toast when the stub is active: "Supabase not configured — running in fallback mode".
- Replace the current ad-hoc chainable stub with a small, tested implementation in `src/services/supabase/devStub.ts` that has unit tests ensuring chainable methods return safe responses and appropriate error codes.
- Update `.env.local.example` and README to document how to provide real `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` and how to disable the stub.
- Ensure `testSupabaseConnection()` in `src/utils/testSupabase.ts` can detect stub mode and logs an explicit message recommending filling in `.env.local`.
- Add an integration test (Jest) ensuring the app boots without throwing in both stub and real env configurations.

Files / places to change:
- `src/services/supabase/client.ts` (wire in feature flag and import devStub)
- `src/services/supabase/devStub.ts` (new file)
- `src/utils/testSupabase.ts` (detect stub and log clear message)
- `.env.local.example` (document new `EXPO_DEV_SUPABASE_STUB` variable)
- `README.md` (developer setup steps)
- `__tests__/supabase-dev-stub.test.ts` (unit tests)

Steps to run locally / verify:
1. Add `EXPO_DEV_SUPABASE_STUB=true` to `.env.local` (or leave blank to use real keys).
2. Start the app and look for the dev banner and console log indicating stub mode.
3. Run unit tests: `npm run test` — verify devStub tests and app-boot integration test pass.
4. With real `EXPO_PUBLIC_SUPABASE_*` keys populated, restart app — banner should not appear, and `testSupabaseConnection()` should attempt a real connection.

Priority: High (improves developer DX and avoids runtime confusion).

Owner: @sameralzubaidy-afk // TODO: assign a team owner in the next sprint

Notes / rationale:
- The temporary stub helped unblock early frontend work and emulator verification — this task makes that fallback explicit and safe to keep in the codebase if desired, or easy to remove once Supabase config is required.

