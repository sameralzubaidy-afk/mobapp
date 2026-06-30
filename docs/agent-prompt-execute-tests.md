Agent Prompt: Execute E2E Test Suite Autonomously
Last updated: 2026-06-24
⚠️ CRITICAL RULE: Never use the user's live simulator. Always use a dedicated E2E test simulator (iPhone 16 Pro E2E).

Give this prompt to your AI agent to run the TradeFlowV2 E2E test suite, monitor it, and report back.

Task
Execute the full TradeFlowV2 E2E test suite (test-automation/trade-flow-v2/) on the iOS simulator using a dedicated E2E test simulator that will not interfere with the user's manual testing.

Workspace root: /Users/sameralzubaidi/Desktop/kids_marketplace_app

Step 1: Preflight Checks (Dedicated Simulator Only)
⚠️ NEVER touch the user's live simulator. Always use/create a dedicated E2E test simulator.

Before running anything, verify and prepare:

Read the dedicated simulator config from .env:

bash
source test-automation/trade-flow-v2/.env
E2E_SIM_NAME="${TFV2_IOS_DEVICE_NAME:-iPhone 16 Pro E2E}"
echo "Dedicated simulator: $E2E_SIM_NAME"
Does the dedicated simulator exist?

bash
xcrun simctl list devices available | grep "$E2E_SIM_NAME"
If no: create it with the latest iOS runtime:

bash
LATEST_RUNTIME=$(xcrun simctl list runtimes | grep iOS | sort -r | head -1 | grep -Eo 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9.]+')
if [ -z "$LATEST_RUNTIME" ]; then
  echo "ERROR: No iOS runtime found. Ask the user to download one in Xcode → Settings → Platforms."
  exit 2
fi
xcrun simctl create "$E2E_SIM_NAME" "iPhone 16 Pro" "$LATEST_RUNTIME"
Boot the dedicated simulator (leave user's live simulator untouched):

bash
E2E_UDID=$(xcrun simctl list devices available | grep "$E2E_SIM_NAME" | grep -Eo '$$[0-9A-F-]{36}$$' | tr -d '()')
if ! xcrun simctl list devices booted | grep -q "$E2E_UDID"; then
  xcrun simctl boot "$E2E_UDID"
  open -a Simulator
  echo "Waiting 20s for simulator to boot..."
  sleep 20
fi
echo "Dedicated simulator UDID: $E2E_UDID"
App is installed on the dedicated simulator:

bash
xcrun simctl listapps "$E2E_UDID" | grep com.sameralzubaidi.p2pmarketplace
If not: notify the user and auto-install:

"Starting app build for dedicated test simulator (expected 3–8 min)..."

bash
cd p2p-kids-marketplace && npx expo run:ios --device "$E2E_SIM_NAME"
Wait for the build to finish. If it fails, STOP and report the error.

.env file exists: ls test-automation/trade-flow-v2/.env

If missing: copy from .env.example and warn user about password

Verify Maestro scripts are in the canonical location:

bash
ls .maestro/module-15.1.2-full-trade-flow-v2.yaml
ls .maestro/helpers/tfv2-dismiss-system-dialogs.yaml
If either file is missing from .maestro/: STOP. Do not run. Report missing files to user.

Note: canonical location is .maestro/ — NOT test-automation/trade-flow-v2/.maestro/

Admin portal is reachable: curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -E '^[23]'

If not: start it: cd p2p-kids-admin && npm run dev & and wait up to 30s

Run testID drift check before executing:

bash
node scripts/testid-drift-check.mjs
If any testIDs are reported as missing: STOP and report which ones. Do NOT run the suite against stale testIDs.

If all 20 testIDs pass: continue to next preflight step.

Node.js syntax is valid: node -c test-automation/trade-flow-v2/run-tradeflow-suite.mjs

If errors: STOP and report syntax errors

Android — same dedicated device pattern (if running Android tests):

bash
source test-automation/trade-flow-v2/.env
E2E_AVD_NAME="${TFV2_ANDROID_AVD_NAME:-pixel_7_e2e}"
# Check if AVD exists
if ! avdmanager list avd 2>/dev/null | grep -q "$E2E_AVD_NAME"; then
  echo "AVD '$E2E_AVD_NAME' not found. Create it in Android Studio: Tools → AVD Manager → Create Virtual Device"
  echo "Name: $E2E_AVD_NAME, Device: Pixel 7"
  exit 2
fi
# Boot emulator
$ANDROID_HOME/emulator/emulator -avd "$E2E_AVD_NAME" -no-snapshot &
echo "Waiting for emulator to boot..."
adb wait-for-device
# Install app if missing
if ! adb shell pm list packages | grep com.sameralzubaidi.p2pmarketplace; then
  echo "Starting app build for dedicated Android emulator (expected 3–8 min)..."
  cd p2p-kids-marketplace && npx expo run:android --device "$E2E_AVD_NAME"
fi
Step 2: Dry-Run First
bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --list
Confirm the output shows a table of test cases

If the command fails with a syntax error: STOP and report the error

Step 3: Execute the Suite
bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
bash test-automation/trade-flow-v2/scripts/run-suite.sh --platform ios
Execution Rules
Run in a terminal so you can monitor output in real-time

Do NOT run in background — you must watch the output continuously

Expect this to take 20–40 minutes on first run (retries add time)

🛑 Three strikes rule: If any step (preflight, seed, suite launch) fails 3 times, STOP immediately and ask the user for help. Do not attempt a 4th time. State clearly what you tried and what you need.

Step 4: Monitoring Rules (MANDATORY)
While the command is running, monitor the output for these signals:

Normal signals (let it continue)
[PREFLIGHT] lines — environment checks running

[step] lines — execution unit starting

[✓ OK] lines — unit passed

maestro test command lines — actual test being launched

PASS in output

Simulator screens flashing/tapping (visible in Simulator app)

Stuck detection (PAUSE and investigate)
Signal	Action
No new output for >3 minutes	Check if the dedicated E2E simulator is responsive. If frozen, reboot ONLY the dedicated simulator (never touch the user's live simulator): E2E_UDID=$(xcrun simctl list devices | grep "iPhone 16 Pro E2E" \| grep -Eo '\([0-9A-F-]{36}\)' \| tr -d '()') && xcrun simctl shutdown "$E2E_UDID" && xcrun simctl boot "$E2E_UDID". Then re-run with --no-preflight.
Same line repeating for >1 minute	Likely Maestro is retrying a tap. Let it finish one more cycle. If still stuck after 2 more minutes, kill (Ctrl+C) and re-run with --no-preflight --group <last_group>.
Simulator showing a system dialog	Check for iOS "Save Password?", "Sign in with Apple?", or permission dialogs. If found, dismiss them: xcrun simctl ui booted dismissKeyboard or tap "Not Now" / "Don't Allow".
[✗ ERROR] lines	Note the error. If it's a one-off (element not found), let the retry handle it. If it's a crash or timeout, see Step 5.
DIAG-seed-gate-before-assert screenshot appears in output	Seed verification failed. Check the screenshot — it shows exactly what Discover had at that moment. Do NOT retry blindly. Report the screenshot path to the user and stop.
FAILURE-login-submit-blocked screenshot appears	Seller or buyer login was blocked (keyboard/autofill). This is a known risk on the seller login helper (not yet hardened). Stop the run, report the screenshot path to the user.
Error handling (try to fix before escalating)
Error Pattern	Auto-Fix
Application not found or App not installed	Auto-install on the dedicated simulator: notify user "Starting app build for dedicated test simulator (3–8 min)...", then run cd p2p-kids-marketplace && npx expo run:ios --device "iPhone 16 Pro E2E". If build fails, STOP and report the error.
No booted simulator	Boot the dedicated E2E simulator by name: E2E_UDID=$(xcrun simctl list devices available \| grep "iPhone 16 Pro E2E" \| grep -Eo '\([0-9A-F-]{36}\)' \| tr -d '()') && xcrun simctl boot "$E2E_UDID". Wait 20s, then retry with --no-preflight.
Admin portal not reachable	Start it: cd p2p-kids-admin && npm run dev &, wait 15s, verify with curl, then retry
Connection refused on port 3001	Kill stale process: lsof -ti :3001 | xargs kill -9 2>/dev/null; sleep 2, then start admin portal again
Maestro timeout (same step failing for >2min)	Note the step name. Kill the process. Re-run with --no-preflight --case <TC-ID> to isolate. Then report the failing step to the user.
gh issue create fails	Ignore — non-blocking. Results are still saved.
testID drift check reports missing IDs	STOP. Do not run the suite. Report the missing testIDs to the user — they need to be added to the app source or the YAML needs updating.
🛑 Three Strikes Rule (MANDATORY — prevents infinite retry loops)
If you attempt the same action 3 times and it fails every time, STOP and ask the user for help.

Scenario	Strike limit	What to do after 3 strikes
Preflight exits with code 2	3 runs max	STOP. Tell user which check failed and what you need (e.g., "App not found — need you to build it", "Simulator won't boot — need Xcode runtime")
seed:staging fails	3 runs max	STOP. Report the exact error lines. Ask user to verify DB credentials
Suite command crashes (Node.js error)	3 runs max	STOP. Report the crash stack trace. Do not attempt workarounds
Same fix doesn't resolve the error	3 attempts max	STOP. Try a different approach or ask the user
Any other repeated failure	3 attempts max	STOP. Summarize what you tried and the result, then ask for guidance
Why this exists: Repeating the same failing action wastes time and clutters the terminal. After 3 failures, the approach is wrong — the user needs to provide context or a different fix.

Step 5: When to Involve the User
ASK the user for help if ANY of these happen (including hitting the 3-strike limit):

Three Strikes exhausted — any action failed 3 times

Preflight fails with exit code 2 — environment setup problem that cannot be auto-fixed

seed:staging fails — DB credentials may be wrong

Syntax error in any JS/YAML file — code has been corrupted

Same test case fails 3 times in a row — likely a real bug, not flakiness

Simulator won't boot — Xcode or runtime issue

App crash that you cannot diagnose — check stderrTail in results for clues

The command itself crashes with a Node.js error — orchestrator bug

Any prompt asking for credentials or secrets — never try to guess passwords

testID drift check fails — one or more testIDs missing from codebase; do not attempt to fix automatically

DIAG-seed-gate-before-assert screenshot fires — seed failed; report screenshot path and stop

FAILURE-login-submit-blocked screenshot fires | Login helper blocked — report screenshot path to user. Note: seller and buyer login helpers are hardened (swipe+double-wait pattern). If this fires, it means the retry block in PHASE 2b also failed. Check if iOS Save Password dialog appeared and was not dismissed.

DO NOT ask for these (handle them silently):

A test case fails with "Element not visible" — note it, let retry handle it

A push notification permission dialog appears — dismiss it

iOS "Save Password?" sheet — tap "Not Now"

Network timeout on first attempt — retry is automatic

Admin portal takes a while to start — wait up to 45s

A single Maestro command within a flow times out (the retry inside the suite handles it)

disclaimer-modal-retry-button tapped by the self-heal block — this is automatic, no action needed

## Maestro 2.6.1 Constraints (MANDATORY — do not violate)
These were discovered through live test failures. Every YAML must follow these rules.

| Constraint | Wrong | Correct |
|---|---|---|
| `assertVisible` timeout | `assertVisible:\n  id: "x"\n  timeout: 5000` | Remove `timeout:`. Add `waitForAnimationToEnd` before the assertion instead. |
| Keyboard dismiss | `- hideKeyboard` | `- swipe:\n    direction: DOWN\n    duration: 600\n- waitForAnimationToEnd\n- waitForAnimationToEnd` |
| `scrollUntilVisible` structure | `scrollUntilVisible:\n  id: "x"\n  timeout: 5000` | Always use `element:` wrapper: `scrollUntilVisible:\n  element:\n    id: "x"\n  direction: DOWN\n  timeout: 5000` |
| `takeScreenshot` | `takeScreenshot:\n  name: "x"\n  enabled: true` | `- takeScreenshot: "x"` (flat string, no sub-properties) |
| Submit button tap timing | Tap immediately after `inputText` | swipe DOWN (600ms) → double `waitForAnimationToEnd` → then tap |

**Root cause of submit button failures**: `KeyboardAvoidingView behavior="padding"` shifts the entire layout when the keyboard appears or dismisses. Tapping the button mid-animation hits empty space. The swipe + double-wait pattern lets the layout settle before tapping.

**Template for new flows**: `.maestro/templates/NEW-FLOW-TEMPLATE.yaml`

---

Step 6: Completion & Reporting
When the suite finishes (either all tests complete or you had to stop early):

If the run completed normally
Find the latest results:

bash
LATEST=$(ls -t e2e-test-results/ | head -1)
echo "Latest run: $LATEST"
Read the summary:

bash
head -25 e2e-test-results/$LATEST/report.md
Check for failures:

bash
grep -A 3 "❌ FAIL" e2e-test-results/$LATEST/report.md || echo "No failures"
Read the Challenges & Recommendations:

bash
grep -A 30 "## ❌ Challenges" e2e-test-results/$LATEST/report.md || echo "No challenges section"
Count screenshots:

bash
find e2e-test-results/$LATEST/screenshots -name '*.png' 2>/dev/null | wc -l
Check for diagnostic/failure screenshots:

bash
find e2e-test-results/$LATEST/screenshots -name 'DIAG-*' -o -name 'FAILURE-*' 2>/dev/null
Report to the user in this format:
text
## ✅ E2E Test Suite Complete

**Run:** <timestamp>
**Duration:** <X> minutes

### Summary
- Cases passed: <N>
- Cases failed: <N>
- Cases skipped: <N>
- Screenshots captured: <N>
- Diagnostic/failure screenshots: <N> (list paths if any exist)

### Key Failures
- <TC-ID>: <brief description of failure>
- <TC-ID>: <brief description of failure>

### Screenshots
`e2e-test-results/<timestamp>/screenshots/`

### Recommendations from report
- <top recommendation>
- <top recommendation>

### Actions needed from you
- <anything that needs user decision or fix>

### Known open items (not blocking this run)
- All login helpers (seller + buyer) are hardened with swipe-based keyboard dismissal and double-wait pattern
- assertVisible + timeout has been removed from all flow YAMLs
- hideKeyboard has been removed from all critical helpers and the main trade flow YAML
- Other module-level flows (module-15.1-flow-*.yaml, search-*.yaml) still contain hideKeyboard — these are lower priority and can be fixed incrementally as each flow is exercised
If the run was interrupted/stopped early
text
## ⚠️ E2E Test Suite Interrupted

**Stopped at:** <step/phase>
**Reason:** <what went wrong>

### What I tried
- <auto-fix attempted>
- <result of auto-fix>

### Diagnostic screenshots
- <path to any DIAG- or FAILURE- screenshots captured>

### What I need from you
- <specific question or action needed>
Appendix: Quick Commands Reference
Action	Command
Action	Command
List cases	node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --list
Dry-run	node test-automation/trade-flow-v2/run-tradeflow-suite.mjs --dry-run
Full run	bash test-automation/trade-flow-v2/scripts/run-suite.sh
iOS only	bash test-automation/trade-flow-v2/scripts/run-suite.sh --platform ios
Single group	bash test-automation/trade-flow-v2/scripts/run-suite.sh --group A
Single case	bash test-automation/trade-flow-v2/scripts/run-suite.sh --case TC-A01
Skip preflight	bash test-automation/trade-flow-v2/scripts/run-suite.sh --no-preflight
Latest results	ls -lt e2e-test-results/ \| head -3
testID drift check	node scripts/testid-drift-check.mjs
testID drift check (CI mode)	node scripts/testid-drift-check.mjs --ci
Verify Maestro file location	ls .maestro/module-15.1.2-full-trade-flow-v2.yaml
Verify dismiss-dialogs helper	ls .maestro/helpers/tfv2-dismiss-system-dialogs.yamlNew flow template | cat .maestro/templates/NEW-FLOW-TEMPLATE.yamlCreate dedicated sim	xcrun simctl create "iPhone 16 Pro E2E" "iPhone 16 Pro" $(xcrun simctl list runtimes \| grep iOS \| sort -r \| head -1 \| grep -Eo 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9.]+')
Boot dedicated sim	E2E_UDID=$(xcrun simctl list devices available \| grep "iPhone 16 Pro E2E" \| grep -Eo '\([0-9A-F-]{36}\)' \| tr -d '()') && xcrun simctl boot "$E2E_UDID" && open -a Simulator
Install app on dedicated sim	cd p2p-kids-marketplace && npx expo run:ios --device "iPhone 16 Pro E2E"
List dedicated sim UDID	xcrun simctl list devices available \| grep "iPhone 16 Pro E2E"
List booted	xcrun simctl list devices booted
Check admin	curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
Start admin	cd p2p-kids-admin && npm run dev &
Kill stale port	lsof -ti :3001 \| xargs kill -9 2>/dev/null