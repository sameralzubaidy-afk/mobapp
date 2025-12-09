# Kids P2P Marketplace

Repository for the Kids P2P Marketplace mobile app (Expo React Native) and Supabase backend.

This repo contains:

- `p2p-kids-marketplace/` — Expo React Native app (TypeScript)
- `supabase/` — Supabase migrations and Edge Functions
- `.github/agents/` — AI agent configuration and helpers
- `Prompts/` — Module prompts and verification checklists (design & implementation guidance)

Next steps:

- Initialize git and create a GitHub remote (this repo can be created from local using GitHub CLI)
- Add `.env.example` with required secrets
- Scaffold Expo app: `npx create-expo-app p2p-kids-marketplace --template expo-template-blank-typescript`

CI/CD (GitHub Actions)
---------------------------------
This repository includes GitHub Actions workflows for the mobile app (located under `p2p-kids-marketplace/.github/workflows`) and top-level monorepo workflows under `.github/workflows/`.

Key workflows added:

- `.github/workflows/monorepo-ci.yml` — runs lint/type-check/tests for the mobile app and is a placeholder for admin checks.
- `.github/workflows/eas-build.yml` — EAS build workflow for mobile (runs on push to `main`).
- `.github/workflows/admin-ci-template.yml` — Template CI for the future admin panel (copy into admin repo or enable when admin code exists).

To initialize repo and set branch protection using GitHub CLI, run:

```bash
# from repo root
./scripts/setup-github-repo.sh <repo-name> <private|public>
```

Make sure to set GitHub Actions secrets (EXPO_TOKEN, SUPABASE_SERVICE_ROLE_KEY, SENTRY_AUTH_TOKEN) in repo settings.

