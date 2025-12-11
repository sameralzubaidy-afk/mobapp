# Peer Dependency & Lockfile Cleanup Steps

These steps help diagnose and fix peer dependency conflicts and lockfile inconsistencies across the monorepo.

1. Identify conflicting peers
```bash
# Find who depends on a package
npm why react-native-fast-image
# or
yarn why react-native-fast-image
```

2. Consider the safe path:
- If the dependency is optional, remove it or replace it; if it's required, update to a version compatible with your React version.

3. Use overrides (npm) or resolutions (yarn) to pin transitive dependencies:

**npm**
```json
{"overrides": {
  "some-lib": "x.y.z"
}}
```

**yarn** (package.json):
```json
{"resolutions": {
  "some-lib": "x.y.z"
}}
```

After adding overrides/resolutions, regenerate the lockfile:

```bash
# npm
npm install --legacy-peer-deps
# yarn
yarn install --check-files
```

4. Deduplicate packages and re-run doctor
```bash
npx npm-dedupe
npx -y expo-doctor --fix
```

5. Choose one lockfile
- Decide on `npm` or `yarn`. Remove the other lockfile and commit the chosen one.

```bash
# Example - choose yarn
rm package-lock.json
yarn install
```

6. CI Considerations
- Update CI workflows to use the chosen package manager's commands. For npm, use `npm ci --legacy-peer-deps` in the build steps for now.

7. Reproduce
- After these changes, run:

```bash
# From mobile app
rm -rf node_modules && npm ci --legacy-peer-deps
npx expo prebuild --platform ios --clean
cd ios && pod install
npx expo run:ios
```

If conflicts remain, iterate by locating the conflicting package with `npm why`/`yarn why` and pinning or upgrading upstream packages.

If you'd like, I can start by aligning the monorepo with a single package manager you prefer (npm or Yarn). That will make it easier to apply `resolutions` or `overrides` consistently and resolve the ERESOLVE failures automatically.