# PROCESS-IMPROVEMENTS.md
# AI Agent Task List: Dev Process Optimization
# Kids P2P Marketplace — Solo Dev / Side Project
# Updated: 2026-03-01 — Added admin site coverage + Admin Config Impact Registry
# Upload to: /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/PROCESS-IMPROVEMENTS.md

---

## CONTEXT & ASSUMPTIONS

- Mobile stack: React Native + Expo, iOS/Android simulators only
- Admin stack: Next.js web app at /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
- Both apps share the same Supabase staging project
- CI: GitHub Actions (ci.yml) triggers on push + PR to main and develop
- Current CI checks: lint, type-check, test:ci
- Mobile test runner: Jest + Maestro (replacing Detox)
- Admin test runner: Jest (unit) + Playwright (browser E2E — installed but not fully configured)
- Admin has inconsistent Vitest imports — needs cleanup
- Solo dev, side project — prioritize low-friction, high-ROI changes only

---

## TASK PI-001: Install and Configure Maestro (Mobile)

**Priority:** CRITICAL — Do this first
**Goal:** Replace Detox as the UI E2E test runner with Maestro (zero native build required, works with Expo Go on simulator)

### Steps for Agent

1. Install Maestro CLI on the local machine:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   maestro --version
   ```
   For iOS simulator support, also install IDB companion:
   ```bash
   brew tap facebook/fb
   brew install idb-companion
   ```

2. Create the Maestro flows directory at the project root:
   ```
   /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/.maestro/
   ```

3. Create a Maestro config file `.maestro/config.yaml`:
   ```yaml
   flows:
     - "**/*.yaml"
   ```

4. Add `testID` props to any interactive UI components that don't already have them.
   - Search for components missing `testID` on: buttons, text inputs, navigation tabs, cards, modals
   - Convention: kebab-case, e.g., `testID="login-submit-button"`

5. Add npm scripts to `package.json`:
   ```json
   "test:maestro": "maestro test .maestro/",
   "test:maestro:ios": "maestro test .maestro/ --platform ios",
   "test:maestro:android": "maestro test .maestro/ --platform android"
   ```

6. Update `.gitignore`:
   ```
   .maestro/recordings/
   .maestro/screenshots/
   ```

**Verification:**
- [ ] `maestro --version` returns a version number
- [ ] `.maestro/` directory exists at project root
- [ ] npm scripts present in `package.json`

---

## TASK PI-002: Write Core Maestro Flow Files (Mobile Critical Paths)

**Priority:** CRITICAL
**Depends on:** PI-001
**Goal:** Cover the 5 most critical mobile user flows so manual verification is eliminated for these paths

### Flows to Create in `.maestro/`

| File | Flow | States to Cover |
|------|------|----------------|
| `auth-signup.yaml` | New user signup | happy path + existing email error |
| `auth-login.yaml` | Login | happy path + wrong password error |
| `listing-create.yaml` | Create a listing | happy path + missing field validation |
| `browse-search.yaml` | Browse feed + search | happy path + empty results |
| `subscription-overview.yaml` | Kids Club+ overview screen | all 6 states: free, trial, active, cancelled, grace, expired |

### Rules for Each Flow File
1. Search codebase for screen names, navigation routes, and `testID` values
2. Use `testID` locators; fall back to text labels only if `testID` missing
3. Add missing `testID` props to source files and note them
4. Include `assertVisible` after each major action
5. Handle loading with `waitForAnimationToEnd`
6. Add comment header: `# FLOW: <name> | States covered: <list>`

**Verification:**
- [ ] All 5 flow files exist in `.maestro/`
- [ ] `npm run test:maestro:ios` passes
- [ ] `npm run test:maestro:android` passes

---

## TASK PI-003: Fetch All App Flows and Expand Maestro Coverage (Mobile)

**Priority:** HIGH
**Depends on:** PI-002
**Goal:** Audit every mobile user-facing flow and generate Maestro YAML for uncovered flows

### STRICT VERIFICATION STANDARD (MANDATORY FOR PI-003)

Every Maestro YAML created or updated under this task MUST be strict, meaning a pass is accepted only when requirements are truly validated.

Strict rules:
1. No conditional pass masking:
   - Do NOT use `runFlow: when: ...` as the primary validation path.
   - Conditional blocks are allowed only for setup compatibility, never for final requirement assertions.
2. Mandatory hard assertions:
   - Add `assertVisible` after every major transition and at final expected state.
   - Every requirement mapped in the flow must have at least one hard assertion.
3. Deterministic preconditions:
   - Flow must explicitly set its start state (`clearKeychain`, `launchApp`, required navigation).
   - If preconditions fail, the flow must fail (no skip behavior).
4. Validation depth:
   - Cover at least one happy path + one negative/validation path per flow where applicable.
5. Data/result proof for mutation flows:
   - For flows that create/update data (e.g., listing create), include explicit UI postcondition assertion (success/error) and link to required DB/API verification step in docs.
6. Prohibited in strict flows:
   - Silent success by skipping all commands.
   - Text-only locators when a stable `testID` exists.

### Agent Prompt (paste this into Copilot Chat):

---

> **PROMPT — MOBILE FLOW AUDIT & MAESTRO EXPANSION**
>
> Perform a full audit of all user-facing flows in the React Native + Expo project and generate Maestro test flows for any flow not already covered by an existing `.maestro/*.yaml` file.
>
> **Step 1 — Discover all flows:**
> Search using: `flow-registry.md`, navigation files (AppNavigator, RootStack, TabNavigator,
> createStackNavigator, createBottomTabNavigator), screen files in `src/screens/`, existing `.maestro/` files.
>
> Output a table: `Flow Name | Screen(s) | Maestro Flow Exists (Y/N) | Priority (High/Med/Low)`
>
> **Step 2 — For flows marked N, generate `.maestro/<flow-name>.yaml`:**
> - Use `testID` locators; add missing `testID` props to source files
> - Include assertions after each major step
> - Handle async loading with `waitForAnimationToEnd`
> - For any flow with conditional rendering per state: cover ALL states, not just happy path
> - Enforce STRICT VERIFICATION STANDARD above (no skip-based pass)
>
> **Step 3 — Update registries:**
> - Update `flow-registry.md` with `maestro_flow` field per flow
> - Create `maestro-flows-registry.md` at `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/maestro-flows-registry.md`
>   with columns: Flow Name | YAML Path | States Covered | Last Verified Date
>
> **Rules:** No duplicate flows. No admin-only screens. npm not yarn. Simulators only.
> Show audit table first and wait for confirmation before generating YAML files.

---

**Verification:**
- [ ] `maestro-flows-registry.md` exists and populated
- [ ] `flow-registry.md` updated with `maestro_flow` references
- [ ] All High-priority flows have a `.maestro/*.yaml` file
- [ ] `npm run test:maestro` runs full suite without errors
- [ ] Every new/updated YAML includes strict preconditions + hard postcondition assertions
- [ ] No flow passes only via conditional skip blocks

---

## TASK PI-003-ADMIN: Fetch All Admin Flows and Expand Playwright Coverage (Admin)

**Priority:** HIGH
**Depends on:** PI-004
**Goal:** Audit every admin user-facing flow and generate Playwright tests for uncovered flows

### Agent Prompt (paste this into Copilot Chat):

---

> **PROMPT — ADMIN FLOW AUDIT & PLAYWRIGHT EXPANSION**
>
> Perform a full audit of all admin-facing flows in the Next.js admin project and generate Playwright test files for any flow not already covered by existing `p2p-kids-admin/e2e/*.e2e.test.ts` files.
>
> **Step 1 — Discover all admin flows:**
> Search using: `flow-registry.md`, admin navigation files (`p2p-kids-admin/src/app/` route files or `src/pages/`), admin screen/components in `p2p-kids-admin/src/`, and existing `p2p-kids-admin/e2e/` files.
>
> Output a table: `Flow Name | Screen(s) | Playwright Test Exists (Y/N) | Priority (High/Med/Low)`
>
> **Step 2 — For flows marked N, generate `p2p-kids-admin/e2e/<flow-name>.e2e.test.ts`:**
> - Use `data-testid` or `getByTestId()` locators; add missing `data-testid` props to admin source files
> - Include assertions after each major step
> - Use `beforeEach` to sign in (use test admin account or dev auth stub)
> - For any flow with conditional rendering per state: cover ALL states, not just happy path

> **Step 3 — Update registries:**
> - Update `flow-registry.md` with `playwright_flow` field per admin flow
> - Create `playwright-flows-registry.md` at `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/playwright-flows-registry.md`
>   with columns: Flow Name | Test Path | States Covered | Last Verified Date

> **Rules:** No duplicate flows. Exclude mobile-only flows. Use `npm` not `yarn`. Headless browser runs in CI.
> Show audit table first and wait for confirmation before generating test files.

---

**Verification:**
- [ ] `playwright-flows-registry.md` exists and populated
- [ ] `flow-registry.md` updated with `playwright_flow` references for admin flows
- [ ] All High-priority admin flows have a `p2p-kids-admin/e2e/*.e2e.test.ts` file
- [ ] `npm run test:playwright` runs the admin suite without config errors

## TASK PI-004: Fix Admin Test Stack Inconsistencies

**Priority:** CRITICAL for admin work
**Goal:** Clean up the admin test stack so it is consistent and fully runnable before adding new tests

### Issues to Fix
1. **Vitest imports in Jest project** — some unit tests import from `vitest` but `vitest` is not in `devDependencies`
2. **Playwright installed but not configured** — `@playwright/test` files exist but package is not in `devDependencies`

### Steps for Agent

1. **Audit all test files** in `/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin`:
   - Find all files importing from `vitest`
   - Find all files importing from `@playwright/test`
   - Output a table: `File | Current Import | Action Needed`

2. **Fix Vitest → Jest migration:**
   - Replace all `vitest` imports with Jest equivalents:
     - `import { describe, it, expect } from 'vitest'` → remove import (Jest globals are auto-injected)
     - `import { vi } from 'vitest'` → `import { jest } from '@jest/globals'` or use `jest.fn()` directly
   - Verify all affected tests pass with: `npm test`

3. **Install and configure Playwright properly:**
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
   npm install --save-dev @playwright/test
   npx playwright install chromium
   ```
   - Create `playwright.config.ts` at admin project root:
   ```typescript
   import { defineConfig } from '@playwright/test';
   export default defineConfig({
     testDir: './e2e',
     testMatch: '**/*.e2e.test.ts',
     use: {
       baseURL: 'http://localhost:3000',
       headless: true,
     },
   });
   ```
   - Add npm scripts to admin `package.json`:
   ```json
   "test:playwright": "playwright test",
   "test:playwright:headed": "playwright test --headed",
   "test:all": "npm test && npm run test:playwright"
   ```

4. **Verify all existing Playwright test files run** without errors:
   ```bash
   npm run test:playwright
   ```

**Verification:**
- [ ] `npm test` — all Jest unit tests pass with no vitest import errors
- [ ] `npm run test:playwright` — all Playwright tests run (pass or fail clearly, no config errors)
- [ ] No vitest imports remain in any test file
- [ ] `@playwright/test` is in `devDependencies`

---

## TASK PI-005: Build Admin Config Impact Registry

**Priority:** CRITICAL
**Goal:** Create a single document mapping every admin-configurable value to the mobile screens,
TC cases, and Maestro flows it affects — replacing the current "in your head" mapping

### Steps for Agent

1. **Audit all admin-configurable values** by searching:
   - Admin UI forms and settings pages in `p2p-kids-admin`
   - Supabase config/settings tables (e.g., `app_config`, `subscription_config`, or similar)
   - Any Edge Functions that read admin-set values
   - Mobile screens that display or use admin-configured values

2. **Create `ADMIN-CONFIG-IMPACT-REGISTRY.md`** at:
   `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/ADMIN-CONFIG-IMPACT-REGISTRY.md`

   Format:
   ```markdown
   # Admin Config Impact Registry
   Last updated: YYYY-MM-DD

   ## How to Use
   When you change an admin config value, find it in this table and run the
   listed mobile TC cases and Maestro flows as regression checks.

   | Config Key | Admin Screen | Default Value | Affects Mobile Screens | TC Cases to Rerun | Maestro Flows to Rerun |
   |------------|-------------|---------------|----------------------|-------------------|----------------------|
   | grace_period_days | Subscription Settings | 7 | KidsClubOverviewScreen, SubscriptionStatusCard | TC-05, TC-13 | subscription-overview.yaml |
   | monthly_price | Subscription Settings | $4.99 | KidsClubOverviewScreen, SubscriptionStatusCard | TC-13, TC-15 | subscription-overview.yaml |
   | ... | ... | ... | ... | ... | ... |
   ```

3. **For each config entry**, also note:
   - Is the value cached? If yes, how is cache invalidated?
   - Does changing it require an app restart or is it real-time?

4. **Link this registry from `flow-registry.md`** with a note:
   > "Before marking any admin story complete, check ADMIN-CONFIG-IMPACT-REGISTRY.md
   > for mobile regression checks required."

**Verification:**
- [ ] `ADMIN-CONFIG-IMPACT-REGISTRY.md` exists and covers all known config values
- [ ] Each entry has TC cases and Maestro flows listed
- [ ] `flow-registry.md` links to the registry

---

## TASK PI-006: Write Playwright Flows for Admin Critical Paths

**Priority:** HIGH
**Depends on:** PI-004 (Playwright properly installed)
**Goal:** Cover the most critical admin flows so manual verification of admin UI is eliminated

### Flows to Create in `p2p-kids-admin/e2e/`

| File | Flow | Config Impact |
|------|------|--------------|
| `admin-login.e2e.test.ts` | Admin login | None |
| `subscription-config.e2e.test.ts` | Change grace_period_days, monthly_price | High — triggers mobile regression |
| `user-management.e2e.test.ts` | View users, override subscription status | High |
| `analytics-dashboard.e2e.test.ts` | View analytics, verify data renders | Low |
| `listing-moderation.e2e.test.ts` | Approve/flag/remove listing | Medium |

### Rules for Each Playwright Test
1. Use `page.getByTestId()` locators where possible — add `data-testid` to admin components if missing
2. Assert on page state after each action, not just at the end
3. For config-change tests: after changing the value, add a comment noting which Maestro flows must be run on mobile to verify the downstream effect
4. Use `beforeEach` to log in; use `afterEach` to reset config values changed during the test

**Verification:**
- [ ] All 5 Playwright test files exist
- [ ] `npm run test:playwright` passes
- [ ] Admin components have `data-testid` props on all interactive elements

---

## TASK PI-007: Add Admin → Mobile Regression Step to CI

**Priority:** HIGH
**Depends on:** PI-001, PI-004, PI-005
**Goal:** When an admin story merges, CI automatically flags which mobile Maestro flows need to run

### Steps for Agent

1. **Update `ci.yml`** to add a job that:
   - Detects if changes touch the admin project (`p2p-kids-admin/**`)
   - If yes, outputs a summary of which Maestro flows to run based on `ADMIN-CONFIG-IMPACT-REGISTRY.md`
   - Runs the relevant Maestro flows on the iOS simulator

2. **Add a PR template** at `.github/PULL_REQUEST_TEMPLATE.md`:
   ```markdown
   ## Change Type
   - [ ] Mobile app change
   - [ ] Admin app change
   - [ ] Supabase migration / Edge Function
   - [ ] Config change

   ## If Admin Config Change — Mobile Regression Checklist
   Refer to ADMIN-CONFIG-IMPACT-REGISTRY.md and confirm:
   - [ ] Identified all affected mobile screens
   - [ ] Ran relevant Maestro flows on iOS simulator
   - [ ] Ran relevant Maestro flows on Android emulator
   - [ ] TC cases verified (happy path only if Maestro passed)

   ## Tests Run
   - [ ] `npm run test:unit` — PASSED
   - [ ] `npm run test:playwright` (admin) — PASSED
   - [ ] `npm run test:maestro:ios` (mobile) — PASSED
   ```

**Verification:**
- [ ] PR template appears on every new PR in GitHub
- [ ] CI job detects admin changes and outputs Maestro flow list

---

## TASK PI-008: Harden GitHub Actions CI Pipeline (Both Apps)

**Priority:** HIGH
**Depends on:** PI-001, PI-004
**Goal:** CI is a real quality gate for both mobile and admin; nothing merges without all tests green

### Steps for Agent

1. **Update `ci.yml`** — add jobs for:
   - Mobile Maestro flows (iOS simulator, `macos-latest`)
   - Admin Playwright tests (`ubuntu-latest`, headless Chromium)

2. **Enable branch protection** on `main` and `develop`:
   - Required status checks: `lint-and-test`, `maestro-tests`, `playwright-tests`
   - Require branches to be up to date before merging

3. **Add Supabase staging secrets** to GitHub Actions:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Used by both mobile integration tests and admin Playwright tests

**Verification:**
- [ ] Push test commit — CI runs all 3 jobs
- [ ] Branch protection active on `main` and `develop`
- [ ] Merge blocked if any job fails

---

## TASK PI-009: Establish Staging-First Edge Function Deployment

**Priority:** MEDIUM
**Goal:** Formalize deployment habit for when prod Supabase project is created

### Steps for Agent

1. Create `scripts/deploy-edge-function.sh`:
   ```bash
   #!/bin/bash
   FUNCTION_NAME=$1
   ENV=${2:-"--staging"}
   if [ "$ENV" == "--prod" ]; then
     echo "Deploying $FUNCTION_NAME to PRODUCTION..."
     supabase functions deploy $FUNCTION_NAME --project-ref $SUPABASE_PROD_PROJECT_REF
   else
     echo "Deploying $FUNCTION_NAME to STAGING..."
     supabase functions deploy $FUNCTION_NAME --project-ref $SUPABASE_STAGING_PROJECT_REF
   fi
   ```

2. Add npm scripts to `package.json`:
   ```json
   "deploy:function": "bash scripts/deploy-edge-function.sh",
   "deploy:function:prod": "bash scripts/deploy-edge-function.sh --prod"
   ```

3. Create `docs/DEPLOYMENT.md` documenting the process and staging-first rule.

**Verification:**
- [ ] Script exists and is executable
- [ ] `docs/DEPLOYMENT.md` documents the process
- [ ] Test deploy one existing Edge Function to staging using the new script

---

## TASK PI-010: Create the Story Done Checklist (Both Apps)

**Priority:** MEDIUM
**Goal:** Standardize "done" for both mobile and admin stories

### Create `docs/STORY-DONE-CHECKLIST.md`

```markdown
# Story Done Checklist
All automated gates must be GREEN before manual verification.

## Mobile Story Gates
- [ ] `npm run test:unit` — PASSED
- [ ] `RUN_SUPABASE_E2E=true npm run test:e2e` — PASSED
- [ ] `npm run test:maestro:ios` — PASSED
- [ ] `npm run test:maestro:android` — PASSED
- [ ] `npm run lint` + `npm run type-check` — PASSED
- [ ] CI pipeline green on feature branch

## Admin Story Gates
- [ ] `npm test` (Jest unit tests) — PASSED
- [ ] `npm run test:playwright` — PASSED
- [ ] `npm run lint` + `npm run type-check` — PASSED
- [ ] CI pipeline green on feature branch

## If Admin Config Changed
- [ ] Checked ADMIN-CONFIG-IMPACT-REGISTRY.md
- [ ] Ran all listed mobile Maestro flows
- [ ] Ran all listed TC cases (happy path)

## Supabase Checks (if story touches DB/functions)
- [ ] Required SQL run on staging
- [ ] Edge Function deployed to staging
- [ ] RLS policies verified

## Manual Verification (happy path only — target: 5 min)
- [ ] iOS simulator: primary happy path once
- [ ] Android emulator: primary happy path once
- [ ] No Metro bundler console errors
- [ ] DB state verified in Supabase Studio if data written

## Documentation
- [ ] `flow-registry.md` updated
- [ ] `maestro-flows-registry.md` updated (mobile)
- [ ] `ADMIN-CONFIG-IMPACT-REGISTRY.md` updated (admin config stories)
- [ ] Verification MD updated in `/Prompts/`
```

---

## EXECUTION ORDER

| Order | Task | Est. Time | Impact |
|-------|------|-----------|--------|
| 1 | PI-001: Install Maestro | 30 min | Unblocks mobile automation |
| 2 | PI-004: Fix admin test stack | 1 hr | Unblocks admin automation |
| 3 | PI-005: Admin Config Impact Registry | 1–2 hrs | Closes biggest gap |
| 4 | PI-002: Write 5 core mobile flows | 2–3 hrs | Eliminates most mobile manual verification |
| 5 | PI-010: Story Done checklist | 20 min | Standardizes done for both apps |
| 6 | PI-006: Playwright admin flows | 2 hrs | Eliminates admin manual verification |
| 7 | PI-008: Harden CI (both apps) | 1–2 hrs | Makes CI a real gate |
| 8 | PI-007: Admin → mobile regression in CI | 1 hr | Closes admin config impact gap |
| 9 | PI-003: Full mobile flow audit | 2–4 hrs | Full Maestro coverage |
| 10 | PI-009: Deployment script | 30 min | Prepares for prod launch |

---

## APPENDIX A: Agent Prompt Templates
See `AGENT-PROMPT-TEMPLATE.md` (separate file — covers both mobile and admin stories).
