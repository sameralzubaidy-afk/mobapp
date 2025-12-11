# Dependency Management & Lockfile Strategy

This file documents recommended steps to get a stable dependency environment for mobile (Expo) and admin (Next.js).

Goals:
- Keep a single canonical lockfile for the monorepo
- Reduce ERESOLVE & peer dependency conflicts
- Provide quick commands to recover a stable environment for iOS/Android dev

Recommended strategy

1. Choose a package manager and stick with it. Yarn (berry/classic) is recommended for Expo projects because it has `resolutions` support and stable dependency resolution. If you choose Yarn:

```bash
# Remove npm lockfile
rm package-lock.json
# Install using yarn and regenerate lockfile
yarn install
```

If you prefer npm, use the `overrides` field in `package.json` to align versions and use `npm install --legacy-peer-deps` when necessary.

2. To recover a local environment quickly (npm):

```bash
# from project root
rm -rf node_modules .expo ios/build android/.gradle
npm ci --legacy-peer-deps
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

3. To audit & find conflicting packages:

```bash
# see who depends on a package
npm why react
# or
yarn why react-native-svg
```

4. Example fixes
- If `react-native-svg` breaks with Fabric and expo/react-native version, prefer downgrading to a known compatible version (e.g., `^14.1.0`) or upgrade the RN/Expo stack.
- For this project (Expo SDK 54), we currently pin `react-native-svg` to `^14.2.0` for stability and to avoid Fabric incompatible native component registration errors.
- Use `resolutions` (Yarn) or `overrides` (npm) to pin deep dependencies if necessary.

5. Lockfile hygiene
- Keep only one lockfile per repository. Delete the other (commit the chosen lockfile).
- After pinning/resolving, run `npm ci` or `yarn install` and commit the updated lockfile.

6. Peer dep emergencies
- If you encounter ERESOLVE while installing, `npm install --legacy-peer-deps` is a pragmatic temporary workaround for developers, but a long-term solution is to align library versions.

7. Notes on patch-package
- Avoid keeping `patch-package` indefinitely unless there is no upstream fix. Prefer upstream fixes or downgrades that don't require node_modules patches.

---

If you want, I can run the recommended migration (choose Yarn or npm) and apply `resolutions`/`overrides` to pin problem packages. Tell me which package manager you'd like to standardize on and I will proceed.