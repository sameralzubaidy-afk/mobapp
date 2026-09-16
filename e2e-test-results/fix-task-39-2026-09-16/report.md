# FIX-Task-39 — Payout Summary Undercount + Guide Drift + Instrumentation + UX

**Date:** 2026-09-16
**Source:** FIX-Task-37 Device Verification + SUB Android Round 2a (`e2e-test-results/qa-fix37-verify-sub-android2a-2026-09-16/`)
**Device:** Android emulator `Medium_Phone_API_36.1` (`emulator-5554`) + Metro (single instance)
**Persona used for on-device legs:** `test-seller` (the persona holding the 17 `requires_action` payouts)
**Staging project:** `drntwgporzabmxdqykrp`

---

## 1. Item 1 — [MED] Payout Settings summary undercounted by 12 — ✅ FIXED & VERIFIED

### Root cause (named per R100)
`PayoutSettingsScreen.tsx` derived the summary from `recentPayouts`, which is
`getRecentPayouts(payoutLimit)` — a **paginated** read (`payoutLimit` starts at **5**, grows only via
"Load More"). The count was therefore "blocked payouts on the loaded page", not the seller's backlog:
a seller with 17 stuck payouts was told **"5 payouts need a payout method"**.

### Change
| File:line | Change |
|---|---|
| `p2p-kids-marketplace/src/services/sellerBalance.ts` (`getActionRequiredPayoutCount`, new, after `getRecentPayouts`) | New head-only aggregate: `select('id', { count:'exact', head:true }).eq('user_id', user.id).eq('status','requires_action')` — same idiom as the existing `hasPendingPayouts`. |
| `p2p-kids-marketplace/src/screens/seller/PayoutSettingsScreen.tsx:172-195` | `actionRequiredPayoutCount` is now **state** fed by that aggregate (was a `.filter()` over the loaded page). Added `visibleActionRequiredPayoutCount` (page-derived) used **only** to explain a truncated list. |
| `PayoutSettingsScreen.tsx:~261-276` | `loadPayoutMethods()` fetches the true total; best-effort (`try/catch` + `console.warn`) so a count failure keeps the last figure instead of blanking the warning or failing the whole screen (BP-92). |
| `PayoutSettingsScreen.tsx:~786-820` | Renders the true total + a hint when the loaded page shows fewer blocked rows than the total. |

### Verification — UI → DB (both layers)
* **UI (on-device, Android):** `payout-action-required-summary` = **"17 payouts need a payout method"** (previously "5").
* **DB (read-only, owner-approved):**
  ```sql
  SELECT status, count(*) FROM seller_payouts
  WHERE user_id = (SELECT id FROM auth.users
                   WHERE email = 'test-seller@kidsmarketplace.test')
  GROUP BY status ORDER BY status;
  ```
  → `failed = 1`, **`requires_action = 17`**.
* **Verdict: AGREE** — the rendered number now equals the DB total exactly.
* **Discriminating test (R79-1):** the on-device figure changed 5 → 17, which only the new code can produce, so the verified build is provably the fresh bundle.

Evidence: `screenshots/payout-settings-17-action-required.png`

---

## 2. Item 2 — [Doc] SUB-TC-I08 guide drift — ✅ FIXED

`cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md` — the note
called the wallet-not-found state "rare" because `getWallet` auto-inserts a missing row. It is now
driven deterministically by the session-local `sp_wallet_not_found` QA toggle
(`getSimulatedWalletNotFoundMode()` short-circuits **before** any DB read/auto-insert —
`src/services/sp/wallet.ts`). The case now carries the exact arm/re-enter/disarm recipe (iOS + the
`&`-escaped Android form), including the **fresh-mount requirement** (R96 — QA Task 37 needed an
unmount/re-entry before the banner appeared) and the disarm read-back.

## 3. Item 3 — [Doc] ADM-TC-L08 guide drift — ✅ FIXED

`cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md` — expected results said
`grace_period` shows a **"yellow"** banner reading **"Grace Period Active — 90 days…"**. Neither is
shipped. `src/components/molecules/WalletWarningBanner.tsx` uses the design-system **warning-amber**
pair (`#FFF3E0` / `#FFA726`, NOT yellow, NOT red) and a state-driven grace message with **no day
count**: *"You can keep spending existing Swap Points, but you won't earn new ones until you renew."*
All three banner states + the no-banner state are now written out verbatim from source, with the
drift note and the on-device scan that confirms the token (`86.21% #FFF3E0 / 1.00% #FFA726 / 0.00% red`).

## 4. Item 4 — [Instrumentation] `qa:stripe-inspect` — ✅ ADDED & EXERCISED

| File | Change |
|---|---|
| `scripts/qa/stripe-inspect.mjs` | New **`pm-list`** subcommand + `--customer <cus_…>` flag. Resolves the customer from `--customer`, a bare `cus_…`, or `--user <persona\|email\|uuid>`. Prints every attached PM, the ids **joined as a string** (the generic printer collapses arrays >3 to `[N items]`, which would hide exactly what this enumerates), plus `app_stored_payment_method_id` / `stored_pm_attached` so the **orphan-detached-PM** case is visible in one call. Header usage docs updated. |
| `scripts/qa/lib/r41-common.mjs` | New exported **`PERSONA_EMAIL_ALIASES`** + `resolveUserId` now resolves those names by email. Covers `qa-wallet`, `qa-payout-seller`, `test-noconvo`, `qa-deleted`, `qa-no-profile`, `qa-linked-provider`. Deliberately **not** added to `PERSONAS` (several fixtures treat that map as an allowlist of personas with known ids and read `.id` directly). |

**Exercised (works):**
```
npm run --silent qa:stripe-inspect -- pm-list --customer cus_Ungj4MptKp9CUg
npm run --silent qa:stripe-inspect -- pm-list --user test-buyer
npm run --silent qa:stripe-inspect -- customer --user qa-wallet      # alias map works
```
`pm-list --customer` returned `count: 4`, the 4 `pm_` ids, `app_stored_payment_method_id: pm_1UGLze4…`,
`stored_pm_attached: true`. `--user qa-wallet` resolved to `cus_VDA6aCp5fY8Uci` — previously the name
fell through to the raw-uuid branch and produced a confusing empty result.

### ⚠️ Separate finding (owner action) — the read-only key is misconfigured
`STRIPE_QA_READONLY_KEY` in `p2p-kids-marketplace/.env` currently holds a **full secret test key**
(`sk_test_…`), so the tool **refuses every restricted read** and exits 2. To keep using the sanctioned
read-only path, mint an **`rk_test_…` restricted read-only** key (Permissions: READ on PaymentIntents,
Charges, Refunds, SetupIntents, PaymentMethods, Customers, Subscriptions, Invoices, Payouts, Transfers,
Events, Disputes + connected-account read) and replace that value. The runs above used
`--break-glass-secret-key`, so their output is labelled **`key_scope=SECRET_KEY_BREAK_GLASS`** and must
not be quoted as restricted-key evidence.

## 5. Item 5 — [Fixture] Restore `test-buyer`'s saved card — ✅ APPLIED

`npm run qa:ensure-cards -- --persona test-buyer` →
* created + attached **MASTERCARD •••• 4444** `pm_1UGLze4I6kCJlvXoJw8U6gNp` to `cus_Ungj4MptKp9CUg`
* `subscriptions.stripe_payment_method_id` updated and read back = `pm_1UGLze4…`
* confirmed by `pm-list`: 4 attached PMs, and the app's stored id IS among them (`stored_pm_attached: true`)

> Known cosmetic script note (pre-existing, F10 in the FIX-Task-22 run): it logs
> `⚠️ email not found in auth.users — using fixed UUID` for `test-buyer` yet succeeds via the fixed UUID.

## 6–8. UX enhancements — ✅ IMPLEMENTED (on-device verified)

**Item 6 — SP Wallet "Pending" vs "Pending Release" confusion.**
`src/screens/sp/SpWalletScreen.tsx`: the note no longer reuses the stat chip's word.
* Title was `{totalPending} SP Pending Release` → now **`{totalPending} SP Releasing Soon`** (new `testID="sp-wallet-pending-release-title"`).
* Body now says what happens and that it isn't spendable: *"This SP comes from your completed sales and isn't spendable yet — each batch unlocks {releaseDays} days after its trade."*
* On-device (test-seller): chip **"Pending 503"** and note **"39 SP Releasing Soon"** now read as two clearly different things.
* The guide's SUB-TC-I09 expectation was updated in the SAME pass (its copy assertion would otherwise have gone stale), and it now warns not to assert the two figures as one number.

**Item 7 — inline "Why?" on Payout Settings.**
New `payout-action-required-why` button beside the count (`styles.actionRequiredSummaryRow` / `actionRequiredWhyText`), plus `payout-action-required-hint` ("5 of them are in the list below — tap Load More to see the rest.") rendered only when the page shows fewer blocked rows than the total. Tapping it renders through the app's branded `GlobalAlertProvider` (`global-alert-button-0`) — verified on-device with the exact copy: *"These are completed sales waiting on a payout method. Your earnings for them are saved. They all share this one cause, so you can add or finish verifying a payout method instead of opening each payout."* No auto-release is claimed (not verified).

**Item 8 — SP History tab `accessibilityState`.**
`src/screens/sp/SpTransactionHistoryScreen.tsx`: all three tabs now carry `accessibilityState={{ selected: activeTab === … }}`, keeping `accessibilityRole="button"` (RN 0.81 does not register `accessibilityRole="tab"` on iOS — BP-53). On-device the AX tree now reports `selected` on the active tab, and the flag **moves with the selection** (`sp-history-tab-all` → `sp-history-tab-spent`).

Evidence: `screenshots/sp-wallet-releasing-soon.png`, `screenshots/payout-settings-why-explainer.png`, `screenshots/sp-history-tab-selected.png`

---

## Verification (Tier 0)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | **PASS** (no output) |
| Lint | `npx eslint src/screens/seller/PayoutSettingsScreen.tsx src/screens/sp/SpWalletScreen.tsx src/screens/sp/SpTransactionHistoryScreen.tsx src/services/sellerBalance.ts` | **PASS** — 0 errors, 3 pre-existing warnings (exhaustive-deps at L221; two `no-console` at L1258/1274, untouched by this task) |
| Device | Android emulator, test-seller | Items 1/6/7/8 verified live |

**Files changed (8):** `sellerBalance.ts`, `PayoutSettingsScreen.tsx`, `SpWalletScreen.tsx`,
`SpTransactionHistoryScreen.tsx`, `scripts/qa/stripe-inspect.mjs`, `scripts/qa/lib/r41-common.mjs`,
`cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`,
`cross-checked-and-consolidated/MODULE-ADMIN-PORTAL-MANUAL-TESTING.md`.

## App state left behind
* `test-buyer` — has a valid saved card again (MASTERCARD •••• 4444, `pm_1UGLze4I6kCJlvXoJw8U6gNp`); **no residue**, this restores the baseline.
* 1 new test-mode Stripe PM created (test mode).
* Device session left **signed in as `test-seller`**, last screen = SP History ("Spent" tab selected).
* No `admin_config` / QA-toggle writes. QA toggles were not armed this round.
* `e2e-test-results/fix-task-39-2026-09-16/` created (report + 4 screenshots).

## Known gaps / not done yet
1. **No unit test added** for `getActionRequiredPayoutCount` — it is a data-access wrapper, not business
   logic (HP-2's test requirement targets SP/fee/pending logic). The fix is instead closed by a stronger
   pair: an on-device render **and** a read-only DB count that agree exactly. A mocked test of the query
   shape (asserting `head:true` + both filters) is a reasonable follow-up.
2. **`qa:stripe-inspect` evidence is break-glass labelled** because `STRIPE_QA_READONLY_KEY` holds a
   secret key. Minting the `rk_test_…` key is an owner action (item 4 above).
3. **Coverage-tracker note owed:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`'s SUB-TC-I09 row
   still quotes the OLD note copy as its evidence. The copy was re-verified on-device this round, but the
   tracker row should be re-pointed on the next QA pass.
4. `test-buyer`'s customer now holds 4 attached cards (3 from earlier rounds + the new one). Detached
   cards from the F2 cycle remain detached and unrecoverable by Stripe design.
5. `gap-analysis/new-test-cases-subscriptions.md:474` still records the OLD I09 copy — it is a
   gap-analysis artefact, not a canonical guide, so it was intentionally left untouched.
