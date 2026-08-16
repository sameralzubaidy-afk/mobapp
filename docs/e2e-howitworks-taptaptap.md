# E2E Test Architecture: How the "Tap Tap Tap" Works

> Last updated: 2026-06-20

> **⚠️ CRITICAL RULE: Automated E2E tests MUST use a dedicated simulator (`iPhone 16 Pro E2E`).
> Never run automated tests on your live/manual-testing simulator or the tests will
> interfere with your manual QA.
> See [Running on a Dedicated Simulator](#running-on-a-dedicated-simulator-no-conflict-with-manual-testing).**

This document explains the end-to-end test architecture for the Kids P2P Marketplace — how a Maestro `.yaml` script turns into taps on a simulator, and how the results make their way into a report.

---

## Table of Contents

1. [The Three Layers](#the-three-layers)
2. [Layer 1 — The Maestro Script (Tap Tap Tap)](#layer-1--the-maestro-script-tap-tap-tap)
3. [Layer 2 — The Orchestrator (The Brains)](#layer-2--the-orchestrator-the-brains)
4. [Layer 3 — Results Storage](#layer-3--results-storage)
5. [Screenshots (Success + Failure)](#screenshots-success--failure)
6. [Challenges & Recommendations Report](#challenges--recommendations-report)
7. [Complete Execution Playbook](#-complete-execution-playbook-from-zero-to-run)
8. [Running on a Dedicated Simulator](#running-on-a-dedicated-simulator-no-conflict-with-manual-testing)
9. [Key Maestro Commands Explained](#key-maestro-commands-explained)
10. [Visual Timeline](#visual-timeline-what-happens-when-you-run-run-suite-sh)
11. [How Test Cases Map to Scripts](#how-test-cases-map-to-scripts)
12. [Results File Formats](#results-file-formats)

---

## The Three Layers

```
┌──────────────────────────────────────────────────────────┐
│  Layer 3: run-suite.sh (entry point)                      │
│  bash test-automation/trade-flow-v2/scripts/run-suite.sh  │
│  - Preflight checks (simulator, app install, admin portal)│
│  - Runs orchestrator                                      │
│  - Archives results + files GitHub Issues                 │
├──────────────────────────────────────────────────────────┤
│  Layer 2: run-tradeflow-suite.mjs (orchestrator)           │
│  - Reads manifest.json                                     │
│  - Groups test cases into execution units                  │
│  - Builds Maestro / Playwright commands                    │
│  - Captures stdout, exit codes, durations                  │
│  - Writes results.json + report.md                         │
├──────────────────────────────────────────────────────────┤
│  Layer 1: module-15.1.2-full-trade-flow-v2.yaml            │
│  - The actual Maestro script ("tap tap tap")              │
│  - Linear commands executed by Maestro CLI                 │
│  - Runs on iOS Simulator / Android Emulator                │
│  - Uses testID attributes to find elements                 │
└──────────────────────────────────────────────────────────┘
```

---

## Layer 1 — The Maestro Script (Tap Tap Tap)

A Maestro script is a **linear robot program**. Maestro reads it top-to-bottom and executes each command against the running app on the simulator or emulator.

### Reference script: `module-15.1.2-full-trade-flow-v2.yaml`

```yaml
# FLOW: module-15.1.2-full-trade-flow-v2
# Purpose: Full trade flow E2E — Discover → Item Detail → Request to Buy → Trade Offer → Submit
# Covers: TC-A01, TC-A02, TC-A03, TC-K01, TC-K02, TC-K03

appId: com.sameralzubaidi.p2pmarketplace
---
- launchApp:
    clearState: true
- waitForAnimationToEnd

# Step 1: Seed a test listing (login as seller, create item)
- runFlow: helpers/tfv2-login-seller.yaml
- runFlow: helpers/tfv2-seed-listing.yaml

# Step 2: Stop app and restart as buyer (clearState:true clears seller session)
- stopApp
- launchApp:
    clearState: true
- waitForAnimationToEnd
- runFlow: helpers/tfv2-login-buyer.yaml

# Safety retry: if login form is still visible after helper, re-submit
- runFlow:
    when:
      visible:
        id: "login-email-input"
    commands:
      - tapOn:
          id: "login-email-input"
      - eraseText
      - inputText: "test-buyer@kidsmarketplace.test"
      - tapOn:
          id: "login-password-input"
      - eraseText
      - inputText: "TestBuyer123!"
      - tapOn:
          id: "login-submit-button"
      - waitForAnimationToEnd

# iOS save-password sheet may appear.
- runFlow:
    when:
      visible:
        text: "Save Password?"
    commands:
      - tapOn:
          text: "Not Now"
      - waitForAnimationToEnd

# Confirm login succeeded (authenticated stack loaded)
- assertVisible:
    id: "tab-discover"

# Navigate to Discover tab
- tapOn:
    id: "tab-discover"
- waitForAnimationToEnd

# Wait for discover screen to load (results or empty state)
- waitForAnimationToEnd
- assertVisible:
    id: "discover-results-list"
    optional: true
- assertVisible:
    id: "empty-state"
    optional: true
- waitForAnimationToEnd

# Wait for search results with timeout fallback
- extendedWaitUntil:
    visible:
      id: "search-result-"
    timeout: 20000

# Tap first listing card (should exist after seeding)
- tapOn:
    id: "search-result-"
    index: 0
- waitForAnimationToEnd

# Verify item detail screen loaded with offer surface
- assertVisible:
    id: "item-detail-title"
- assertVisible:
    id: "item-detail-price"
- assertVisible:
    id: "request-to-buy-button"
- waitForAnimationToEnd

# Tap Request to Buy
- tapOn:
    id: "request-to-buy-button"
- waitForAnimationToEnd

# Verify Trade Offer screen loaded
- assertVisible:
    id: "send-offer-button"
    optional: true
- assertVisible:
    id: "value-stack-row"
    optional: true
- assertVisible:
    id: "sp-amount-input"
    optional: true
- waitForAnimationToEnd

# Dismiss keyboard (Android: SP input may have focus, blocking tab taps)
- hideKeyboard
- waitForAnimationToEnd

# Navigate to Me tab
- tapOn:
    id: "tab-me"
- waitForAnimationToEnd
- waitForAnimationToEnd

# Navigate to TradeListScreen from Me tab via profile trades stat
- runFlow:
    when:
      visible:
        id: "profile-trades-stat"
    commands:
      - tapOn:
          id: "profile-trades-stat"
      - waitForAnimationToEnd

      # Verify trades screen
      - assertVisible:
          id: "tab-active"
      - waitForAnimationToEnd

      # Check Active tab (shows pending/in-progress trades)
      - tapOn:
          id: "tab-active"
      - waitForAnimationToEnd

      # Check for existing trades and verify trade detail
      - runFlow:
          when:
            visible:
              id: "trade-row-"
          commands:
            - tapOn:
                id: "trade-row-"
                index: 0
            - waitForAnimationToEnd
            # Verify trade detail screen elements
            - assertVisible:
                id: "trade-status-badge"
            - assertVisible:
                id: "mark-completed-button"
                optional: true
            - assertVisible:
                id: "cancel-trade-button"
                optional: true

      # Navigate back to Me tab
      - tapOn:
          id: "tab-me"
      - waitForAnimationToEnd

- stopApp
```

### What it simulates (the user flow):

| Step | User Action | How Maestro Does It |
|---|---|---|
| 1 | Seller logs in | `runFlow: helpers/tfv2-login-seller.yaml` — fills email/password form, handles Welcome/Landing screens, dismisses iOS "Save Password" prompt |
| 2 | Seed test data | `runFlow: helpers/tfv2-seed-listing.yaml` — relies on DB seed API (not photo upload, which can't be automated) |
| 3 | Switch users | `stopApp` + `launchApp: { clearState: true }` — kills app, restarts with cleared data so Supabase session doesn't persist |
| 4 | Buyer logs in | Same helper pattern as seller, different credentials |
| 5 | Browse Discover | `tapOn: { id: "tab-discover" }` → waits for results up to 20s → taps first listing |
| 6 | View item detail | Asserts `item-detail-title`, `item-detail-price`, `request-to-buy-button` are visible |
| 7 | Tap "Request to Buy" | `tapOn: { id: "request-to-buy-button" }` → navigates to TradeOfferScreen |
| 8 | View offer screen | Asserts `send-offer-button`, `value-stack-row`, `sp-amount-input` |
| 9 | Go to trades | `tapOn: { id: "tab-me" }` → `tapOn: { id: "profile-trades-stat" }` → enters TradeListScreen |
| 10 | Verify trade detail | Taps first trade row, asserts `trade-status-badge`, `mark-completed-button`, `cancel-trade-button` |

---

## Screenshots (Success + Failure)

### How it works

Every Maestro YAML script has `takeScreenshot` commands at key verification points. Each screenshot is **gated** by an environment variable toggle:

```yaml
- takeScreenshot: "03-item-detail"
  enabled: ${SCREENSHOTS_ENABLED}
```

When `SCREENSHOTS_ENABLED=true` is passed to Maestro, screenshots are captured. When `false`, they are skipped.

### Failure screenshots (always on)

Maestro automatically captures a screenshot whenever a step fails, regardless of the `TFV2_SCREENSHOTS_ENABLED` setting. This is built-in behavior — no extra config needed.

### Where screenshots are saved

```
e2e-test-results/<timestamp>/
├── screenshots/
│   ├── module-15.1.2-full-trade-flow-v2/
│   │   ├── 01-after-login.png
│   │   ├── 02-discover-with-results.png
│   │   ├── 03-item-detail.png
│   │   ├── 04-trade-offer.png
│   │   └── 05-trade-detail.png
│   ├── trade-flow.yaml/
│   │   ├── 01-after-login.png
│   │   └── 02-trade-detail.png
│   ├── trade-tfv2-023-addenda/
│   │   ├── 01-after-login.png
│   │   └── 02-trade-detail.png
│   └── ...
├── results.json
├── report.md
└── issues-filed.md
```

Each flow script has its own subfolder named after the YAML file (without extension). Screenshots are numbered in execution order so you can visually step through the flow.

### Configuration

| Env var | Default | Description |
|---|---|---|
| `TFV2_SCREENSHOTS_ENABLED` | `true` | Set to `false` to disable success screenshots (failure screenshots always fire). |
| `MAESTRO_SCREENSHOTS_DIR` | (set by orchestrator) | Where Maestro saves screenshots. Set automatically to `e2e-test-results/<ts>/screenshots/<flow-name>/`. |

### How the orchestrator manages screenshots

In `run-tradeflow-suite.mjs`, the `maestroCommand()` function:

1. Reads `TFV2_SCREENSHOTS_ENABLED` from env (defaults to `true`)
2. Creates the screenshot directory: `e2e-test-results/<ts>/screenshots/<flow-name>/`
3. Sets `MAESTRO_SCREENSHOTS_DIR` env var for Maestro
4. Also sets `MAESTRO_ON_FAILURE_SCREENSHOT_DIR` for automatic failure captures
5. Passes `SCREENSHOTS_ENABLED=true` or `false` to Maestro so YAML `enabled` flags evaluate correctly

### Disabling screenshots (for speed)

To skip screenshots and run faster:

```bash
# Via env var (one-time)
TFV2_SCREENSHOTS_ENABLED=false bash test-automation/trade-flow-v2/scripts/run-suite.sh

# Or permanently in .env
echo 'TFV2_SCREENSHOTS_ENABLED=false' >> test-automation/trade-flow-v2/.env
```

---

## Challenges & Recommendations Report

The `report.md` now includes a **Challenges & Recommendations** section at the bottom. This is a structured analysis generated by the orchestrator after every run.

### What it contains

```
## ❌ Challenges & Recommendations

### Failure Pattern Analysis
| Pattern | Count | % of Failures |
|---|---|---|
| ⏱️ Timeout           | 3 | 25% |
| 🔍 Element not found | 6 | 50% |
| 💥 Crash / signal    | 1 | 8%  |
| ❓ Other             | 2 | 17% |

### Duration & Performance
- Total execution time: 12.3 min
- Average per unit: 45.2s
- Slowest passing unit: 82.3s
- Slowest failing unit: 120.0s

### Failure Details
#### TC-B01, TC-B04 — trade-flow.yaml (ios)
- Root cause: 🔍 Element not visible — testID may have changed
- Duration: 82.3s · Attempts: 1

### Recommendations for Future Enhancements
| # | Recommendation | Priority |
|---|---|---|
| 1 | Audit testIDs in the affected screens | High |
| 2 | Increase TFV2_TIMEOUT_MS for slow networks | High |
| 3 | Investigate app crashes in affected flows | Critical |
| 4 | 27 cases skipped — prioritize automation | Medium |
```

### Failure pattern detection

The orchestrator analyzes stderr output and classifies each failure into one of these patterns:

| Pattern | Detection Logic | Common Cause |
|---|---|---|
| ⏱️ Timeout | `timedOut` flag | Missing testID, slow data load, screen never rendered |
| 🔍 Element not found | stderr contains "not visible" or "not found" | Renamed testID, conditional rendering, wrong screen |
| 💥 Crash / signal | stderr contains "crash" or "signal" | App bug, memory pressure, unexpected state |
| 🌐 Network issue | stderr contains "network" or "timeout" (non-timer) | Backend down, admin portal not running |
| 🔒 Permission denied | stderr contains "permission" or "denied" | RLS policy blocking data access |
| ❓ Other | Anything not matching above | Investigate manually |

### Using the report

1. **Read the Summary** — quick pass/fail/skip counts
2. **Check the Failure Pattern** — identify if it's a systemic issue (e.g., 50% element-not-found = testIDs are stale)
3. **Drill into Failure Details** — each failure has a root cause classification and the last 25 lines of stderr
4. **Review Recommendations** — prioritized action items for the next sprint
5. **Check Screenshots** — visual confirmation of what the app looked like at each step

---

## Layer 3 — Results Storage

After every run, the orchestrator writes files into `e2e-test-results/<timestamp>/`.

### `results.json` (machine-readable)

This is the source of truth for CI tools and automated analysis.

```json
{
  "runId": "2026-06-20T15-09-46-669Z",
  "module": "MODULE-15.1.2 TradeFlowV2",
  "summary": {
    "casesTotal": 119,
    "casesExecuted": 80,
    "casesPassed": 65,
    "casesFailed": 12,
    "casesSkipped": 27
  },
  "units": [
    {
      "asset": "module-15.1.2-full-trade-flow-v2.yaml",
      "passed": true,
      "durationMs": 45210,
      "cases": ["TC-A01", "TC-A02", "TC-A03"],
      "command": "maestro test --platform ios ...",
      "exitCode": 0,
      "stderrTail": "",
      "timedOut": false
    },
    {
      "asset": "trade-flow.yaml",
      "passed": false,
      "durationMs": 82300,
      "cases": ["TC-B01", "TC-B04"],
      "command": "maestro test --platform ios ...",
      "exitCode": 1,
      "stderrTail": "Error: Element 'request-to-buy-button' not visible after 30s",
      "timedOut": false
    }
  ]
}
```

### `report.md` (human-readable)

Formatted for quick triage by QA:

```markdown
# TradeFlowV2 E2E Test Report — 2026-06-20T15-09-46-669Z

## Summary
- Total cases: 119
- Executed: 80
- Passed: 65
- Failed: 12
- Skipped (pending/manual): 27

## Results

### TC-A01, TC-A02, TC-A03 — module-15.1.2-full-trade-flow-v2.yaml
- Asset: .maestro/module-15.1.2-full-trade-flow-v2.yaml
- Platform: ios
- Result: ✅ PASS (45.2s)

### TC-B01, TC-B04 — trade-flow.yaml
- Asset: .maestro/trade-flow.yaml
- Platform: ios
- Result: ❌ FAIL (82.3s)
- Error: Element 'request-to-buy-button' not visible after 30s

## Issues Filed
- TC-B01 → https://github.com/sameralzubaidy-afk/mobapp/issues/142
- TC-B04 → https://github.com/sameralzubaidy-afk/mobapp/issues/143
```

### Post-run processing (`scripts/post-run.sh`)

After the orchestrator finishes, the post-run script does:

1. **Archives** the full results folder
2. **Files GitHub Issues** for each failing case (creates issues in `sameralzubaidy-afk/mobapp`)
3. **Git commits** the results (but **never pushes** — QA must review first)

---

## Key Maestro Commands Explained

| Command | What it does | When to use |
|---|---|---|
| `tapOn` | Simulates a finger tap at the element's center | Tapping buttons, cards, tabs |
| `tapOn: { ..., index: 0 }` | Taps the Nth matching element | When multiple elements match (e.g., list items) |
| `assertVisible` | Checks the element is on screen (fails if not) | Verifying a screen loaded or data appeared |
| `assertVisible: { optional: true }` | Checks but doesn't fail if absent | Guarding against optional/conditional UI |
| `extendedWaitUntil` | Waits up to N seconds for a condition | Network/data-dependent operations |
| `runFlow: helpers/...` | Runs another YAML file as a subroutine | Reusable login helpers, seed helpers |
| `runFlow: { when: { visible: ... } }` | Conditionally runs commands only if an element is visible | Handling optional screens (Welcome, Landing) |
| `stopApp` | Kills the app process | Switching users between test steps |
| `launchApp` | Restarts the app (with or without clearing data) | Fresh start or session continuity |
| `launchApp: { clearState: true }` | Restarts with all app data erased | Ensuring clean auth state between user switches |
| `hideKeyboard` | Dismisses the on-screen keyboard | Critical on Android before tapping bottom tabs |
| `waitForAnimationToEnd` | Pauses for React Navigation transitions | After every navigation action |
| `inputText` | Types text into the currently focused input | Filling forms, search fields |
| `eraseText` | Clears existing text from an input | Before typing new text into a pre-filled field |

### How Maestro finds elements

Maestro uses **`testID` attributes** — unique identifiers embedded in the React Native code:

```tsx
// In the app code:
<Pressable testID="request-to-buy-button">
  <Text>Request to Buy</Text>
</Pressable>

// In the Maestro script:
- tapOn:
    id: "request-to-buy-button"
```

**Key rules:**
- `testID` values survive UI changes better than searching by text or coordinates
- Partial ID matching works — `search-result-` matches `search-result-42` because the ID *starts with* that string
- `index: 0` means "tap the first match on screen"
- On Android, `testID` maps to `contentDescription` and `resource-id`; on iOS it maps to `accessibilityIdentifier`

---

## Visual Timeline: What Happens When You Run `run-suite.sh`

```
Terminal                           iOS Simulator                      Disk
────────                           ─────────────                      ────
run-suite.sh starts
  │
  ├─ preflight-setup.sh
  │    └─ Reads TFV2_IOS_DEVICE_NAME from .env (default: iPhone 16 Pro E2E)
  │    └─ Creates dedicated simulator if missing (xcrun simctl create)
  │    └─ Boots dedicated simulator (leaves user's live simulator untouched)
  │    └─ Auto-installs app on dedicated simulator if missing (npx expo run:ios)
  │    └─ Starts admin portal on :3001
  │
  ├─ orchestrator starts
  │    └─ Reads manifest.json
  │
  ├─ [Unit 1/11] module-15.1.2-full-trade-flow-v2.yaml
  │    └─ maestro test --platform ios     App launches (clean)
  │         │                              ├─ Seller logs in
  │         │                              ├─ Seed listing via API
  │         │                              ├─ App stops → restarts
  │         │                              ├─ Buyer logs in
  │         │                              ├─ Tap Discover tab
  │         │                              ├─ Tap listing card
  │         │                              ├─ Tap Request to Buy
  │         │                              ├─ Verify offer screen
  │         │                              ├─ Tap Me tab → Trades
  │         │                              └─ Verify trade detail
  │         │
  │    exit code 0 ───── PASS ─────┐
  │                                │
  ├─ [Units 2..11] same pattern ──┤
  │                                │
  ├─ writeReports()                │
  │    └─ results.json ────────────┤──→ e2e-test-results/<ts>/
  │    └─ report.md ──────────────┤
  │                                │
  ├─ post-run.sh                   │
  │    └─ gh issue create (fail)   │
  │    └─ git add results          │
  │    └─ git commit (no push)     │
  │                                │
  └─ Done ─────────────────────────┘
```

---

## How Test Cases Map to Scripts

The single source of truth is `test-automation/trade-flow-v2/manifest.json`.

```json
{
  "module": "MODULE-15.1.2 TradeFlowV2",
  "source": "cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md",
  "statusLegend": {
    "automated": "Reliable automation asset exists. Executed by default.",
    "partial": "Asset covers the UI-observable portion only. Backend state, clock control, or second device needed.",
    "pending": "No automation asset exists yet. Reported as coverage gap.",
    "manual": "Cannot be reliably automated (push delivery, multi-device, time-travel)."
  },
  "cases": [
    { "id": "TRD-TC-A01", "title": "Cash Only happy path",
      "runner": "maestro", "platforms": ["ios", "android"],
      "asset": "module-15.1.2-full-trade-flow-v2.yaml", "status": "automated" },
    { "id": "TRD-TC-A02", "title": "Accept SP: slider → seller accepts",
      "runner": "maestro", "platforms": ["ios", "android"],
      "asset": "module-15.1.2-full-trade-flow-v2.yaml",
      "status": "partial",
      "reason": "Seller-side acceptance needs second session" },
    ...
  ]
}
```

### Mapping logic:

1. Every TC in the manual doc (`cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`) is listed in `manifest.json`
2. Each TC points to an `asset` (YAML file) and `runner` (maestro/playwright)
3. Multiple TCs can share the same asset — the orchestrator runs the script once and attributes the result to all mapped TCs
4. If `status` is `"manual"` or `"pending"`, the orchestrator **skips** it (reports as skipped, not failure)

---

## Results File Formats

### Directory structure after a run

```
e2e-test-results/
└── 2026-06-20T15-09-46-669Z/
    ├── results.json       # Machine-readable — used by CI
    ├── report.md          # Human-readable — used by QA
    └── issues-filed.md    # GitHub Issues created for failures
```

### `results.json` schema

```json
{
  "runId": "ISO timestamp",
  "module": "MODULE-15.1.2 TradeFlowV2",
  "summary": {
    "casesTotal": 119,
    "casesExecuted": 80,
    "casesPassed": 65,
    "casesFailed": 12,
    "casesSkipped": 27
  },
  "units": [
    {
      "asset": "relative/path/to/file.yaml",
      "passed": true|false,
      "durationMs": 45210,
      "cases": ["TC-A01", "TC-A02"],
      "command": "maestro test --platform ios ...",
      "exitCode": 0|1,
      "stderrTail": "last 500 chars of stderr on failure",
      "timedOut": false
    }
  ]
}
```

### `issues-filed.md` format

```markdown
# Issues Filed

| TC ID | Issue | Reason |
|-------|-------|--------|
| TC-B01 | [#142](https://github.com/sameralzubaidy-afk/mobapp/issues/142) | Element not found |
| TC-B04 | [#143](https://github.com/sameralzubaidy-afk/mobapp/issues/143) | Timeout waiting for trade detail |
```

---

## Running on a Dedicated Simulator (No Conflict with Manual Testing)

The test suite can run on its **own simulator** that won't interfere with any simulator you're using for manual testing.

### How it works

1. You create a simulator specifically for automation (e.g., "iPhone 16 Pro E2E")
2. You set `TFV2_IOS_DEVICE_NAME` to that name in `.env`
3. The preflight boots that specific device (even if another simulator is already running for manual testing)
4. Maestro targets that specific device via its UDID (`--device` flag)
5. Your manual testing simulator is never touched

### Setup steps

#### Option A: Auto-create (AI agent / CI script)
```bash
# 1. Auto-create the dedicated simulator with latest iOS runtime
LATEST_RUNTIME=$(xcrun simctl list runtimes | grep iOS | sort -r | head -1 | grep -Eo 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9.]+')
if [ -z "$LATEST_RUNTIME" ]; then
  echo "ERROR: No iOS runtime downloaded. Open Xcode → Settings → Platforms to download one."
  exit 1
fi
xcrun simctl create "iPhone 16 Pro E2E" "iPhone 16 Pro" "$LATEST_RUNTIME"

# 2. Set the device name in your .env
echo 'TFV2_IOS_DEVICE_NAME=iPhone 16 Pro E2E' >> test-automation/trade-flow-v2/.env

# 3. Install the app on it
cd p2p-kids-marketplace
npx expo run:ios --device "iPhone 16 Pro E2E"
```

#### Option B: Manual creation (Xcode)
```bash
# 1. Open Xcode → Window → Devices and Simulators → "+" (bottom-left)
#    Device Name: "iPhone 16 Pro E2E"
#    Model: pick any iPhone model you don't use for manual testing

# 2. Set the device name in your .env
echo 'TFV2_IOS_DEVICE_NAME=iPhone 16 Pro E2E' >> test-automation/trade-flow-v2/.env

# 3. Install the app on it (one-time)
cd p2p-kids-marketplace
npx expo run:ios --device "iPhone 16 Pro E2E"
```

# 4. Run tests (your manual simulator is never touched)
bash test-automation/trade-flow-v2/scripts/run-suite.sh

### Android same concept

```bash
# 1. Create a dedicated AVD in Android Studio
#    Tools → AVD Manager → Create Virtual Device
#    AVD Name: "pixel_7_e2e"
#    Device: Pixel 7

# 2. Set it in .env
echo 'TFV2_ANDROID_AVD_NAME=pixel_7_e2e' >> test-automation/trade-flow-v2/.env

# 3. Boot the dedicated emulator (leaves your manual emulator untouched)
$ANDROID_HOME/emulator/emulator -avd pixel_7_e2e -no-snapshot &
adb wait-for-device

# 4. Install the app if missing (auto-install)
cd p2p-kids-marketplace
npx expo run:android --device pixel_7_e2e
```

> **Agent rule:** The agent must auto-create the AVD (via `avdmanager` if available), boot it, and install the app automatically. Never use a running emulator that the user might be manually testing on.

### How the preflight picks the right device

```
User's manual simulator (e.g. iPhone 15 Pro) is booted ──→ left alone
                                                              │
Test suite starts                                              │
  │                                                            │
  ├─ Checks: Is "iPhone 16 Pro E2E" booted?                    │
  │   ├─ Yes → use it (set IOS_SIMULATOR_UDID)                 │
  │   └─ No → is it available (shutdown)?                      │
  │       ├─ Yes → boot it (set IOS_SIMULATOR_UDID)            │
  │       └─ No → STOP and ask user to create it                      │
  │    (never fall back to a live/manual simulator)            │
  └─ Maestro runs with --device <dedicated_udid>                │
     → taps go to the dedicated simulator                       │
     → your manual simulator is untouched                       │
```

### Env var reference

| Env var | Default | Purpose |
|---|---|---|
| `TFV2_IOS_DEVICE_NAME` | `iPhone 16 Pro` | Simulator model name to use for automation. Set this to a different model than your manual-testing one. |
| `TFV2_ANDROID_AVD_NAME` | `pixel_7_e2e` | Android AVD name for automation. |
| `IOS_SIMULATOR_UDID` | — | Overrides name lookup. Pin a specific UDID directly. |
| `ANDROID_EMULATOR_SERIAL` | — | Overrides name lookup. Pin a specific emulator serial directly. |
| `TFV2_SCREENSHOTS_ENABLED` | `true` | Set to `false` to skip success screenshots. Failure screenshots always capture. |
| `TFV2_RETRIES` | `1` | Number of retries per failed execution unit. |
| `TFV2_TIMEOUT_MS` | `600000` | Max time (ms) per execution unit before timeout. |

---

## 🎯 Complete Execution Playbook (From Zero to Run)

This is a **copy-paste-friendly checklist** to go from a clean start to a completed test run with results. Follow each step in order.

### Phase 1: Prerequisites (one-time setup)

- [ ] **Maestro CLI installed**
  ```bash
  curl -Ls https://get.maestro.mobile.dev | bash
  # Restart your terminal after install
  maestro --version
  ```

- [ ] **Expo EAS build or local dev build exists**
  ```bash
  cd p2p-kids-marketplace
  npx expo run:ios          # iOS
  npx expo run:android      # Android
  ```

- [ ] **Supabase staging is accessible**
  ```bash
  # Verify your .env.local has SUPABASE_URL and SUPABASE_ANON_KEY
  cd p2p-kids-marketplace
  cat .env.staging | grep SUPABASE
  ```

- [ ] **Admin portal dependencies installed**
  ```bash
  cd p2p-kids-admin
  npm install
  ```

### Phase 2: Configuration (per workspace)

- [ ] **Copy and fill `.env`**
  ```bash
  cp test-automation/trade-flow-v2/.env.example test-automation/trade-flow-v2/.env
  # Edit the .env file with your secrets
  # At minimum: PLAYWRIGHT_ADMIN_PASSWORD
  ```

- [ ] **Create a dedicated test simulator (MANDATORY — do NOT use your live simulator)**
  ```bash
  # Auto-create with latest iOS runtime (preferred):
  LATEST_RUNTIME=$(xcrun simctl list runtimes | grep iOS | sort -r | head -1 | grep -Eo 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9.]+')
  xcrun simctl create "iPhone 16 Pro E2E" "iPhone 16 Pro" "$LATEST_RUNTIME"

  # OR create manually in Xcode:
  # Xcode → Window → Devices and Simulators → "+" (bottom-left)
  # Name: "iPhone 16 Pro E2E"
  # Product Family: iPhone

  # Install the app on it (one-time)
  cd p2p-kids-marketplace
  npx expo run:ios --device "iPhone 16 Pro E2E"
  ```

- [ ] **Configure dedicated simulator in `.env`**
  ```bash
  echo 'TFV2_IOS_DEVICE_NAME=iPhone 16 Pro E2E' >> test-automation/trade-flow-v2/.env
  ```

- [ ] **Seed test data (verifies DB connectivity)**
  ```bash
  cd p2p-kids-marketplace
  npm run seed:staging
  ```
  > **If this fails:** STOP and check your Supabase credentials. Do not proceed until seed succeeds.

### Phase 3: Preflight Dry-Run

- [ ] **List test cases without executing**
  ```bash
  cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
  node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --list
  ```
  Expected output: table of ~119 cases with status (automated/partial/manual/pending)

- [ ] **Dry-run to verify commands are valid**
  ```bash
  node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --dry-run --group A
  ```
  Expected output: shows what commands would run without executing them

- [ ] **Verify no preflight blockers** (optional)
  ```bash
  node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --dry-run
  ```
  Look for any `[ERROR]` lines — fix those before the real run.

### Phase 4: First Test Run (smoke)

- [ ] **Run a single group first (Group A = core happy paths)**
  ```bash
  bash test-automation/trade-flow-v2/scripts/run-suite.sh --group A --platform ios
  ```
  This takes ~2–5 minutes. Watch the output for:
  - `[PREFLIGHT]` — environment checks (should all be green)
  - `[step]` — execution progress
  - `[✓ OK]` — pass markers
  - `[✗ ERROR]` — failure markers with stderr

- [ ] **Examine the results**
  ```bash
  # Find the latest result folder
  ls -lt e2e-test-results/ | head -5

  # Read the report
  cat e2e-test-results/$(ls -t e2e-test-results/ | head -1)/report.md

  # Check screenshots (if enabled)
  open e2e-test-results/$(ls -t e2e-test-results/ | head -1)/screenshots/
  ```

- [ ] **Triage any failures**
  - Open the `report.md` and read the **Challenges & Recommendations** section
  - Check `screenshots/<flow-name>/` for visual evidence at each step
  - If a testID mismatch: search the codebase for the correct testID
  - If a timeout: increase `TFV2_TIMEOUT_MS` in `.env`
  - If a crash: check `stderrTail` in `results.json` for the error message

### Phase 5: Full Suite Run

- [ ] **Run all mobile cases (iOS + Android)**
  ```bash
  bash test-automation/trade-flow-v2/scripts/run-suite.sh
  ```
  Duration: ~20–40 minutes depending on number of failures (retries).

- [ ] **Run only iOS (faster)**
  ```bash
  bash test-automation/trade-flow-v2/scripts/run-suite.sh --platform ios
  ```

- [ ] **Run only specific groups**
  ```bash
  # e.g., core happy paths + cart + tax
  bash test-automation/trade-flow-v2/scripts/run-suite.sh --group A,M,O --platform ios
  ```

### Phase 6: Results Review

- [ ] **Read the summary**
  ```bash
  LATEST=$(ls -t e2e-test-results/ | head -1)
  echo "=== Summary ==="
  head -20 e2e-test-results/$LATEST/report.md
  echo ""
  echo "=== Failures ==="
  grep -A 5 "❌ FAIL" e2e-test-results/$LATEST/report.md || echo "No failures!"
  ```

- [ ] **Open screenshots**
  ```bash
  open e2e-test-results/$LATEST/screenshots/
  ```

- [ ] **Read the Challenges & Recommendations**
  ```bash
  grep -A 50 "## ❌ Challenges" e2e-test-results/$LATEST/report.md || echo "No challenges section (all passed)"
  ```

- [ ] **Check filed GitHub Issues** (if any failures)
  ```bash
  cat e2e-test-results/$LATEST/issues-filed.md
  ```

### Phase 7: Troubleshooting Quick Fixes

| Symptom | Likely Cause | Fix |
|---|---|---|
| `[ERROR] App not installed` | Never built for target simulator | Auto-install: `cd p2p-kids-marketplace && npx expo run:ios --device "iPhone 16 Pro E2E"` (agent does this automatically — no need to ask user) |
| `[ERROR] No booted simulator` | Simulator not running or not found | Boot the dedicated simulator: `E2E_UDID=$(xcrun simctl list devices available \| grep "iPhone 16 Pro E2E" \| grep -Eo '\([0-9A-F-]{36}\)' \| tr -d '()') && xcrun simctl boot "$E2E_UDID"`. Check `TFV2_IOS_DEVICE_NAME` in `.env` matches the existing simulator name. |
| `Element not visible` for `tab-buying` | testID renamed in code | Search codebase for the correct tab testID → update YAML |
| `Seed:staging fails` | DB credentials wrong or staging down | `cat .env.staging \| grep SUPABASE` → verify against Supabase dashboard |
| `Admin portal 502` | Portal not running or wrong port | `cd p2p-kids-admin && npm run dev` → check port matches `ADMIN_BASE_URL` |
| `Screenshots empty` | `TFV2_SCREENSHOTS_ENABLED=false` | Set to `true` in `.env` |
| `Slow run (>1 hour)` | Too many timeouts or retries | Reduce `TFV2_TIMEOUT_MS` or `TFV2_RETRIES` in `.env` |
| `gh issue create fails` | GitHub CLI not authenticated | `gh auth login` → follow prompts |

---

## Quick Reference

### Dedicated Simulator Commands

| Action | Command |
|---|---|
| Auto-create iOS dedicated sim | `xcrun simctl create "iPhone 16 Pro E2E" "iPhone 16 Pro" $(xcrun simctl list runtimes \\| grep iOS \\| sort -r \\| head -1 \\| grep -Eo 'com\\.apple\\.CoreSimulator\\.SimRuntime\\.iOS-[0-9.]+')` |
| Boot iOS dedicated sim | `xcrun simctl boot $(xcrun simctl list devices available \\| grep "iPhone 16 Pro E2E" \\| grep -Eo '\\([0-9A-F-]{36}\\)' \\| tr -d '()')` |
| Install app on iOS ded. sim | `cd p2p-kids-marketplace && npx expo run:ios --device "iPhone 16 Pro E2E"` |
| Create Android AVD | Android Studio → AVD Manager → Create (Name: `pixel_7_e2e`, Device: Pixel 7) |
| Boot Android emulator | `$ANDROID_HOME/emulator/emulator -avd pixel_7_e2e -no-snapshot &` |
| Install app on Android AVD | `cd p2p-kids-marketplace && npx expo run:android --device pixel_7_e2e` |

### How to run

```bash
# Full suite (all 119 cases)
bash test-automation/trade-flow-v2/scripts/run-suite.sh

# Single script directly (for debugging)
cd p2p-kids-marketplace
maestro test .maestro/module-15.1.2-full-trade-flow-v2.yaml

# Single group
bash test-automation/trade-flow-v2/scripts/run-suite.sh --group A

# Single test case
bash test-automation/trade-flow-v2/scripts/run-suite.sh --case TC-A01
```

### Want an AI agent to run this for you?

A ready-made prompt is available at:

> **`docs/agent-prompt-execute-tests.md`**

Give this file to your AI agent and it will autonomously execute the suite, monitor for stalls, auto-fix common errors, know when to ask you for help, and report the results when done.
```

### Where to find results

```
e2e-test-results/<latest-timestamp>/
├── results.json
├── report.md
└── issues-filed.md
```

### Exit codes

| Code | Meaning |
|---|---|
| 0 | All executed cases passed (or were skipped as manual/pending) |
| 1 | One or more cases failed |
| 2 | Preflight failed (simulator not booted, app not installed, etc.) |
