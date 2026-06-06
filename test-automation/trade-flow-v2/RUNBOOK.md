# TradeFlowV2 QA Runbook — Autonomous Agent Edition

**Module:** MODULE-15.1.2 TradeFlowV2
**Test guide:** `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Last updated:** 2026-05-31

---

## Overview

This suite runs **119 automated test cases** across the Kids P2P Marketplace app and admin portal.
QA interacts with it through a GitHub Copilot Agent in VS Code — one sentence triggers the full run.
The agent handles everything: booting the simulator, starting the admin portal, seeding data, running tests, filing GitHub Issues, and committing results.

**QA's job is: type a prompt → sit back → review the report.**

---

## How it works (architecture)

```
QA types a prompt in Copilot Agent chat
        │
        ▼
Agent reads .github/copilot-instructions.md  (auto-loaded context)
        │
        ▼
Agent runs:  bash test-automation/trade-flow-v2/scripts/run-suite.sh
        │
        ├── [1] preflight-setup.sh
        │       Boot iOS Simulator (if needed)
        │       Verify app is installed → fast-fail with fix message if not
        │       Start admin portal on :3001 (if not running)
        │       Run npm run seed:staging (idempotent — safe to always run)
        │
        ├── [2] run-tradeflow-suite.mjs  (orchestrator)
        │       Maestro → iOS Simulator  (Groups A–M, O, Q, R, REG)
        │       Maestro → Android Emulator (same groups, if available)
        │       Playwright → Admin portal  (Groups N, P, E, Q18-20, R)
        │       Writes e2e-test-results/<timestamp>/results.json + report.md
        │
        └── [3] post-run.sh
                File GitHub Issues for failures  (deduplicated, to sameralzubaidy-afk/mobapp)
                Write e2e-test-results/<timestamp>/issues-filed.md
                git add + git commit  (NO push — QA reviews first)

Agent reads report.md → posts summary to QA in chat
```

---

## Part 1 — One-time setup (do this once per machine)

### 1.1 Required tools

| Tool | Install command | Check |
|---|---|---|
| Node.js ≥ 18 | [nodejs.org](https://nodejs.org) | `node --version` |
| Maestro CLI | `curl -Ls "https://get.maestro.mobile.dev" \| bash` | `maestro --version` |
| Xcode CLI | `xcode-select --install` | `xcrun --version` |
| GitHub CLI (`gh`) | `brew install gh` | `gh --version` |
| Playwright browsers | `cd p2p-kids-admin && npx playwright install chromium` | — |

### 1.2 Authenticate GitHub CLI (required for Issue filing)

```bash
gh auth login
# Choose: GitHub.com → HTTPS → Login with browser
# Verify: gh auth status
```

### 1.3 Create the `.env` file

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
cp test-automation/trade-flow-v2/.env.example test-automation/trade-flow-v2/.env
```

Open `test-automation/trade-flow-v2/.env` and fill in:

```
APP_ID=com.p2pkidsmarketplace
PLAYWRIGHT_ADMIN_E2E=true
PLAYWRIGHT_ADMIN_EMAIL=test-admin@kidsmarketplace.test
PLAYWRIGHT_ADMIN_PASSWORD=<ask your team lead>
ADMIN_E2E_EMAIL=test-admin@kidsmarketplace.test
ADMIN_E2E_PASSWORD=<ask your team lead>
```

> **Never commit `.env`** — it is in `.gitignore`.

### 1.4 Install the app on the iOS Simulator (required once per Xcode/build update)

The agent boots the simulator but **cannot install the app** — that requires a build.

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npx expo run:ios
```

Wait for the app to appear on the simulator home screen before running any tests.
If you see `App com.p2pkidsmarketplace is NOT installed`, run the command above again.

### 1.5 Install admin portal dependencies (once)

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
npm install
npx playwright install chromium
```

---

## Part 2 — Running tests with the AI Agent

### Step 1 — Open VS Code in the workspace

```bash
code /Users/sameralzubaidi/Desktop/kids_marketplace_app
```

### Step 2 — Open Copilot Agent chat

- Press `Cmd+Shift+P` → type `Copilot: Open Chat`
- Or click the Copilot icon in the sidebar
- Make sure you are in **Agent mode** (not Chat mode) — look for the `@workspace` context indicator

### Step 3 — Paste a prompt and press Enter

The ready-to-use prompts are in:
```
test-automation/trade-flow-v2/AGENT-PROMPT.md
```

**Most common prompt (full suite):**

```
Run the complete TradeFlowV2 MODULE-15.1.2 test suite.

Execute fully autonomously from the workspace root using the run-suite.sh entry point.
Do not ask for confirmation at any step — proceed through preflight, test execution, and post-run automatically.

When done, tell me:
1. Total pass / fail / skip counts
2. Which test groups had failures (if any) and a one-line root cause per failure
3. Links to any GitHub Issues that were filed
4. The path to the full report
```

**Other prompts available in `AGENT-PROMPT.md`:**
- iOS only
- Admin portal only
- Specific group(s)
- After a code change (targeted regression)
- Investigate a previous failure
- Dry run / health check
- First-time environment setup

### Step 4 — Wait for the agent to finish

The agent will:
1. Run `run-suite.sh` (visible in the terminal panel)
2. Post a summary in the chat when done
3. Include links to filed GitHub Issues
4. Tell you the path to the full report

Typical run time: **30–90 minutes** for the full suite (device speed varies).
Admin-only Playwright run: **5–10 minutes**.

### Step 5 — Review the report

The agent will give you the path. Open it:

```
e2e-test-results/<timestamp>/report.md
```

Or open all three result files:

```
e2e-test-results/<timestamp>/
├── report.md          ← read this first
├── results.json       ← machine-readable (for CI / further automation)
└── issues-filed.md    ← links to GitHub Issues created for this run
```

### Step 6 — Push the committed results to the repo

The agent commits but **never pushes**. When you are satisfied with the results:

```bash
git log --oneline -5    # review the commit
git push
```

---

## Part 3 — Running tests manually (without the AI Agent)

If you prefer running from the terminal directly:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Full suite (autonomous — preflight + run + post-run)
bash test-automation/trade-flow-v2/scripts/run-suite.sh

# Or via npm
npm run test:e2e
```

### Targeted runs

```bash
# iOS Maestro only
npm run test:e2e:ios

# Android Maestro only
npm run test:e2e:android

# Admin portal Playwright only
npm run test:e2e:admin

# Specific groups (pass extra flags after --)
npm run test:e2e -- --group N,P

# Specific test case
npm run test:e2e -- --case TC-N01

# Stop on first failure
npm run test:e2e -- --bail

# Preview what would run without executing
npm run test:e2e:dry

# Skip environment checks (use only if env is known-good)
npm run test:e2e -- --no-preflight

# List all planned execution units
npm run tfv2:list
```

---

## Part 4 — Understanding the results

### Pass / Fail / Skip meanings

| Symbol | Meaning | QA action |
|---|---|---|
| ✅ PASS | All attempts passed | No action |
| ❌ FAIL | All retries failed | Read `stderrTail` in report, check filed GitHub Issue |
| ⏭ SKIP (manual) | Needs clock fast-forward, real push, or two devices | Run manually — steps in the test guide |
| ⏭ SKIP (partial, flagged) | Ran but only UI portion asserted | Manually verify the noted backend residue |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | All tests passed |
| `1` | Tests ran — some failed |
| `2` | **Environment error** — tests did NOT run. Fix setup and re-run. |

Exit code `2` always means a setup problem, not a test failure. The error message tells you exactly what to fix.

### Defect priority guidance

| Group | Failure priority |
|---|---|
| A (happy paths) | **P1 — blocker** |
| B, C, D, M, K | P2 — high |
| E, N, P, R (financial/dispute) | P2 — high |
| H, I, Q | P3 — medium |
| G (notifications) | P3 — usually `manual` |

---

## Part 5 — Common issues and fixes

| What you see | Likely cause | Fix |
|---|---|---|
| `App com.p2pkidsmarketplace is NOT installed` | Build not deployed to simulator | `cd p2p-kids-marketplace && npx expo run:ios` |
| `maestro not found` | Maestro CLI not installed | `curl -Ls "https://get.maestro.mobile.dev" \| bash` then restart shell |
| `No iPhone 15 simulator available` | Simulator not created | Xcode → Devices and Simulators → `+` → iPhone 15 |
| `Admin portal did not respond within 45s` | Portal dependency error | Check `/tmp/admin-portal.log`, then `cd p2p-kids-admin && npm run dev` |
| Playwright tests self-skip | `PLAYWRIGHT_ADMIN_E2E` not set | Add `PLAYWRIGHT_ADMIN_E2E=true` to `.env` |
| Playwright login redirect | Wrong admin credentials | Check `ADMIN_E2E_EMAIL` / `ADMIN_E2E_PASSWORD` in `.env` |
| `seed:staging failed` | Supabase credentials missing | Check `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `p2p-kids-marketplace/.env` |
| `gh: command not found` | GitHub CLI not installed | `brew install gh && gh auth login` |
| `gh auth status` → not logged in | Not authenticated | `gh auth login` → choose GitHub.com → HTTPS |
| `e2e-label not found` | First run ever | The script creates the label automatically — no action needed |
| Issue not filed but test failed | `gh` auth problem | Run `node test-automation/trade-flow-v2/scripts/file-issues.mjs e2e-test-results/<run>` manually |
| 20+ issues filed from one run | Infrastructure failure cascaded | Check if it was a setup issue (exit code 2 pattern). Bulk-close the noise issues. |

---

## Part 6 — Where results live

### Result folders

```
kids_marketplace_app/
└── e2e-test-results/
    └── 2026-05-31T13-04-19/        ← one folder per run (timestamp = run start)
        ├── report.md               ← human-readable defect triage  ← READ THIS
        ├── results.json            ← machine-readable (for CI / AI agent parsing)
        └── issues-filed.md         ← links to GitHub Issues filed or skipped (deduped)
```

Results older than **30 days** are automatically pruned from this folder on each post-run.

### GitHub Issues

All failures are filed to: **https://github.com/sameralzubaidy-afk/mobapp/issues**
Label: `e2e-failure`

Deduplication: if an open issue already exists for the same test case IDs, no new issue is created. The `issues-filed.md` shows both new issues and existing duplicates.

---

## Part 7 — Manually verifiable cases (always skipped in automation)

These 15 cases **cannot be automated** without additional infrastructure. Run them manually after the automated suite passes.

| Case | Group | Why it stays manual |
|---|---|---|
| TC-B02 | Offer Lifecycle | Clock fast-forward to offer expiry |
| TC-B06 | Offer Lifecycle | Stripe test decline-card path |
| TC-C03 | SP Behavior | Clock fast-forward to offer expiry |
| TC-G01 | Notifications | Scheduled push delivery not observable in simulator |
| TC-G02 | Notifications | Scheduled push delivery |
| TC-G03 | Notifications | Server-side throttle window |
| TC-M13 | Cart | Two simultaneous actors (realtime availability) |
| TC-Q11 | Reviews | Review aged >24h required |
| TC-Q13 | Reviews | 30-day cooldown window |
| TC-Q14 | Reviews | 24h post-completion lock |
| TC-Q16 | Reviews | 3 distinct reporters required |
| TC-R03 | Refund/Cancel | Clock fast-forward to expiry |
| TC-R04 | Refund/Cancel | Stripe decline-card path |
| TC-R11 | Refund/Cancel | Push notification delivery |
| TC-R12 | Refund/Cancel | Idempotency invariant — verify via integration test |

Use `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` for steps and expected results.

---

## Part 8 — CI integration (GitHub Actions)

```yaml
# .github/workflows/trade-flow-e2e.yml
name: TradeFlowV2 E2E — Admin Portal

on:
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

jobs:
  playwright-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install dependencies
        run: cd p2p-kids-admin && npm ci && npx playwright install --with-deps chromium

      - name: Run admin Playwright tests (autonomous)
        run: bash test-automation/trade-flow-v2/scripts/run-suite.sh --runner playwright --no-preflight
        env:
          PLAYWRIGHT_ADMIN_E2E: 'true'
          ADMIN_E2E_EMAIL:    ${{ secrets.ADMIN_E2E_EMAIL }}
          ADMIN_E2E_PASSWORD: ${{ secrets.ADMIN_E2E_PASSWORD }}
          GH_TOKEN:           ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-admin-results-${{ github.run_number }}
          path: e2e-test-results/

# Mobile Maestro tests require macOS + Simulator — add a macOS job
# and pre-install the app IPA from your build pipeline before running Maestro.
```

---

## Part 9 — File locations reference

```
kids_marketplace_app/
├── .github/
│   └── copilot-instructions.md          ← auto-loaded agent context (DO NOT DELETE)
│
├── test-automation/trade-flow-v2/
│   ├── AGENT-PROMPT.md                  ← copy-paste prompts for QA → agent
│   ├── RUNBOOK.md                       ← this file
│   ├── run-tradeflow-suite.mjs          ← core orchestrator
│   ├── manifest.json                    ← every TC mapped to an asset + status
│   ├── .env.example                     ← copy to .env and fill in
│   └── scripts/
│       ├── run-suite.sh                 ← ENTRY POINT (agent calls this)
│       ├── preflight-setup.sh           ← boot sim, start portal, seed data
│       ├── post-run.sh                  ← archive, file issues, commit
│       └── file-issues.mjs             ← GitHub Issue deduplication + creation
│
├── e2e-test-results/                    ← generated per run, committed to repo
│   └── <timestamp>/
│       ├── report.md
│       ├── results.json
│       └── issues-filed.md
│
└── p2p-kids-admin/__tests__/e2e/
    ├── cart-admin-config.e2e.test.ts    ← TC-N01, TC-N02
    ├── tax-admin-config.e2e.test.ts     ← TC-P01 to TC-P08
    ├── trade-disputes.e2e.test.ts       ← TC-E05, TC-E06, TC-R09, TC-R10
    └── review-moderation.e2e.test.ts   ← TC-Q18, TC-Q19, TC-Q20 (pre-existing)
```

---

## Quick reference card

```
┌─────────────────────────────────────────────────────────┐
│  FULL AUTONOMOUS RUN (most common)                      │
│                                                         │
│  Paste into Copilot Agent chat:                         │
│  "Run the complete TradeFlowV2 test suite.              │
│   Execute fully autonomously. No confirmations needed." │
│                                                         │
│  OR from terminal:                                      │
│  npm run test:e2e                                       │
├─────────────────────────────────────────────────────────┤
│  RESULTS LOCATION                                       │
│  e2e-test-results/<timestamp>/report.md                 │
├─────────────────────────────────────────────────────────┤
│  GITHUB ISSUES                                          │
│  github.com/sameralzubaidy-afk/mobapp/issues            │
│  Label: e2e-failure                                     │
├─────────────────────────────────────────────────────────┤
│  BLOCKED? Check:                                        │
│  Exit 2 → setup error (read the ERROR line)             │
│  Exit 1 → test failure (read report.md + issues)        │
│  App missing → npx expo run:ios (in p2p-kids-marketplace)│
└─────────────────────────────────────────────────────────┘
```
