CI & EAS Build notes
=====================

This document explains the CI / EAS configuration used during our INFRA-004 verification and how to reproduce the EAS build locally.

Key points
----------
- CI runs from `.github/workflows/monorepo-ci.yml` — lint, type-check, tests run in `p2p-kids-marketplace` working-directory.
- EAS builds are defined in `.github/workflows/eas-build.yml` and run on pushes to `main` and tags matching `v*`.
- The EAS workflow intentionally avoids installing devDependencies (we remove problematic e2e-only tooling like `detox` from the CI install path) to keep builds fast and reproducible.

Why the EAS build failed on first runs
-------------------------------------
- Our EAS build requires an initialized EAS project (an `eas.json` and project configured). The job will attempt to `eas build` and may fail if `eas init` has not been run for this project.

How to configure EAS for CI (recommended)
-----------------------------------------
1. On a machine with the repo checked out, install EAS CLI and run in the mobile root:

```bash
# from p2p-kids-marketplace/
npm install -g eas-cli
eas login
eas init
```

2. Make sure `eas.json` is present and your project slug is configured.

3. Store EXPO/EAS related tokens as GitHub Actions secrets at the repository level:

- EXPO_TOKEN — used by EAS CLI in CI to authenticate with Expo / EAS

4. Push a tag (v1.2.3) or merge to `main` and the CI workflow will attempt an EAS build.

Notes & next steps
------------------
- We removed `detox` from devDependencies in CI workflows (and added a workflow step to remove it during EAS runs), because earlier runs failed with `ETARGET` when CI attempted to install a version that wasn't published.
- If your team uses Detox for e2e, keep it in `devDependencies` locally and use a separate job or matrix step for e2e tests that runs in CI agents set up for Detox.

If you want, I can: (a) create a stable `eas.json` and `eas` project config in the repo (requires Expo account + credentials), or (b) keep EAS CI disabled until team-level decisions on EAS setup are made.
