# CI/CD Setup & Verification

This file explains the GitHub Actions workflows in this repository and how to test/verify them locally and on GitHub.

Workflows present:

- p2p-kids-marketplace/.github/workflows/ci.yml — Mobile app CI: lint, type-check, tests, E2E detectors (present in mobile app).
- p2p-kids-marketplace/.github/workflows/emulator-tests.yml — Mobile emulator-based E2E tests (iOS/Android).
- .github/workflows/monorepo-ci.yml — Top-level monorepo CI that runs mobile-app checks and includes a disabled admin job (placeholder).
- .github/workflows/eas-build.yml — Top-level action to trigger EAS builds on main branch.
- .github/workflows/admin-ci-template.yml — Template workflow for the admin panel.

How to verify locally (quick smoke tests):

1. Lint and type-check (mobile):

```bash
cd p2p-kids-marketplace
npm ci --legacy-peer-deps
npm run lint
npm run type-check
npm run test:ci
```

2. Run the monorepo CI job locally (dry-run recommendation):

Use act (https://github.com/nektos/act) or create a small GitHub Actions workflow dispatch in GitHub UI to run.

3. EAS build (manual):

```bash
cd p2p-kids-marketplace
eas build --platform all --profile preview
```

Repository setup script
---------------------------------
Use the helper script `./scripts/setup-github-repo.sh` to quickly create the repository (requires gh CLI), create `main`/`develop` branches and attempt adding basic branch protection rules.

NOTE: Branch protection via API requires repository admin privileges. If API call fails, set protection through GitHub web UI: Settings → Branches → Add rule.
