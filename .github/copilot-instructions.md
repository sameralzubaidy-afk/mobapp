# GitHub Copilot Agent Instructions — Kids P2P Marketplace

## Project overview

This workspace contains two applications:
- **`p2p-kids-marketplace/`** — React Native / Expo mobile app (iOS + Android). Bundle ID: `com.p2pkidsmarketplace`
- **`p2p-kids-admin/`** — Next.js admin portal (runs on `http://localhost:3001`)

The apps share a Supabase backend. Test accounts live in the staging database.

---

## Test infrastructure

### Single entry point

When asked to "run tests", "run the test suite", or any variation, ALWAYS use:

```bash
bash test-automation/trade-flow-v2/scripts/run-suite.sh [options]
```

Run this from the **workspace root** (`kids_marketplace_app/`).

### What `run-suite.sh` does (fully autonomous — no confirmation needed)

1. **Preflight**: Boots an iOS Simulator if none is running, verifies the app is installed, starts the admin portal on `:3001` if not running, seeds test data.
2. **Orchestrator**: Runs 119 test cases via Maestro (mobile) and Playwright (admin web).
3. **Post-run**: Files GitHub Issues for failures, archives results, does a `git commit`.

### Key files

| File | Purpose |
|---|---|
| `test-automation/trade-flow-v2/run-tradeflow-suite.mjs` | Core orchestrator — Maestro + Playwright runner |
| `test-automation/trade-flow-v2/manifest.json` | Every test case mapped to runner/asset/platform |
| `test-automation/trade-flow-v2/scripts/run-suite.sh` | **The single entry point** |
| `test-automation/trade-flow-v2/scripts/preflight-setup.sh` | Environment bootstrap |
| `test-automation/trade-flow-v2/scripts/post-run.sh` | Archive + issue filing + git commit |
| `test-automation/trade-flow-v2/scripts/file-issues.mjs` | GitHub Issue deduplication + creation |
| `test-automation/trade-flow-v2/.env` | Credentials (copy from `.env.example`) |
| `e2e-test-results/<timestamp>/report.md` | Human-readable results per run |
| `e2e-test-results/<timestamp>/results.json` | Machine-readable results per run |
| `e2e-test-results/<timestamp>/issues-filed.md` | Links to GitHub Issues filed |

### GitHub repos

- **Mobile failures** → `sameralzubaidy-afk/mobapp`
- **Admin portal failures** → also `sameralzubaidy-afk/mobapp` (single triage queue)

### Available CLI flags (pass after `run-suite.sh`)

```
--group A,B,C        Run specific test groups only
--case TC-A01        Run a specific test case
--platform ios       ios | android | both
--runner playwright  maestro | playwright
--bail               Stop on first failure
--dry-run            Print commands, don't execute
--no-preflight       Skip environment checks
```

---

## Autonomous run protocol

When a QA team member asks you to run the test suite, follow these steps WITHOUT asking for confirmation at each step:

1. `cd /Users/sameralzubaidi/Desktop/kids_marketplace_app` (workspace root)
2. Check that `.env` exists: `test-automation/trade-flow-v2/.env`. If missing, warn the user and ask them to copy `.env.example`.
3. Run: `bash test-automation/trade-flow-v2/scripts/run-suite.sh [any requested options]`
4. Monitor stdout for preflight errors:
   - If exit code 2 → environment setup problem. Read the error, explain the fix, STOP — do not proceed with tests.
   - If exit code 1 → test failures. Continue to post-run analysis.
5. After completion, read `e2e-test-results/<latest-run>/report.md`.
6. Summarize to QA: total pass/fail/skip, any critical groups that failed, and links from `issues-filed.md`.

### Diagnosing failures

When tests fail, read the `stderrTail` section in `results.json` for each failed unit. Common root causes:
- **Maestro "Application not found"** → App not installed. Fix: `cd p2p-kids-marketplace && npx expo run:ios`
- **Playwright auth redirect** → `PLAYWRIGHT_ADMIN_E2E=true` not set or wrong credentials in `.env`
- **Maestro tap timeout** → UI changed or test account state is wrong. Re-run seed: `cd p2p-kids-marketplace && npm run seed:staging`
- **Admin portal 502/ECONNREFUSED** → Portal not running. Fix: `cd p2p-kids-admin && npm run dev`
- **"No booted simulator"** → Run `xcrun simctl list devices booted` to verify, then `xcrun simctl boot <UDID>`

### Important safety rules

- NEVER `git push` — QA must review and push manually after the run.
- NEVER modify test files, seed data scripts, or config during a run.
- NEVER commit anything outside `e2e-test-results/` as part of a test run.
- If `seed:staging` fails, STOP and report — do not continue with potentially wrong data.
- `gh issue create` is safe to run (creates issues in `sameralzubaidy-afk/mobapp`) — no need to ask.

---

## Coverage

**119 automated cases** across:
- Groups A–M: Mobile happy paths, edge cases, SP/wallet, cart, payouts, notifications, tax checkout
- Groups N, P: Admin portal — cart config, tax config
- Groups E, R (partial): Admin dispute resolution
- Group Q: Review moderation (TC-Q18–Q20)
- 15 manual cases remain (clock-dependent, multi-device, real push) — flagged in `report.md`

---

## Environment variables (`.env`)

```
APP_ID=com.p2pkidsmarketplace
PLAYWRIGHT_ADMIN_E2E=true
PLAYWRIGHT_ADMIN_EMAIL=test-admin@kidsmarketplace.test
PLAYWRIGHT_ADMIN_PASSWORD=<ask team lead>
ADMIN_E2E_EMAIL=test-admin@kidsmarketplace.test
ADMIN_E2E_PASSWORD=<ask team lead>
# Optional
IOS_SIMULATOR_UDID=<from xcrun simctl list devices booted>
ANDROID_EMULATOR_SERIAL=<from adb devices>
```
