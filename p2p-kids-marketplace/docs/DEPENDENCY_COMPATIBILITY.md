# Dependency Compatibility & Pinning Guidance

Goal: make sure native & UI libraries that interface with the Fabric/native boundary are pinned to versions known to be compatible with the project's React Native / Expo SDK. This reduces the chance that upstream upgrades accidentally change the prop types and reintroduce conversion crashes.

Key packages to keep consistent across the repo (recommended versions for this project):

- react-native: 0.81.5
- expo: ~54.0.27
- react-native-screens: 3.37.0  # important for sheet/detent props
- react-native-safe-area-context: 5.6.2  # matches the prebuilt/native pods used in the iOS generated project
- native-base: 3.4.28
- @react-navigation/native-stack: 7.8.6

Why these matter:
- `react-native-screens` and `react-native-safe-area-context` provide native views and bridge logic that frequently accept detents/enums and sizes. Version mismatches between JS and native headers can lead to type conversion errors.
- `native-base` and other theme-token-heavy UI libraries will pass theme tokens that may be strings; the app must resolve or sanitize those values before they reach native props.

Recommendations & how to use this doc
1. Pin the versions above in package.json (no ^ or ~) while experimenting in a feature branch.
2. Add a lightweight check script (provided in scripts/check-deps.js) to validate installed versions match the recommended set.
3. Before upgrading any pinned native lib, ensure:
   - You run the check-deps script.
   - Run the Detox e2e smoke test (macOS runner) to exercise native screens/sheets.
   - If native code (iOS pods) changes, run `npx expo prebuild`, `pod install` and local manual verification on simulator.

If you want, I can open a PR to pin these versions in `package.json` and add CI checks that run the checker on every PR.
