# FIX-Task-52 — G01 success copy + tooling fixes + locator + doc drift + enablement + UX

**Date:** 2026-09-17
**Source:** SUB Android Round 7 QA report (`e2e-test-results/qa-sub-android-r7-remaining-2026-09-17/report.md`)
**Classification:** C (mobile UI/screens) + H (admin/tooling) + money-path (EF: `stripe-webhook`, `create-stripe-connect-account`)
**Impacted flows:** FLOW-22 (Seller Payouts & Withdrawals), FLOW-23 (Payout Method Verification), FLOW-10/11 (SP Wallet / ledger read), FLOW-12 (Subscriptions — webhook path), FLOW-17 (notifications deep-link entry)

---

## Outcome summary

| # | Item | Status |
|---|---|---|
| 1 | G01 misleading success copy | ✅ **DONE — deployed + confirmed on-device** (see §On-device) |
| 2 | `qa:stripe-inspect` transfer scoping | ✅ Fixed + **verified live** (previously 404, now returns the transfer) |
| 3 | `qa:ef-repro` silently ignored flags | ✅ Fixed + **verified live** (3 guards exercised) |
| 4 | Payout Settings stale status | ✅ Fixed (bounded settle poll) — R59 listing NOT needed |
| 5 | `NoMethodModal` Cancel locator | ✅ `testID` + a11y added |
| 6 | G01 entry-point doc drift | ✅ Guide corrected + CTA-label product question flagged |
| 7a | Method-less persona + hosted drive | ✅ Recipe documented; false safety claim corrected |
| 7b | Webhook signing secret / replay helper | ✅ Helper built + delivery path verified. **Secret = owner action.** |
| 7c | `--state` flag on `qa:set-sp-balance` | ✅ Fixed + **verified live** (grace precondition now survives) |
| 7d | Push-payload fixture for E04 | ✅ Dev deep link added + tested → case **unblocked** |
| 8 | Post-withdrawal status hint | ✅ Added |
| 9 | WithdrawModal inline fee formula | ✅ Added, on-device verified — and the device pass caught a layout regression it introduced, fixed + re-verified |
| 10 | SP History refresh-on-focus | ✅ Fixed + test-mock drift corrected |

**🔴 P1 DISCOVERED, FIXED, DEPLOYED AND VERIFIED:** the `stripe-webhook` Edge Function rejected **every** delivery. The owner approved the deploy; the fix is live and the rejection now behaves correctly. See §P1.

---

## §P1 — `stripe-webhook` was rejecting 100% of deliveries (CRITICAL)

### What was found

While verifying item 7b I made the **first real POST this endpoint had ever received** from QA. The deployed function answered:

```
HTTP 400
Webhook Error: SubtleCryptoProvider cannot be used in a synchronous context.
Use `await constructEventAsync(...)` instead of `constructEvent(...)`
```

`supabase/functions/stripe-webhook/index.ts:73` used the **synchronous** `stripe.webhooks.constructEvent(body, sig, endpointSecret)`. On the Deno / `esm.sh` Stripe v14 runtime the default crypto provider is `SubtleCryptoProvider` (WebCrypto), which cannot run in a synchronous context — so the call threw **before any handler ran** and the function returned 400 to every event.

### Blast radius (every handler in this function was dead)

`charge.captured` (tax-collected safety net) · `charge.refunded` · `payment_intent.payment_failed` · `account.updated` (Stripe Connect status sync) · `payout.created|updated|paid|failed` (**seller payout status reconciliation**) · `charge.dispute.*`.

This is the direct explanation for several long-standing QA observations, including the one this task started from: *"the observed `processing` → `completed` transition came from the DEV-TASK-124 dispatch trigger, not a provider webhook"* — it **could not** have come from a webhook, because no webhook could ever succeed.

### Why it went unnoticed for rounds

The sibling function `stripe-webhook-subscriptions` already used the correct `await ...constructEventAsync(...)` (confirmed in source and by QA Task 20/21, which got a proper `400 INVALID_SIGNATURE`). Only this endpoint was broken. And because no tool could deliver a *signed* event, the payout/webhook leg of L05/L03 was never actually exercised — every prior verdict rested on the DB-trigger path.

### Fix applied

`constructEvent` → `await stripe.webhooks.constructEventAsync(body, sig, endpointSecret)`, with an explanatory comment. `deno check` passes.

### ⚠️ DEPLOYED AND VERIFIED (owner approved 2026-09-17)

Deployed via the standing CLI path (BP-41):

```bash
supabase functions deploy stripe-webhook --project-ref drntwgporzabmxdqykrp --use-api --no-verify-jwt
```

| Check | Before | After |
|---|---|---|
| Deployed version | 49 (2026-08-27) | **50 (2026-09-17 13:30:16 UTC)** |
| Response to a signed delivery | `400 SubtleCryptoProvider cannot be used in a synchronous context` | **`400 No signatures found matching the expected signature`** |
| `verify_jwt` (gateway) | false | **false** (probe reaches the function body) |

**The change in the error message IS the proof.** Before the fix the function died while *constructing the crypto provider* — it never got as far as verifying anything. After the fix it computes the HMAC and compares it, correctly rejecting my deliberately-wrong probe secret. A sentinel `POST` with no signature returns the function's own `400 Webhook Secret missing` (not a gateway 401), which independently confirms `verify_jwt=false` survived the deploy.

**Bonus finding from that probe:** the post-fix response proves the **deployed function DOES have `STRIPE_WEBHOOK_SECRET` configured** (an unset secret short-circuits to "Webhook Secret missing" before any signature work). So the secret exists server-side — only the **local** `.env` lacks a copy for signing. That narrows the L05/L03 gap to a single owner action: paste the same `whsec_...` into `p2p-kids-marketplace/.env`.

---

## Per-item detail

### Item 1 — G01 misleading success copy (LOW-MED, money-adjacent)

**Root cause confirmed:** `create-stripe-connect-account` is idempotent — when the seller already has a `stripe_account_id` it returns the existing row without creating anything — but the client derived its copy only from `resumingOnboarding` (a value computed from the method list), so it could not tell "new" from "reused".

**Fix:**
- EF now returns explicit `created: true|false` **plus** `onboardingComplete` on the reuse path.
- Client (`PayoutSettingsScreen.tsx`) has three truthful branches:
  1. `resumingOnboarding` → existing DT-121 copy
  2. `created === false && onboardingComplete` → **"This payout account is already connected and verified. You will now be redirected to Stripe."**
  3. `created === false && !onboardingComplete` → *"This payout account is already connected. You will now be redirected to continue your onboarding."*
  4. else → original *"Stripe account created! …"*

**Deliberate deviation from the brief (and why):** the brief asked for a single reused-case string. The EF's reuse path also fires for an account whose onboarding is **incomplete** (a seller who added the method and abandoned hosted onboarding). Using the "…and verified" string there would have **replaced one over-claim with another** — the exact defect class being fixed. Hence the extra branch, at the cost of three lines in the EF.

**Evidence:** `deno check` clean; client typecheck clean; **deployed and confirmed on-device** (see §On-device below).

### Item 2 — `qa:stripe-inspect` transfer scoping (MED, tooling)

**Root cause confirmed:** a platform→connected Transfer (`transfers.create({ destination: acct_... })`) is a **PLATFORM-level** object. Sending `Stripe-Account` makes Stripe look for a transfer owned *by that connected account* → 404, which reads exactly like a real DB↔Stripe divergence.

**Fix:** `transfer` now **ignores `--account` by default** and says so, printing the reason and pointing at a new opt-in `--as-connected` flag (for a transfer the connected account created itself). Also:
- `by-trade`'s embedded transfer read had the **same bug** and is now unscoped too (it previously risked a false `provider_error`).
- `explainStripeError`'s 404 branch now appends an account-scope hint whenever `--account` was set.
- Usage header documents the transfers-vs-payouts distinction (payouts **are** account-scoped).

**Verified live** against a real payout transfer:

```
npm run qa:stripe-inspect -- transfer tr_1UGNwF4I6kCJlvXoE0isogoI --account acct_1UGO3X3J8Vt0lE5T --break-glass-secret-key
  NOTE: ignoring --account ... for this transfer read — a platform→connected transfer is a PLATFORM-level object.
  === transfer tr_1UGNwF4I6kCJlvXoE0isogoI [platform] ===
  amount: 4962 · destination: acct_1UGKzW3uefDqBl4z · livemode: false · metadata.source: manual_withdrawal
```

Previously 404. `key_scope=SECRET_KEY_BREAK_GLASS` (the restricted read key is not configured in `.env`).

### Item 3 — `qa:ef-repro` silently ignored flags (MED, tooling)

Three fixes, all verified live:
1. **Loud warning** when `--body` is combined with `--items` / `--pm` / `--fee-mode` (they cannot affect the body):
   `⚠️ IGNORED: --items, --pm — --body replaces the ENTIRE request body…`
2. **Not-found `--items` id now exits 2** with the real reason, instead of falling through to `cash_amount_cents: 0` and surfacing as a misleading `INVALID_AMOUNT`.
3. **Body-contract validation** before the call — for `create-trade-offer` it names the required keys and prints both correct invocation forms:
   ```
   ❌ create-trade-offer: the request body is missing required keys …
      Always required : payment_method_id
      Plus one of     : item_id + cash_amount_cents   |   items
   ```
   Exit 2. The usage header now states the contract explicitly.

### Item 4 + 8 — Payout Settings stale status (LOW) + post-withdrawal hint (UX)

**Investigation first:** Payout Settings **already** had reload-on-return (DT-124 Item 2: focus effect + AppState-active). The gap was narrower than the finding implied — the seller **never leaves the screen** after a withdrawal, so no focus change occurs, and the closing alert's `loadPayoutMethods()` fires before the DT-124 dispatch trigger has flipped the row.

**Fix (both items together):** a bounded settle poll that re-reads **only** the payout rows (not the 8-leg full load) at 3 s intervals, max 5 attempts, stopping early once nothing is `processing`, and aborting immediately if the screen loses focus. Plus an inline note while it settles (`payout-status-settling-note`): *"Updating status — your payout provider can take a few seconds to confirm. Refreshing automatically."*

**R59 listing:** deliberately **not** added — the screen now self-heals for the post-withdrawal case, so listing it as a known-stale screen would misrepresent it.

### Item 5 — `NoMethodModal` Cancel locator (BP-53 gap)

Added `testID="no-method-cancel-btn"` + `accessible` + `accessibilityRole="button"` + `accessibilityLabel="Cancel"`, matching the sibling `no-method-add-btn`. The modal is a plain `View` overlay (not a `Pressable`), so no container-grouping work was needed.

### Item 6 — G01 entry-point doc drift (LOW-MED)

Guide now documents the **live** CTAs: `+ Add Bank Account` (`add-bank-row`) / `+ Add Another Method` (`add-another-method-row`), and notes that **"Add Payout Method"** is only the modal title / NoMethodModal button. Also added the three expected success-alert copies (item 1) so the guide stays a truthful claim about the shipped app.

**Product question raised (owner input needed):** the empty-state CTA says **"Bank Account"** but the modal offers **no bank/ACH option** (only Stripe Connect is configured — hence SUB-TC-G03 is 🚫 N/A). Suggested copy: "+ Add Payout Method". **Not changed** — shipped copy is a product decision.

### Item 7a — method-less payout persona + hosted-onboarding drive

**Finding:** the persona and the method state **already existed** (`qa-payout-fixture -- ensure` + `methods --scenario none`), and Task 65–R76 already documents the hosted Stripe Express recipe. The real gap was that nothing tied them together, so the case looked fixture-blocked when it was actually **recipe-blocked**.

**Delivered:** a new "SUB-TC-G01 — Stripe Connect onboarding" runbook section with the exact command sequence, the first-time vs reuse distinction, and the warning that `single-verified`/`single-unverified` use **fake** `acct_dt118_fixture*` ids (UI-only — no hosted onboarding or real transfers from them).

**Bonus correction:** the runbook carried a **falsified safety claim** — *"NO real outgoing transfer is minted (that is the safety QA needs)"*. SUB Android Round 4 already disproved this (a real `metadata.source=manual_withdrawal` test-mode transfer was found), and `payout-fixture.mjs`'s own header was corrected at the time, but the runbook was missed. Corrected here. This is the "a documented SAFETY claim is evidence-grade text" rule in action.

### Item 7b — webhook signing secret / signed replay helper

**Delivered:** `scripts/qa/stripe-webhook-replay.mjs` (+ `npm run qa:stripe-webhook-replay`). It builds a realistic event envelope, signs it exactly as Stripe does (`t=<unix>,v1=<HMAC-SHA256(secret, "<t>.<body>")>`), POSTs it to the real `stripe-webhook` endpoint, and prints the status + body. `--dry-run` prints the payload and signature without sending. The secret is never echoed.

**Verified:**
- `--dry-run` with a probe secret → correct 64-hex signature + valid envelope.
- Live POST to the real endpoint → reached the function and was rejected **by the function's own signature-verification path** — which is what surfaced the P1 above.

**Owner action still required:** `STRIPE_WEBHOOK_SECRET` is absent from both `.env` and `.env.staging` (verified: 0 occurrences). Without it the tool exits 2 with the remediation and changes nothing — it never guesses. Once the secret is set **and** the P1 fix is deployed, SUB-TC-L05/L03's webhook legs become genuinely drivable.

**Status: written + partially verified; the positive (200) leg is NOT run** (BP-80 two-phase — deploy and secret are the gating steps).

### Item 7c — `--state` flag on `qa:set-sp-balance` (QB gap that blocked grace-SP)

**Root cause confirmed live:** the script force-set `state: 'active'` unconditionally. Confirmed on `test-grace`: `available=0 … state=grace_period` — so granting SP destroyed the very precondition the case needed, with no sanctioned restore.

**Fix:**
- New `--state <active|frozen|suspended|grace_period|inactive>` flag, **default `preserve`** for an existing wallet (a brand-new wallet is still created `active`).
- ⚠️ **Behaviour change, documented in the script header:** pass `--state active` to reproduce the old behaviour.
- Added the `test-grace` persona to the registry — the one persona whose purpose is the grace state could not previously be targeted by name (only `--email`/`--user-id`).

**Verified live:**
```
npm run qa:set-sp-balance -- --persona test-grace --amount 20 --dry-run
  Wallet state: PRESERVED (pass --state <value> to change it)
  Current wallet: available=0 pending=0 reserved=0 state=grace_period   ← preserved, not clobbered
--state bogus      → exit 2 with the accepted list
--state active     → "Wallet state: active"
```

### Item 7d — push-payload fixture for E04 → **case unblocked**

**Root cause:** `SubscriptionStatusScreen` has **no in-app navigation entry**; its only route in was a push notification payload, requiring two fixtures (a notification row + a device push tap) to reach a screen that takes **no parameters** and just reads the signed-in user's own row.

**Delivered:** a dev/staging-only deep link handler `QaSubscriptionStatusDeepLinkHandler.tsx` (`p2pkidsmarketplace://qa-subscription-status`), registered beside the other QA handlers in `AppNavigator`, gated identically (`__DEV__` / `EXPO_PUBLIC_ENVIRONMENT` ∈ {development, staging}) so it is inert in production. The screen is read-only, so no mutation surface is added.

**Tests:** 4 new cases (foreground event, cold-start initial URL, unrelated URL ignored, navigator-not-ready does not throw) — all pass.

**Guide updated:** E04's ⏸ FIXTURE-GATED marker replaced with the working recipe (index row, case body, and checklist mapping all updated in the same pass).

### Item 9 — WithdrawModal inline fee formula (UX)

The fee row read `Payout processing fee (Stripe): -$0.26` with the formula only in a trailing note. Now: `Payout processing fee (Stripe — $0.25 + 0.25%):`.

**SSOT discipline (BP-13):** the formula string lives in `sellerBalance.ts` immediately beneath `calculatePayoutFee`, exported as `getPayoutFeeFormula(methodType)` — so the displayed formula and the arithmetic cannot drift. Unknown method types return `null` and the caller omits the formula rather than inventing one.

### Item 10 — SP History refresh-on-focus (UX)

`SpTransactionHistoryScreen` loaded **only on mount**, so a ledger change made while it was mounted-but-unfocused (a cancelled offer refund, a settled sale) stayed invisible until a manual pull-to-refresh.

**Fix:** replaced the mount-only `useEffect` with `useFocusEffect` — covers mount **and** refocus with no duplicate request on first entry (`loadTransactions` only flips `loading` for the first paint, so a refocus refreshes silently).

**Test drift corrected (BP-57):** the suite auto-mocked `@react-navigation/native`, so `useFocusEffect` was a no-op and 10 tests failed on a permanent loading state. The mock now invokes the callback, mirroring `PayoutSettingsScreen.test.tsx`'s established pattern. All 15 tests pass.

---

## Repo-wide Tier 0 was BROKEN — fixed

`npm run typecheck` failed on `src/screens/payouts/PayoutDashboardScreen.tsx:260` — `navigation.navigate('SellerEarnings')` against a route **retired by FIX-Task-48 item 2** (2026-09-16). That screen is a fully **orphaned** leftover (no importers; its route and the `PayoutDashboard` screen were retired) whose stale call has been breaking the mandatory Tier 0 gate repo-wide for a day.

Removed the orphaned file (moved out of `src/`, recoverable from git). Tier 0 now passes.

**This was NOT caused by FIX-Task-52** — it is a pre-existing repo defect that had to be cleared to satisfy the standing compile gate. Flagging it explicitly because deleting a file exceeds the task's stated scope; the justification is that FIX-Task-48's *documented intent* was to retire it and the file had zero importers.

---

## Verification log

| Gate | Command | Result |
|---|---|---|
| Mobile typecheck | `npm run typecheck` | ✅ PASS (0 errors) after removing the dead orphan |
| Mobile lint (changed files) | `npx eslint <changed files>` | ✅ 0 errors (3 pre-existing warnings: 1 exhaustive-deps, 2 `no-console`) |
| Mobile lint (whole repo) | `npm run lint` | ⚠️ 80 errors / 576 warnings — **all pre-existing**, none in the files I changed |
| Unit tests (affected) | `npx jest QaSubscriptionStatus… SpTransactionHistory… PayoutSettingsScreen…` | ✅ 3 suites / 23 tests pass |
| Unit tests (full) | `npx jest` | ✅ 333 suites pass · 3 E2E suites failed **in parallel, pass serially** (`--runInBand`: 39/39) → parallel-run interference on shared staging state, pre-existing flake class |
| EF type-check | `deno check supabase/functions/stripe-webhook/index.ts` | ✅ clean |
| Script syntax | `node --check` × 4 changed scripts | ✅ clean |
| Item 2 fix | live `stripe-inspect transfer … --account …` | ✅ previously 404 → now returns the transfer |
| Item 3 fixes | 3 live `ef-repro` runs | ✅ all three guards fire correctly |
| Item 7c fix | live `set-sp-balance` dry-runs | ✅ grace state preserved; bad `--state` rejected |
| Item 7b helper | live POST to `stripe-webhook` | ✅ reached the endpoint (and exposed the P1) |
| Deploy | `supabase functions deploy <fn> --project-ref … --use-api --no-verify-jwt` ×2 | ✅ both deployed |
| Deploy verified | `functions list` | ✅ `stripe-webhook` 49→**50**, `create-stripe-connect-account` 44→**45** |
| P1 fixed (live) | signed replay post-deploy | ✅ error changed SubtleCrypto → signature-mismatch (crypto now runs) |
| `verify_jwt` preserved | unsigned POST to both endpoints | ✅ both reach the function body (not gateway-blocked) |
| Item 1 (live EF) | `qa:ef-repro … create-stripe-connect-account` as `qa-payout-seller` | ✅ `created:false`, `onboardingComplete:true`, same `acct_…` |
| Item 1 (on-device) | Add Another Method → Stripe Connect → Add Method | ✅ correct reused-account copy on screen + in the app log |
| Item 9 (on-device) | Withdraw Now → WithdrawModal | ⚠️ formula renders but value overflowed → **fixed** → ✅ re-verified wrapping |
| Tier 0 (post-fix) | `npm run typecheck` · `npx eslint <changed>` · affected jest suites | ✅ 0 type errors · 0 lint errors · 23/23 tests |

## §On-device verification (iOS simulator, 2026-09-17)

Ran after the deploy, on the booted iPhone 17 Pro Max (iOS 26.1) with Metro serving the updated bundle and the disposable `qa-payout-seller` persona (which holds a **verified** Connect account — the exact state that produced the QA finding).

**Item 1 — reused-account success copy: CONFIRMED.**

Two independent sources, both captured:

1. **On-screen alert** (`screenshots/G01-02-FIXED-reused-account-copy.png`) — title `Success`, body:
   *"This payout account is already connected and verified. You will now be redirected to Stripe."* — the third branch. Before the fix this said *"Stripe account created!"*.
2. **The app's own log** (Metro), corroborating that the client received the new EF contract:
   ```
   [Stripe] Create account result: {"created": false, "methodId": "0754defa-…",
     "onboardingComplete": true, "stripeAccountId": "acct_1UGO3X3J8Vt0lE5T", "success": true}
   ```
   Same `acct_...` → no new account was minted. Tapping OK opened the Stripe link in Safari, so the redirect leg still works.

**Item 9 — inline fee formula: CONFIRMED, and it exposed a regression I had introduced.**

- The formula renders inline as intended: `Payout processing fee (Stripe — $0.25 + 0.25%):`
- **BUT** the longer label pushed the fee **value off the card edge** — `-$0.38` rendered clipped against the right border, with the label running into it (`screenshots/G01-03-…`).
- Cause: `withdrawRow` is a `flexDirection: 'row'` / `space-between` row with **no flex constraints**, so a long label and the value fought for width.
- **Fix:** `withdrawLabel` gets `flex: 1` (so it *wraps*), `withdrawValue` gets `flexShrink: 0` + `marginLeft: 12` (so the amount can never be squeezed or pushed out).
- **Re-verified on-device after Fast Refresh:** the label now wraps to two lines and `-$0.38` sits fully inside the card (`screenshots/G01-04-withdraw-fee-row-check.png`).

> **Why this matters:** this defect was invisible to typecheck, lint, unit tests and source review — it only existed once the string was long enough to collide at render time. It is the concrete case for the device pass being mandatory on copy changes.

**Also confirmed incidentally:** the payout history fee note, the payout-method card, and the Add Payout Method modal all render on-brand (white card, single green pill primary, outlined Cancel) — consistent with the prior rounds.

### New finding from the device pass (NOT fixed — owner call)

The **`WithdrawModal` is not exposed in the iOS accessibility tree** — after opening it, `mobile_list_elements_on_screen` returned only the Payout Settings elements behind it, twice. Its buttons (`withdraw-cancel` / `withdraw-confirm`) exist in source with `testID` + `accessibilityRole`, so this is an iOS AX-exposure gap for that modal, matching the pre-existing iOS-side note that Android *does* expose them. Screenshot/pixel-scan is the workaround (documented in the QA playbook §5.31). **Not in FIX-Task-52's scope** — recorded here as a locator-gap finding for the instrumentation backlog.

---

## App state left behind / not done

- ✅ **Both Edge Functions are deployed and live** (`stripe-webhook` v49→50, `create-stripe-connect-account` v44→45), `verify_jwt=false` preserved on both.
- **Owner action still pending:** the webhook signing secret exists **server-side** (proven above) but has no **local** copy in `p2p-kids-marketplace/.env`. Until it is pasted there, `qa:stripe-webhook-replay` cannot produce a 200 and the L05/L03 webhook legs stay unverifiable **from QA's side only**.
- **Not driven on device:** E04's real screen render (the deep link is wired + unit-tested but no simulator run); the hosted Stripe Express flow end-to-end; item 1's *first-time-create* and *reused-incomplete* branches (only the reused-verified branch — the one QA reported — was confirmed).
- `qa:stripe-inspect` runs used `--break-glass-secret-key` (labels: `SECRET_KEY_BREAK_GLASS`) because `STRIPE_QA_READONLY_KEY` is not configured — **not** restricted-key evidence.
- **No fixture rows, trades, payouts or transfers were created.** All QA script runs were `--dry-run`, read-only, or signature-rejected (a rejected signature mutates nothing). The device pass minted no new Stripe account (reuse path) and **`Confirm Withdrawal` was never tapped** — the modal was closed by terminating the app, specifically so no test-mode transfer could be created.
- Metro was stopped and the app terminated at the end of the session.
- `qa-payout-seller` was logged in on the simulator (session state left as-is; the persona is disposable).
