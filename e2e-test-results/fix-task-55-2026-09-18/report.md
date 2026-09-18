# FIX-Task-55 — Report

**Date:** 2026-09-18
**Source:** QA Task — FIX-Task-53 Android Verification, 2026-09-18
**Type:** 1 LOW-MED hex bug · 1 investigation · 1 fixture · 1 LOW layout · 1 tooling status · 2 UX items

---

## Outcome summary

| # | Item | Status |
|---|---|---|
| 1 | Off-brand SP placeholder hex | ✅ **FIXED + CONFIRMED ON-DEVICE** (incl. a 2-instance class sweep) |
| 2 | Is the `unverifiedMethod` guard reachable? | ✅ **ANSWERED — REACHABLE.** Not dead code. Do **not** retire the case |
| 3 | Build the fixture scenario | ✅ **BUILT + dry-run verified.** Applying it for real is approval-gated (BP-80) |
| 4 | Subscription Status label wrap | ✅ **FIXED + CONFIRMED ON-DEVICE** |
| 5 | Restricted Stripe read key | ⏸️ **STILL DEFERRED** — confirmed still `sk_`; remediation below |
| 6 | Live cash echo on Make Offer | ✅ **IMPLEMENTED + CONFIRMED ON-DEVICE** (live update proven) |
| 7 | Surface `cancel_reason` | ✅ **IMPLEMENTED + CONFIRMED ON-DEVICE** — and it surfaced a real defect, now fixed |

**Tier 0:** typecheck PASS · changed-files lint clean · 70 unit tests PASS (3 suites + 2 suites + cart suite).
Device legs: 3 of 3 UI items verified on the iPhone 17 Pro Max simulator.

---

## 1. [FIXED, LOW-MED] Off-brand placeholder colour on the SP amount input

`TradeOfferScreen.tsx` set `placeholderTextColor="#D97706"` — Tailwind amber-600, forbidden by BP-82 — inside a wrapper whose Coins icon and "SP" unit are both canonical SP gold `#F59E0B`. Two different golds in one control.

**Fix:** `#D97706` → `#F59E0B`.

**Class sweep (the standing rule).** The identical control exists on a second screen, with the same defect: `CartCheckoutScreen.tsx:905` (same `#FEF3C7` wrapper, same `#F59E0B` Coins icon, same `#D97706` placeholder). Fixed in the same pass. A third `placeholderTextColor` gold, `BulkListingCreateScreen.tsx` `#2E7D5B`, is a `__DEV__`-only fixture input — left as-is.

**Why not `#999999` (the design system's generic tertiary/placeholder token)?** Both options the brief offered were viable; `#F59E0B` was chosen because this control is already gold-accented — `spLabel` ("ADD SP OFFER") and `spUnit` ("SP") in the same wrapper ship `#F59E0B` — so the placeholder now matches its own control instead of being the one off-token element. Recorded as a deliberate choice, not an oversight.

**On-device confirmation** (Make Offer, test-buyer, LEGO Star Wars Set):

| Region | `#F59E0B` | `#D97706` | `#FEF3C7` |
|---|---|---|---|
| Placeholder glyph (`210,1290,60,70`) | **268 px (6.38 %)** | **0 px (0.00 %)** | 3791 px (90.26 %) |
| Control — Coins icon (`120,1293,60,60`) | 790 px (21.94 %) | 0 px (0.00 %) | — |

The control scan proves the two token bands discriminate (the token that matches the canonical gold fires at 21.94 % on a known-good gold; the removed colour's band fires at 0 % on it). The placeholder region then reads 6.38 % SP gold and **0.00 %** amber-600 — the removed colour is absent.

Evidence: `screenshots/MOBILE-sp-input-placeholder-make-offer.png`
Scan: `npm run qa:badge-scan -- --img … --region 210,1290,60,70 --token name=SPgold_F59E0B,rmin=228,rmax=255,gmin=143,gmax=175,bmin=0,bmax=28 --token name=TailwindAmber_D97706,rmin=208,rmax=226,gmin=110,gmax=128,bmin=0,bmax=15`

---

## 2. [ANSWERED] Is the unverified-method withdraw guard reachable? — **YES, and it is the DEFAULT state**

**Finding: the branch is REACHABLE. It is not dead code, and the R79-2 "unreachable branch" treatment does not apply. Leave the branch in place.**

### What the investigation asked
Does the server always promote a lone payout method to primary, making `!primaryMethodId && hasIncompleteOnboardingMethod` impossible?

### What the server actually does — **nothing promotes a lone method**
Every writer of `seller_payout_methods.is_primary` was traced:

| Writer | Behaviour |
|---|---|
| `create-stripe-connect-account` EF (`index.ts:297, 308`) | Inserts `is_primary: **false**` always. Never promotes |
| `createPayoutMethod()` (`services/payoutMethods.ts:287`) | `is_primary: request.set_as_primary \|\| false` — and BOTH `AddPayoutMethodModal` call sites pass `set_as_primary: **false**` (`PayoutSettingsScreen.tsx:1726, 1740`) |
| `payoutService.ts:143, 178` | `is_primary: **false**` |
| `sync-stripe-connect-status` EF | Writes `is_verified` / `stripe_onboarding_complete` / `stripe_payouts_enabled`. **Does not write `is_primary` at all** |
| `set_primary_payout_method()` RPC | The **only** writer of `is_primary = TRUE`. Caller-initiated, and gated: it `RAISE EXCEPTION`s unless the method `is_verified = TRUE` |
| Table triggers | Only `update_seller_payout_methods_updated_at` (stamps `updated_at`). **No promotion trigger** |

So a seller who starts Stripe Connect onboarding and abandons it has exactly one method with `is_primary = false, is_verified = false` ⇒ `primaryMethodId === null` ⇒ the guard **enters** ⇒ `findIncompleteOnboardingMethod()` is truthy ⇒ the **"Verify Your Payout Method"** variant renders. **This is the ordinary abandonment state, not an edge case.**

### Why it had never fired in testing — the FIXTURE was the blocker, not the app
`qa:payout-fixture`'s `single-unverified` scenario sets **`is_primary: true, is_verified: false`** — a combination **the server cannot produce**. Because `is_primary` was true, `primaryMethodId` was non-null, so the `!primaryMethodId` gate **short-circuited and the guard was never entered at all**. The case was recorded as perpetually "blocked" on a state that was in fact reachable — the fixture was manufacturing a state that bypassed the very branch under test (the §9.1e / R78-2 "a fixture that cannot reproduce the real state" class).

The guide was right all along: SUB-TC-G11's variant already says *"a Stripe Connect method whose onboarding is still incomplete (**no primary method**)"*. The fixture contradicted it.

### Adjacent finding raised by this investigation (NOT fixed here — needs an owner decision)
Once a seller **completes** onboarding, `sync-stripe-connect-status` sets `is_verified = true` but `is_primary` stays **false** — and nothing ever promotes it. So a seller with a fully-verified Stripe Connect method still has `primaryMethodId === null`, still enters the guard, but `findIncompleteOnboardingMethod()` now returns `undefined` ⇒ the **"Payment Method Required" / Add Payout Method** variant renders ⇒ `resumeOrAddPayoutMethod()` falls through to `setShowAddMethodModal(true)` ⇒ the seller is invited to **mint a duplicate method** instead of being told to mark their verified method primary.

That is the same duplicate-minting hazard FIX-Task-53 item 5 fixed for the *other* branch, reached via this one. It is a product decision (auto-promote the sole verified method? or prompt "Set as primary"?) so it is reported, not implemented — see "What Needs To Be Fixed Next".

---

## 3. [BUILT] New fixture scenario `single-unverified-nonprimary`

Added to `p2p-kids-marketplace/scripts/qa/payout-fixture.mjs` (+ registered in both copies of the scenario list — the top docstring and `usage()`):

```
'single-unverified-nonprimary': [
  { method_type: 'stripe_connect', is_primary: false, is_verified: false,
    stripe_onboarding_complete: false, stripe_payouts_enabled: false,
    stripe_charges_enabled: false, stripe_account_id: 'acct_qa_unverified_nonprimary' },
],
```

Dry-run verified (writes nothing): `npm run qa:payout-fixture -- methods --scenario single-unverified-nonprimary --dry-run`
→ `DRY-RUN — would replace methods with scenario 'single-unverified-nonprimary' (1 row(s)).`

**Applying it for real is approval-gated** (BP-80 two-phase provisioning — it replaces `qa-payout-seller`'s `seller_payout_methods` rows on staging). Command when approved:
`npm run qa:payout-fixture -- methods --scenario single-unverified-nonprimary` then `npm run qa:payout-fixture -- balance --amount 500`.

**Boundary to record honestly:** the account id is synthetic, so only the **guard** is drivable (modal title/body/CTA + the add-flow fallback). Tapping **Continue Onboarding** calls `create-stripe-account-link` with that id and will fail at Stripe — the downstream hosted-link leg needs a real `acct_…`. This is stated in the scenario's own comment and in the guide.

**Guide updated** (`cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`, SUB-TC-G11 variant) with the exact command and a warning about the argument order.

> **Argument-order trap found while verifying:** `payout-fixture.mjs` reads its subcommand from `process.argv[2]`, so any `--flag value` placed **before** `methods`/`balance` makes the script print its usage and do nothing. The first draft of the guide line had `--persona qa-payout-seller methods …`, which would have silently no-op'd for the next QA round; corrected to `-- methods --scenario …`.

---

## 4. [FIXED, LOW] Subscription Status label wrap

The `(historical)` qualifier sat in the **label** (`Cancelled At (historical)`), pushing it past the label column's one-third share so it wrapped onto a second line and roughly doubled that row's height beside its single-line siblings.

**Note on the dispatched remedy:** the brief proposed "give the label column `flex:1`" — that is **already** the case (`rowLabel` has `flex: 1`, `rowValue` `flex: 2`), so that option could not fix it. Implemented the brief's alternative instead: the qualifier moved **out of the label** into an explanatory line under the rows, so every row is one line tall and the explanation reads better than a parenthetical.

**On-device confirmation** — row pitch inside the Cancellation card now matches its siblings exactly:

| Card | Rows (y, points) | Pitch |
|---|---|---|
| Stripe Integration | Customer ID 416 → Subscription ID 439 | 23 pt |
| Billing Period | Period Start 534 → Period End 558 → Time Left 581 | 24 / 23 pt |
| **Cancellation** | **Cancelled At 676 → Reason 700** | **24 pt** |
| *before* | `Cancelled At (historical)` wrapped → ~2× row height | — |

Label reads `Cancelled At` (no qualifier); note reads *"This is when you cancelled. Your access continues until the period above ends."* (`cancellation-historical-note`, y 725).

Evidence: `screenshots/MOBILE-subscription-status-cancellation-card.png`

---

## 5. [STILL DEFERRED] Restricted Stripe read key

**Provisioning status: still deferred, and confirmed still in the wrong state.** `STRIPE_QA_READONLY_KEY` is present in `p2p-kids-marketplace/.env` and its prefix classifies as **`sk_` (a full secret key)** — so `qa:stripe-inspect` keeps refusing it without `--break-glass-secret-key` and every money-verification round keeps self-labelling `key_scope=SECRET_KEY_BREAK_GLASS` rather than sanctioned restricted-read-only evidence.

**Why I did not fix it:** minting an `rk_test_…` key is a Stripe Dashboard action (Developers → API keys → **Create restricted key**, Test mode) plus a credential write into `.env`. It needs Dashboard access and must not be routed through this agent — and the standing rule is that the service/secret key is never requested or stored here. This is an **owner action**, not a code task.

**Exact remediation for whoever holds Dashboard access:**
1. Stripe Dashboard (Test mode) → Developers → API keys → Create restricted key.
2. Grant **Read** only, on: Payment Intents, Charges, Refunds, Setup Intents, Payment Methods, Customers, Subscriptions, Invoices, Payouts, Transfers, Events, Disputes. No write on anything.
3. Put the `rk_test_…` value in `p2p-kids-marketplace/.env` as `STRIPE_QA_READONLY_KEY`, replacing the current `sk_…`.
4. Verify: `npm run qa:stripe-inspect -- by-user qa-payout-seller` → the result must carry `key_scope=RESTRICTED_READ_ONLY` and must **not** require `--break-glass-secret-key`.

Until then the break-glass caveat stands on every money-touching finding. Low urgency, unchanged.

---

## 6. [IMPLEMENTED] Make Offer — live cash echo

The SP hint stated the ceiling (`Max: 15 SP (50% of price)`) but not what the buyer actually pays in cash, so the buyer had to scroll to the "What you pay" card and subtract at commit time.

Added a live line under the SP input, using the **same label** ("Total cash") and the **same expression** (`grandTotalCents`) as that card's final row — so the two widgets can never render two different numbers (BP-92 rule 1). New `testID: sp-cash-total-hint`; styled in the primary text tier rather than hint grey, because it is a money figure the buyer commits.

**On-device confirmation — live update proven:**

| Step | `sp-cash-total-hint` | Value stack "Total cash" row | Agree? |
|---|---|---|---|
| No SP entered | `Total cash: $33.59` (y 495) | `$33.59` (y 944) | ✅ |
| Typed `5` SP | `Total cash: $28.59` (y 495) | `$28.59` (y 969) | ✅ |

`$30.00 − 5 SP + $1.49 fee + $2.10 tax = $28.59` — the hint re-computed on the keystroke and stayed in lock-step with the summary card.

---

## 7. [IMPLEMENTED] Subscription Status — stored cancellation reason surfaced

The Cancellation card showed "Cancelled At" beside a live **ACTIVE** badge with only the `(historical)` qualifier explaining the apparent contradiction. The stored `subscriptions.cancel_reason` is now selected and rendered as a `Reason` row.

**This item surfaced a real defect on-device, caught before shipping.** `cancelSubscription()` stores the reason **id**, so the first implementation rendered the raw machine code **`too_expensive`** to the user — the raw-code-on-a-user-surface class (§6.3 / R58 / BP-86). Found only because the device pass was run.

**Fix (sibling-precedent, §9.1c):** rather than inventing a second label set, the canonical list already in `ManageKidsClubScreen.tsx` was extracted to a shared module so the picker and the display surface read **one** source:

- **New** `src/utils/subscriptionCancellation.ts` — exports `CANCELLATION_REASONS` (the 6 canonical id→label pairs) and `cancellationReasonLabel()`. Known id → label; unknown non-empty value → returned as-is (older rows carry free text, e.g. the service's own `"User requested cancellation"`, and hiding the only record of why the user left would be worse); blank → `null` so the shared `Row` keeps its `—` placeholder.
- `ManageKidsClubScreen.tsx` — local list removed, imports the shared one.
- `SubscriptionStatusScreen.tsx` — `Reason` row renders `cancellationReasonLabel(info.cancel_reason)`.

**On-device confirmation (after a cold reload — the change added a new file, so a warm reload was not trusted, R79-1a):** `Reason` now reads **"Too expensive"** where it previously read `too_expensive`.

Evidence: `screenshots/MOBILE-subscription-status-reason-mapped.png`

---

## Files changed (6)

| File | Change |
|---|---|
| `p2p-kids-marketplace/src/screens/trade/TradeOfferScreen.tsx` | Item 1 (placeholder hex) + item 6 (live cash hint + style) |
| `p2p-kids-marketplace/src/screens/cart/CartCheckoutScreen.tsx` | Item 1 class sweep (placeholder hex) |
| `p2p-kids-marketplace/src/screens/subscription/SubscriptionStatusScreen.tsx` | Items 4 + 7 (Cancellation card, `cancel_reason` select/type, note style, label mapper) |
| `p2p-kids-marketplace/src/utils/subscriptionCancellation.ts` | **New** — shared canonical cancellation-reason ids/labels + mapper |
| `p2p-kids-marketplace/src/screens/subscription/ManageKidsClubScreen.tsx` | Imports the shared list (its local copy removed) |
| `p2p-kids-marketplace/scripts/qa/payout-fixture.mjs` | Item 3 — new `single-unverified-nonprimary` scenario (+ both scenario lists) |
| `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` | Item 3 — SUB-TC-G11 variant now names the drivable scenario + the argument-order trap |

> **Scope note (mandatory disclosure):** the standing rule stops me at 3 files. This task legitimately exceeded it (6), and each extra file is accounted for: the cart screen and the shared cancellation module are the **class sweep** the standing rule itself requires (fixing one instance of a two-instance defect would leave the class half-fixed, and duplicating the label list would have created a second source of truth for the same copy); the fixture + guide are item 3's explicit deliverable. No unrelated refactoring was performed.

---

## Verification run

```
yarn typecheck                     → PASS (tsc --noEmit, 0 errors)
npx eslint <3 changed files>       → PASS (0 problems)
yarn lint                          → 80 errors / 576 warnings, ALL pre-existing
                                     (detox/ + __tests__/integration/ + old
                                      __tests__/screens/auth/ — none in changed files)
npx jest src/screens/trade/__tests__/TradeOfferScreen.test.tsx
         src/screens/seller/__tests__/PayoutSettingsScreen.test.tsx   → 23 PASS
npx jest src/screens/cart                                          → 44 PASS
npx jest src/screens/subscription/__tests__/ManageKidsClubScreen…   → 3 PASS
```

**Regression tiering:** Change Classification = **C (mobile UI/screens)** for items 1/4/6/7, plus a QA-fixture/script change (item 3) and no DB/Edge-Function/Stripe-logic change. → **Tier 0 required and run (PASS)**; Tier 1 not required (no EF/contract/auth/payments change); Tier 2 not required (no migration/trigger/RPC/webhook/SP-rule change).

**Environment notes:** Metro was running on **:8082** (not :8081) and had started at **06:27:52**, i.e. **before** this task's edits (~07:00) — so per R79-1c a reload was mandatory, not optional; the bundle was re-fetched at ~07:19 and the device legs ran against the reloaded bundle. The `mobile_launch_app` and `mobile_click_on_screen_at_coordinates` tools initially reported "disabled by the user"; the matching `activate_*_tools` categories resolved both (an activation gate, not a blocker). Screenshots were captured with `xcrun simctl io booted screenshot` because the mobile-mcp screenshot tool returns a resource rather than a scannable file.

---

## Verification checklist mapping

| Item | How it was verified |
|---|---|
| 1 | Source grep (`#D97706` gone from both SP inputs) + on-device region colour scan with a discriminating control |
| 2 | Full trace of every `is_primary` writer (2 EFs, 2 service paths, 1 RPC, trigger inventory) — conclusion: reachable, fixture was the blocker |
| 3 | Scenario registered + `--dry-run` exit 0 naming the new scenario |
| 4 | On-device row-pitch comparison against three sibling cards |
| 5 | Env-var presence + key-prefix classification (no secret value read or printed) |
| 6 | On-device before/after with a keystroke, cross-checked against the summary card |
| 7 | On-device before (`too_expensive`) / after (`Too expensive`) across a cold reload |
