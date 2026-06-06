# TradeFlowV2 — AI Agent QA Prompt Templates

> **How to use this file**
> Copy the relevant prompt below, paste it into the GitHub Copilot Agent chat in VS Code,
> and press Enter. The agent will execute the full run autonomously.
> You do not need to answer any follow-up questions — the agent has all the context it needs.

---

## PROMPT 1 — Full suite (most common)

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

---

## PROMPT 2 — Admin portal tests only (Playwright)

```
Run only the admin portal Playwright tests for the TradeFlowV2 suite.

Use: bash test-automation/trade-flow-v2/scripts/run-suite.sh --runner playwright

Execute autonomously. After completion, summarize the results and report any failures
with the root cause from the failure output.
```

---

## PROMPT 3 — Mobile tests only, iOS

```
Run the TradeFlowV2 mobile test suite on iOS only.

Use: bash test-automation/trade-flow-v2/scripts/run-suite.sh --runner maestro --platform ios

Execute autonomously including preflight (boot simulator if needed, verify app is installed,
seed data). Do not ask for confirmation. Summarize results when done.
```

---

## PROMPT 4 — Specific group(s)

```
Run TradeFlowV2 test groups [REPLACE WITH: e.g. N,P] only.

Use: bash test-automation/trade-flow-v2/scripts/run-suite.sh --group [GROUPS]

Execute autonomously. After completion, provide:
- Pass/fail/skip totals
- Any failures with root cause
- GitHub Issue links if issues were filed
```

---

## PROMPT 5 — After a code change (targeted regression)

```
A code change was made to [DESCRIBE WHAT CHANGED — e.g. "the cart minimum value logic"].
Run the relevant TradeFlowV2 regression checks.

Determine which test groups cover the changed area, then:
bash test-automation/trade-flow-v2/scripts/run-suite.sh --group [RELEVANT GROUPS]

Execute autonomously. Report failures with root cause. If everything passes, confirm
which cases covered the changed code path.
```

---

## PROMPT 6 — Investigate a specific failure

```
The last TradeFlowV2 run had failures. Read the most recent report at
e2e-test-results/ and tell me:

1. Which cases failed and why (root cause from stderr output)
2. Whether the failure looks like a code defect, environment issue, or flaky test
3. Whether the GitHub Issues were filed or if I need to do anything manually
4. Your recommendation for next steps (re-run, fix code, fix environment, or escalate)
```

---

## PROMPT 7 — Quick health check (dry run)

```
Run a dry run of the TradeFlowV2 suite to verify the environment is configured correctly.

Use: bash test-automation/trade-flow-v2/scripts/run-suite.sh --dry-run

Tell me:
1. How many execution units would run
2. Whether preflight passed (simulator booted, app installed, admin portal reachable, seed data ready)
3. Any configuration issues I need to fix before running the real suite
```

---

## PROMPT 8 — Environment setup from scratch

```
Set up the TradeFlowV2 test environment on this machine from scratch.

Check all prerequisites and help me fix anything that is missing:
1. Maestro CLI
2. Node.js >= 18
3. iOS Simulator with the app installed (com.p2pkidsmarketplace)
4. .env file at test-automation/trade-flow-v2/.env
5. gh CLI installed and authenticated
6. p2p-kids-admin dependencies installed

Do not run the test suite yet — just verify and fix the setup.
```

---

## Notes for QA

- **Results** are always saved to `e2e-test-results/<timestamp>/` and committed to the repo.
- **GitHub Issues** are filed automatically to `sameralzubaidy-afk/mobapp` for each unique failure.
- **Git push is never done automatically** — you review the commit and push when ready.
- **15 manual cases** are always reported as "skip" — this is expected. Check `report.md` for the list.
- If you see **exit code 2**, that is an environment problem (not a test failure) — read the error and fix setup.
- If you see **exit code 1**, tests ran but some failed — check `report.md` and filed issues.
