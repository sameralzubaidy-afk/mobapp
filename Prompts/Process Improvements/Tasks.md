# PROCESS-IMPROVEMENTS.md
# AI Agent Task List: Dev Process Optimization
# Kids P2P Marketplace — Solo Dev / Side Project
# Generated: 2026-03-01
# Upload to: /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/PROCESS-IMPROVEMENTS.md

---

## CONTEXT & ASSUMPTIONS

- Stack: React Native + Expo, Supabase (current project = staging, future paid project = prod)
- CI: GitHub Actions (`ci.yml`) triggers on push + PR to `main` and `develop`
- Current CI checks: lint, type-check, test:ci
- Test runner: Jest (unit offline, integration with RUN_SUPABASE_E2E=true hits staging Supabase)
- Detox: configured but never run due to Expo friction — REPLACING with Maestro
- No physical devices — iOS and Android simulators only
- Solo dev, side project — prioritize low-friction, high-ROI changes only

---

## TASK PI-001: Install and Configure Maestro

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
   # Maestro global config
   flows:
     - "**/*.yaml"
   ```

4. Add `testID` props to any interactive UI components that don't already have them.
   - Search the codebase for components missing `testID` on: buttons, text inputs, navigation tabs, cards, modals
   - Convention: use kebab-case, e.g., `testID="login-submit-button"`, `testID="create-listing-title-input"`

5. Add npm scripts to `package.json`:
   ```json
   "test:maestro": "maestro test .maestro/",
   "test:maestro:ios": "maestro test .maestro/ --platform ios",
   "test:maestro:android": "maestro test .maestro/ --platform android"
   ```

6. Update `.gitignore` to exclude Maestro recordings but include flow YAML files:
   ```
   .maestro/recordings/
   .maestro/screenshots/
   ```

**Verification:**
- [ ] `maestro --version` returns a version number
- [ ] `.maestro/` directory exists at project root
- [ ] npm scripts are present in `package.json`

---

## TASK PI-002: Write Core Maestro Flow Files (Critical Paths)

**Priority:** CRITICAL  
**Depends on:** PI-001  
**Goal:** Cover the 5 most critical user flows so manual verification of these paths is eliminated

### Flows to Create

Create the following YAML files in `.maestro/`:

| File | Flow |
|------|------|
| `auth-signup.yaml` | New user signup end-to-end |
| `auth-login.yaml` | Existing user login |
| `listing-create.yaml` | Create a new listing (item for sale/swap) |
| `browse-search.yaml` | Browse feed + search by keyword/category |
| `swap-points-wallet.yaml` | View SP wallet balance, transaction history |

### Instructions for Agent

For each flow file:
1. Search the codebase to identify the exact screen names, navigation routes, and `testID` values involved
2. Write the Maestro YAML using `tapOn`, `inputText`, `assertVisible`, `scrollUntilVisible` commands
3. Use `testID` locators where available; fall back to text labels only if `testID` is missing
4. Include a `# FLOW: <name>` comment header and list the screens traversed
5. Add assertions after each major action (not just at the end)
6. Handle loading states with `waitForAnimationToEnd` or `extendedWaitUntil`

### Example Structure
```yaml
# FLOW: auth-login
# Screens: LoginScreen → HomeScreen
# testIDs required: email-input, password-input, login-submit-button

appId: com.yourapp.p2pkids  # confirm bundle ID from app.json
---
- launchApp
- tapOn:
    id: "email-input"
- inputText: "testuser@example.com"
- tapOn:
    id: "password-input"
- inputText: "TestPassword123!"
- tapOn:
    id: "login-submit-button"
- assertVisible:
    id: "home-screen-feed"
```

**Verification:**
- [ ] All 5 flow files exist in `.maestro/`
- [ ] `npm run test:maestro:ios` runs without simulator errors
- [ ] Each flow passes on iOS simulator
- [ ] Each flow passes on Android emulator

---

## TASK PI-003: Fetch All App Flows and Expand Maestro Coverage

**Priority:** HIGH  
**Depends on:** PI-002  
**Goal:** Audit every user-facing flow in the app and generate Maestro YAML files for all flows not yet covered

### Agent Prompt (use this exact prompt with your AI agent in VS Code):

---

> **PROMPT — FLOW AUDIT & MAESTRO EXPANSION**
>
> I want you to perform a full audit of all user-facing flows in this React Native + Expo project and generate Maestro test flows for any flow not already covered by an existing `.maestro/*.yaml` file.
>
> **Step 1 — Discover all flows:**
> Search the codebase to identify every navigable screen and user flow. Use the following sources:
> - `flow-registry.md` (primary source)
> - Navigation files (e.g., `AppNavigator`, `RootStack`, `TabNavigator`, any file containing `createStackNavigator` or `createBottomTabNavigator`)
> - Screen files in `src/screens/` or equivalent
> - Any existing Maestro flows in `.maestro/`
>
> Output a table with columns: `Flow Name | Screen(s) Involved | Already Has Maestro Flow (Y/N) | Priority (High/Med/Low)`
>
> **Step 2 — Generate missing Maestro YAML files:**
> For every flow marked `N` (no Maestro flow), generate a `.maestro/<flow-name>.yaml` file.
> - Use `testID` locators for all interactive elements
> - If a component is missing a `testID`, add one in the source file and note it
> - Include assertions after each major step
> - Handle async loading with `waitForAnimationToEnd`
>
> **Step 3 — Update registries:**
> - Update `flow-registry.md` to mark each flow with a `maestro_flow` field pointing to the YAML file
> - If a `maestro-flows-registry.md` does not exist, create it at `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/maestro-flows-registry.md` listing all flows, their YAML path, and last-verified date
>
> **Rules:**
> - Do NOT create duplicate flows
> - Do NOT create flows for admin-only screens
> - Use `npm` not `yarn`
> - Target iOS and Android simulators only (no physical devices)
> - Ask me before running any SQL on Supabase
>
> Show me the full flow audit table first, then ask for my confirmation before generating the YAML files.

---

**Verification:**
- [ ] `maestro-flows-registry.md` exists and is populated
- [ ] `flow-registry.md` updated with `maestro_flow` references
- [ ] All High-priority flows have a `.maestro/*.yaml` file
- [ ] `npm run test:maestro` runs the full suite without errors

---

## TASK PI-004: Harden GitHub Actions CI Pipeline

**Priority:** HIGH  
**Depends on:** PI-001, PI-002  
**Goal:** Make CI a real quality gate — tests must pass before merge, Maestro runs on simulator in CI

### Steps for Agent

1. **Update `ci.yml`** to add Maestro flow testing as a new job:

```yaml
maestro-tests:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Install Maestro
      run: curl -Ls "https://get.maestro.mobile.dev" | bash
    - name: Install IDB Companion (iOS)
      run: |
        brew tap facebook/fb
        brew install idb-companion
    - uses: futureware-tech/simulator-action@v3
      with:
        model: 'iPhone 15'
    - name: Build Expo app for simulator
      run: npx expo run:ios --configuration Release --no-build-cache
    - name: Run Maestro flows
      run: ~/.maestro/bin/maestro test .maestro/
```

2. **Enable branch protection rules** on `main` and `develop` in GitHub:
   - Go to: GitHub repo → Settings → Branches → Add rule
   - Branch name pattern: `main`
   - Enable: "Require status checks to pass before merging"
   - Required checks: `lint-and-test`, `maestro-tests`
   - Enable: "Require branches to be up to date before merging"
   - Repeat for `develop`

3. **Update the existing `lint-and-test` job** to also run integration tests against staging Supabase:
   - Add `RUN_SUPABASE_E2E=true` as a GitHub Actions secret (value = `true`)
   - Add Supabase staging env vars as secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Add step: `run: npm run test:all` with env vars injected from secrets

4. **Add a `emulator-tests.yml` update** if the file exists — align Android emulator flow with the iOS approach above but using `ubuntu-latest` + Android emulator action.

**Verification:**
- [ ] Push a test commit to a feature branch
- [ ] CI runs `lint-and-test` AND `maestro-tests` jobs
- [ ] Both must be green before PR can merge to `main`
- [ ] Branch protection rules active on `main` and `develop`

---

## TASK PI-005: Establish Staging-First Edge Function Deployment

**Priority:** MEDIUM  
**Goal:** Stop deploying Edge Functions directly to the live Supabase project; always verify on staging first

### Context
- Current Supabase project = staging (app not live yet — this is correct)
- Future: paid Supabase project = prod (when app goes live)
- Today's goal: formalize the deployment habit so when prod exists, the pattern is already in place

### Steps for Agent

1. **Create a deployment script** at `scripts/deploy-edge-function.sh`:

```bash
#!/bin/bash
# Usage: ./scripts/deploy-edge-function.sh <function-name> [--prod]
# Default deploys to staging. Pass --prod to deploy to production.

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

2. **Add npm script** to `package.json`:
```json
"deploy:function": "bash scripts/deploy-edge-function.sh",
"deploy:function:prod": "bash scripts/deploy-edge-function.sh --prod"
```

3. **Create `docs/DEPLOYMENT.md`** documenting the deployment process, project refs, and the staging-first rule.

4. **Add environment variable template** `.env.example`:
```
SUPABASE_STAGING_PROJECT_REF=your_staging_ref
SUPABASE_PROD_PROJECT_REF=your_prod_ref_when_created
```

**Verification:**
- [ ] `scripts/deploy-edge-function.sh` exists and is executable
- [ ] `docs/DEPLOYMENT.md` documents the process
- [ ] Test: deploy one existing Edge Function using the new script to staging

---

## TASK PI-006: Create the "Story Done" Checklist Template

**Priority:** MEDIUM  
**Goal:** Standardize what "done" means per user story so manual verification is always the last 5-minute step, not a 30–60 minute exploratory session

### Steps for Agent

1. **Create `docs/STORY-DONE-CHECKLIST.md`**:

```markdown
# Story Done Checklist
Use this checklist before marking any user story as complete.
All automated items must be GREEN before proceeding to manual verification.

## Automated Gates (must all pass)
- [ ] `npm run test:unit` — all unit tests pass
- [ ] `npm run test:all` — integration tests pass against staging Supabase  
- [ ] `npm run test:maestro:ios` — Maestro flows pass on iOS simulator
- [ ] `npm run test:maestro:android` — Maestro flows pass on Android emulator
- [ ] `npm run lint` — no lint errors
- [ ] `npm run type-check` — no TypeScript errors
- [ ] CI pipeline green on feature branch (all jobs passing)

## Supabase Checks (if story touches DB/functions)
- [ ] Any required SQL has been run on staging (confirmed with developer)
- [ ] Edge Function deployed to staging (if applicable)
- [ ] RLS policies verified for new tables/columns

## Manual Verification (happy path only — target: 5 min)
- [ ] Open iOS simulator, navigate to the feature
- [ ] Execute the primary happy-path scenario once
- [ ] No console errors in Metro bundler output
- [ ] Verify DB state in Supabase Studio if data was written

## Documentation
- [ ] `flow-registry.md` updated if new screen/flow added
- [ ] `maestro-flows-registry.md` updated
- [ ] Verification MD file updated in `/Prompts/`
```

2. **Reference this checklist in the agent prompt template** (see TASK PI-007).

---

## TASK PI-007: Update Agent Prompt Template

**Priority:** HIGH  
**Goal:** Standardize the prompt you give your AI agent per user story to enforce the new testing strategy automatically

See the improved prompt template below in **APPENDIX A**.

---

## EXECUTION ORDER

| Order | Task | Est. Time | Impact |
|-------|------|-----------|--------|
| 1 | PI-001: Install Maestro | 30 min | Unblocks everything |
| 2 | PI-002: Write 5 core flows | 2–3 hrs | Eliminates most manual verification |
| 3 | PI-007: Update prompt template | 30 min | Every future story gets better automatically |
| 4 | PI-006: Story Done checklist | 20 min | Standardizes "done" definition |
| 5 | PI-004: Harden CI | 1–2 hrs | Makes CI a real gate |
| 6 | PI-003: Full flow audit + expansion | 2–4 hrs | Full Maestro coverage |
| 7 | PI-005: Deployment script | 30 min | Prepares for prod launch |

---

## APPENDIX A: Improved Agent Prompt Template

See `AGENT-PROMPT-TEMPLATE.md` (delivered as a separate file).
