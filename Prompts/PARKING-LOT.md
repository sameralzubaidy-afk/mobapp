## Parking Lot - Deferred / Optional Tasks test PR test new

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

### TASK: INFRA-006 - Sentry follow-up (parking)

Purpose: Finish Sentry integration verification and automation for both the React Native mobile app and the Next.js admin panel. This captures the remaining steps raised during the initial INFRA-006 work: dependency deduplication, successful EAS builds, native artifact uploads, and CI automation verification.

Acceptance criteria (what 'done' looks like):
- Mobile: EAS development build (dev client or full build) completes successfully and a native Sentry event (crash / native exception) is visible in Sentry for at least one release and environment.
- Mobile: JS sourcemaps and native artifacts (dSYM for iOS, mapping file for Android) are uploaded to Sentry and stack traces in Sentry map to TypeScript sources for at least one mobile release.
- Mobile: Duplicate native module issues resolved (no duplicate @sentry/react-native or async-storage versions causing autolinking/Gradle failures) and project has a single canonical lockfile.
- CI: GitHub Actions run the Sentry release steps (create release, upload sourcemaps, finalize) successfully using `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT_MOBILE` secrets.
- Admin: Next.js sourcemaps upload validated in Sentry and server & client events are mapped correctly for one release.
- Documentation updated: `docs/INFRA-006-SENTRY.md` (new) with verification steps, required env vars, and troubleshooting notes.

Steps to run locally / verify:
1. Standardize package manager: choose Yarn or npm, delete the other lockfile (`yarn.lock` or `package-lock.json`), and commit the chosen lockfile.
   ```bash
   # choose yarn (example)
   rm package-lock.json
   yarn install
   ```
2. Deduplicate Sentry & native dependencies:
   - Remove direct `@sentry/react-native` if `sentry-expo` is used, or pin both to the same version.
   - Align `@react-native-async-storage/async-storage` version across transitive deps (use `resolutions` in `package.json` if needed).
   ```bash
   # example: remove direct RN package if using sentry-expo
   yarn remove @sentry/react-native
   yarn add sentry-expo@latest
   ```
3. Run diagnostics & prebuild:
   ```bash
   npx -y expo-doctor --fix
   npx expo prebuild --platform android --no-install
   ```
4. Run an interactive EAS build (resolve credentials interactively if needed):
   ```bash
   npx eas build --platform android --profile development
   ```
   - If Gradle/autolinking errors occur, iterate on dependency pins and re-run `expo prebuild`.
5. Once build succeeds, set the release and run release upload script to Sentry:
   ```bash
   ./scripts/set-release.sh
   ./scripts/release-sentry.sh mobile
   ```
6. Install dev client (or release) on device/emulator, trigger `testSentryError()` (JS) and a native crash test, and confirm events arrive in Sentry with the expected `release` tag and mapped frames.
7. Validate admin sourcemap upload using `./scripts/release-sentry.sh admin` and trigger `/dev/sentry-test` endpoints to ensure events map correctly.
8. Add CI secrets and validate GitHub Actions run that performs the release and sourcemap upload non-interactively.

CI notes / requirements:
- Add repository secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_MOBILE`, `SENTRY_PROJECT_ADMIN`, `EXPO_TOKEN`.
- For non-interactive EAS builds, set up keystore credentials in EAS or configure `eas credentials` ahead of time (or use a secure secrets provider).
- Workflow should run `sentry-cli` steps after builds to upload sourcemaps and native artifacts. Confirm the step finishes with a success code and check Sentry release page for uploaded files.

Open questions / follow-ups:
- Do we prefer Yarn (recommended for Expo) or npm for the canonical lockfile across the monorepo? (affects CI and resolution strategies)
- For amplitude and other transitive deps causing duplicates, do we want temporary `resolutions` or update the upstream packages first?

Owner: @sameralzubaidy-afk
Priority: High
Status: In parking lot — ready to pick up when dependency issues and EAS build failures are scheduled to be resolved.

Files to update when completed:
- `docs/INFRA-006-SENTRY.md` (new verification + troubleshooting guide)
- `.github/workflows/sentry-release.yml` (ensure mobile steps included and secrets referenced)
- `Prompts/PARKING-LOT.md` (this entry will be removed when done)

Troubleshooting tips:
- If `expo-doctor` still reports duplicate native modules, run `yarn why <pkg>` to find which packages pull differing versions and either pin using `resolutions` or update/remove the offending dependency.
- For Gradle build logs, check the EAS job logs and the local `android/gradle` output after `npx expo prebuild` to find the autolinking/missing settings.gradle issues.


